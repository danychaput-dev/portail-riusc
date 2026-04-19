// app/api/admin/operations/deployables-autres/route.ts
// Retourne tous les reservistes deployables qui ne sont PAS cibles dans ce deployment
// Utile pour envoyer un courriel d'info aux autres deployables (ex: annulation, statut global)

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

export async function GET(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const depId = searchParams.get('dep')
  if (!depId) return NextResponse.json({ error: 'dep manquant' }, { status: 400 })

  // 1) Ids des reservistes cibles dans ce deployment
  const { data: cibData, error: cibErr } = await supabaseAdmin
    .from('ciblages')
    .select('benevole_id')
    .eq('niveau', 'deploiement')
    .eq('reference_id', depId)
    .neq('statut', 'retire')
  if (cibErr) return NextResponse.json({ error: cibErr.message }, { status: 500 })
  const cibIds = new Set((cibData || []).map(c => c.benevole_id).filter(Boolean))

  // 2) Tous les reservistes actifs avec les champs pour computer deployable
  const { data: resList, error: resErr } = await supabaseAdmin
    .from('reservistes_actifs')
    .select('benevole_id, prenom, nom, email, telephone, date_naissance, adresse, ville, region, contact_urgence_nom, contact_urgence_telephone, camp_qualif_complete, antecedents_statut, antecedents_date_expiration, groupe, statut')
    .range(0, 4999)
  if (resErr) return NextResponse.json({ error: resErr.message }, { status: 500 })

  // 3) Formations pour detecter initiation_sc_completee
  const { data: formations } = await supabaseAdmin
    .from('formations_benevoles')
    .select('benevole_id, initiation_sc_completee, deleted_at')
    .is('deleted_at', null)
    .eq('initiation_sc_completee', true)
  const initiationCompleteIds = new Set((formations || []).map((f: any) => f.benevole_id))

  const now = new Date()
  const deployables = (resList || []).filter((r: any) => {
    // Exclure ceux cibles dans ce deployment
    if (cibIds.has(r.benevole_id)) return false
    // Doit avoir email pour recevoir courriel
    if (!r.email) return false
    // Profil complet
    const profilComplet = !!(
      r.prenom && r.nom && r.email && r.telephone &&
      r.date_naissance && r.adresse && r.ville && r.region &&
      r.contact_urgence_nom && r.contact_urgence_telephone
    )
    if (!profilComplet) return false
    // Formations
    if (!initiationCompleteIds.has(r.benevole_id)) return false
    if (r.camp_qualif_complete !== true) return false
    // Antécédents
    const antExpire = r.antecedents_date_expiration && new Date(r.antecedents_date_expiration) < now
    const antOk = r.antecedents_statut === 'verifie' && !antExpire
    if (!antOk) return false
    return true
  })

  return NextResponse.json({
    total_deployables: deployables.length,
    deployables: deployables.map((r: any) => ({
      benevole_id: r.benevole_id,
      email: r.email,
      prenom: r.prenom,
      nom: r.nom,
    })),
  })
}
