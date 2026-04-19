// app/api/admin/courriels/backfill-attachments/route.ts
// Backfill des pieces_jointes pour les courriels_reponses qui ont un resend_email_id
// mais dont les attachments sont vides. Utile pour les courriels recus AVANT le fix du webhook.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierRole() {
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
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return res
}

export async function POST(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await req.json().catch(() => ({ id: null }))
  if (!id) return NextResponse.json({ error: 'id de courriel_reponse requis' }, { status: 400 })

  // Charger la réponse
  const { data: rep, error: repErr } = await supabaseAdmin
    .from('courriel_reponses')
    .select('id, resend_email_id, pieces_jointes')
    .eq('id', id)
    .single()

  if (repErr || !rep) {
    return NextResponse.json({ error: 'Réponse introuvable' }, { status: 404 })
  }
  if (!rep.resend_email_id) {
    return NextResponse.json({ error: 'resend_email_id manquant' }, { status: 400 })
  }

  // Fetch les attachments via Resend API
  const attResp = await fetch(`https://api.resend.com/emails/receiving/${rep.resend_email_id}/attachments`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })

  if (!attResp.ok) {
    const errText = await attResp.text().catch(() => '')
    return NextResponse.json({
      error: `Resend API HTTP ${attResp.status}`,
      details: errText.slice(0, 500),
    }, { status: 500 })
  }

  const attData = await attResp.json()
  const list = attData.data || attData.attachments || attData || []
  if (!Array.isArray(list)) {
    return NextResponse.json({ error: 'Réponse Resend non-tableau', raw: attData }, { status: 500 })
  }

  const piecesJointes = list.map((att: any) => ({
    id: att.id,
    filename: att.filename,
    content_type: att.content_type,
  }))

  // Update la ligne
  const { error: updErr } = await supabaseAdmin
    .from('courriel_reponses')
    .update({ pieces_jointes: piecesJointes })
    .eq('id', id)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    updated_id: id,
    nb_attachments: piecesJointes.length,
    pieces_jointes: piecesJointes,
  })
}
