// app/api/camp/rappel-sms/route.ts
// Envoi de SMS de rappel aux participants d'un camp via n8n → Twilio
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { n8nUrl } from '@/utils/n8n'

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
  if (!res || !['admin', 'coordonnateur'].includes(res.role)) return null
  return res
}

function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export async function POST(req: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { session_id, message } = await req.json()
  if (!session_id || !message) {
    return NextResponse.json({ error: 'session_id et message requis' }, { status: 400 })
  }

  // Chercher les inscrits confirmés pour ce camp
  const { data: inscriptions, error: errInsc } = await supabaseAdmin
    .from('inscriptions_camps')
    .select('id, benevole_id, prenom_nom, telephone, camp_nom, camp_dates, camp_lieu')
    .eq('session_id', session_id)
    .in('presence', ['confirme', 'incertain'])

  if (errInsc) return NextResponse.json({ error: errInsc.message }, { status: 500 })
  if (!inscriptions?.length) return NextResponse.json({ error: 'Aucun inscrit trouvé' }, { status: 404 })

  // Filtrer ceux qui ont un téléphone valide
  const destinataires = inscriptions
    .map(i => ({ ...i, tel_e164: toE164(i.telephone || '') }))
    .filter(i => i.tel_e164)

  if (!destinataires.length) {
    return NextResponse.json({ error: 'Aucun inscrit avec un téléphone valide' }, { status: 404 })
  }

  // Insérer les rappels dans la table de suivi
  const rappels = destinataires.map(d => ({
    inscription_id: d.id,
    benevole_id: d.benevole_id,
    session_id,
    telephone: d.tel_e164,
    message_envoye: message
      .replace('{prenom}', (d.prenom_nom || '').split(' ')[0])
      .replace('{camp}', d.camp_nom || '')
      .replace('{dates}', d.camp_dates || '')
      .replace('{lieu}', d.camp_lieu || ''),
  }))

  const { data: inserted, error: errInsert } = await supabaseAdmin
    .from('rappels_camps')
    .insert(rappels)
    .select('id, benevole_id, telephone, message_envoye, prenom_nom:inscription_id')

  if (errInsert) return NextResponse.json({ error: errInsert.message }, { status: 500 })

  // Envoyer à n8n pour dispatch Twilio
  try {
    await fetch(n8nUrl('/webhook/riusc-rappel-camp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id,
        rappels: destinataires.map(d => ({
          telephone: d.tel_e164,
          message: message
            .replace('{prenom}', (d.prenom_nom || '').split(' ')[0])
            .replace('{camp}', d.camp_nom || '')
            .replace('{dates}', d.camp_dates || '')
            .replace('{lieu}', d.camp_lieu || ''),
        })),
      }),
    })
  } catch (e) {
    console.error('n8n rappel-camp error:', e)
  }

  return NextResponse.json({
    success: true,
    nb_envoyes: destinataires.length,
    nb_sans_telephone: inscriptions.length - destinataires.length,
  })
}
