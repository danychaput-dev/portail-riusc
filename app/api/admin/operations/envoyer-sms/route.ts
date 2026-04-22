// app/api/admin/operations/envoyer-sms/route.ts
//
// Envoi SMS bulk depuis le modal de composition (ModalComposeCourriel).
// Utilise Twilio directement (pas de n8n) pour simplicité + vitesse.
//
// Payload:
//   { destinataires: [{ benevole_id, prenom, nom }], message: "Bonjour {{ prenom }}, ..." }
//
// Logique:
//   1. Fetch les telephones depuis reservistes (source unique de vérité, pas inscriptions_camps)
//   2. Pour chaque dest avec tel valide: POST Twilio avec message personnalisé
//   3. Retourne { sent, failed, errors }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return res
}

function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function personalize(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*prenom\s*\}\}/gi, vars.prenom || '')
    .replace(/\{\{\s*nom\s*\}\}/gi, vars.nom || '')
}

export async function POST(req: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { destinataires, message } = body
  if (!Array.isArray(destinataires) || !destinataires.length) {
    return NextResponse.json({ error: 'destinataires requis' }, { status: 400 })
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message requis' }, { status: 400 })
  }
  if (message.length > 480) {
    return NextResponse.json({ error: 'message trop long (max 480 car.)' }, { status: 400 })
  }

  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return NextResponse.json({ error: 'Twilio non configuré (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN requis)' }, { status: 500 })
  }

  // Fetch les telephones depuis reservistes (source unique depuis 2026-04-22)
  const benevoleIds = destinataires.map((d: any) => d.benevole_id).filter(Boolean) as string[]
  const { data: reservistes } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, telephone')
    .in('benevole_id', benevoleIds)
  const reservisteMap = new Map<string, any>((reservistes || []).map((r: any) => [r.benevole_id, r]))

  const TWILIO_FROM = '+14388073137'
  const authHeader = 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')

  let sent = 0
  let failed = 0
  const errors: string[] = []

  // Envois parallèles (limiter à 5 simultanés pour éviter rate limit Twilio)
  const batchSize = 5
  for (let i = 0; i < destinataires.length; i += batchSize) {
    const batch = destinataires.slice(i, i + batchSize)
    const results = await Promise.allSettled(batch.map(async (dest: any) => {
      const r = reservisteMap.get(dest.benevole_id)
      const prenom = r?.prenom || dest.prenom || ''
      const nom = r?.nom || dest.nom || ''
      const tel = toE164(r?.telephone)
      if (!tel) {
        throw new Error(`Pas de téléphone pour ${prenom} ${nom}`)
      }
      const personalized = personalize(message, { prenom, nom })
      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_FROM,
          To: tel,
          Body: personalized,
        }).toString(),
      })
      if (!twilioRes.ok) {
        const errText = await twilioRes.text().catch(() => '')
        throw new Error(`Twilio ${twilioRes.status}: ${errText.slice(0, 120)}`)
      }
      return { benevole_id: dest.benevole_id, tel }
    }))
    for (const res of results) {
      if (res.status === 'fulfilled') sent++
      else {
        failed++
        errors.push(res.reason?.message || 'erreur inconnue')
      }
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    failed,
    total: destinataires.length,
    errors: errors.slice(0, 5), // premiers 5 pour debug
  })
}
