// app/api/admin/operations/n8n-webhook/route.ts
//
// Proxy serveur vers les webhooks n8n de déclenchement ciblage/mobilisation.
//
// Pourquoi un proxy :
//   - Le code frontend tourne dans le navigateur. Toutes les données passées
//     dans le body seraient visibles dans la console DevTools du client.
//   - On ne veut pas exposer SUPABASE_SERVICE_ROLE_KEY / TWILIO_* côté client.
//   - Cet endpoint s'exécute côté serveur Vercel : il lit les env vars
//     depuis process.env, les injecte dans le body, puis forward à n8n.
//   - Auth vérifiée : seuls admin/superadmin/coordonnateur peuvent appeler.
//
// Body attendu :
//   {
//     "path": "riusc-envoi-ciblage-portail" | "riusc-envoi-mobilisation-portail",
//     "payload": { ... les données originales du payload n8n ... }
//   }
//
// Réponse : passe-through de la réponse n8n, avec le même status code.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_BASE_URL || 'https://n8n.aqbrs.ca'

// Whitelist des chemins autorisés pour éviter qu'un admin malicieux tape
// n'importe quel webhook interne.
const ALLOWED_PATHS = new Set([
  'riusc-envoi-ciblage-portail',
  'riusc-envoi-mobilisation-portail',
])

export async function POST(req: NextRequest) {
  // Auth admin
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: res } = await supabaseAdmin
    .from('reservistes').select('role').eq('user_id', user.id).single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Parse body
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }
  const path: string = body.path
  const payload: Record<string, any> = body.payload || {}
  if (!path || !ALLOWED_PATHS.has(path)) {
    return NextResponse.json({ error: 'Path webhook non autorisé' }, { status: 400 })
  }

  // Injecter les clés serveur dans le payload avant de forward
  const enrichedPayload = {
    ...payload,
    supa_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    twilio_sid: process.env.TWILIO_ACCOUNT_SID,
    twilio_token: process.env.TWILIO_AUTH_TOKEN,
  }

  try {
    const n8nRes = await fetch(`${N8N_BASE_URL}/webhook/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    })
    const text = await n8nRes.text()
    // Essaie de parser comme JSON, sinon retourne le texte brut
    let jsonBody: any
    try { jsonBody = JSON.parse(text) } catch { jsonBody = { raw: text } }
    return NextResponse.json(jsonBody, { status: n8nRes.status })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erreur connexion n8n', detail: err?.message },
      { status: 502 }
    )
  }
}
