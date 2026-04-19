// app/api/admin/operations/dispos/route.ts
// Retourne les dispos + ciblages pour un déploiement admin.
// Bypass RLS via service_role. Vérifie que l'appelant est admin.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(res.role)) return null
  return res
}

export async function GET(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const depId = searchParams.get('dep')
  const full = searchParams.get('full') === '1'
  if (!depId) return NextResponse.json({ error: 'dep manquant' }, { status: 400 })

  // Ciblages du déploiement (non retirés)
  const { data: ciblages, error: cibErr } = await supabaseAdmin
    .from('ciblages')
    .select('id, benevole_id, statut, updated_at')
    .eq('niveau', 'deploiement')
    .eq('reference_id', depId)
    .neq('statut', 'retire')
  if (cibErr) return NextResponse.json({ error: cibErr.message }, { status: 500 })

  // Réservistes correspondants (basic ou full selon ?full=1)
  const benevoleIds = (ciblages || []).map(c => c.benevole_id).filter((x): x is string => !!x)
  let reservistes: any[] = []
  if (benevoleIds.length > 0) {
    const cols = full
      ? 'benevole_id, prenom, nom, email, telephone, ville, region, latitude, longitude, competence_rs, certificat_premiers_soins, vehicule_tout_terrain, navire_marin, permis_conduire, satp_drone, equipe_canine, competences_securite, competences_sauvetage, communication, cartographie_sig, operation_urgence'
      : 'benevole_id, prenom, nom, email, telephone'
    const { data: resData, error: resErr } = await supabaseAdmin
      .from('reservistes')
      .select(cols)
      .in('benevole_id', benevoleIds)
    if (resErr) return NextResponse.json({ error: resErr.message }, { status: 500 })
    reservistes = (resData || []) as any
  }

  // Disponibilités du déploiement
  const { data: dispos, error: dispErr } = await supabaseAdmin
    .from('disponibilites_v2')
    .select('id, benevole_id, date_jour, disponible, a_confirmer, commentaire, transport, created_at')
    .eq('deployment_id', depId)
    .order('date_jour')
  if (dispErr) return NextResponse.json({ error: dispErr.message }, { status: 500 })

  return NextResponse.json({
    ciblages: ciblages || [],
    reservistes,
    dispos: dispos || [],
  })
}
