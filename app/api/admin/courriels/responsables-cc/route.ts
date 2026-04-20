// app/api/admin/courriels/responsables-cc/route.ts
//
// POST — reçoit une liste de destinataires (benevole_ids) et retourne les
// responsables de groupes R&S à mettre en CC automatiquement.
//
// Logique :
//   1. Récupère le champ `groupe_recherche` (TEXT) de chaque destinataire
//   2. Trouve les groupes R&S dont le nom correspond (ILIKE substring)
//   3. Récupère les responsables de ces groupes avec recoit_cc_courriels=true
//   4. Exclut les responsables qui sont déjà dans les destinataires
//   5. Retourne la liste dédupliquée (une ligne par responsable, même s'il est
//      responsable de plusieurs groupes représentés)

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
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
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

export async function POST(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const benevoleIds: string[] = Array.isArray(body?.benevole_ids) ? body.benevole_ids : []
  if (benevoleIds.length === 0) {
    return NextResponse.json({ responsables: [], groupes_representes: [] })
  }

  // 1. Récupérer les groupe_recherche (TEXT) des destinataires
  const { data: dests } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, email, groupe_recherche')
    .in('benevole_id', benevoleIds)

  if (!dests || dests.length === 0) {
    return NextResponse.json({ responsables: [], groupes_representes: [] })
  }

  // 2. Liste des textes de groupe non-vides (on va les matcher avec groupes_recherche.nom)
  const groupeTextesUniques = Array.from(new Set(
    (dests as any[])
      .map(d => (d.groupe_recherche || '').trim())
      .filter(Boolean)
  ))

  if (groupeTextesUniques.length === 0) {
    return NextResponse.json({ responsables: [], groupes_representes: [] })
  }

  // 3. Récupérer tous les groupes R&S (pas trop nombreux, tolérable)
  const { data: groupes } = await supabaseAdmin
    .from('groupes_recherche')
    .select('id, nom, district')

  const allGroupes = (groupes || []) as Array<{ id: string; nom: string; district: number }>

  // 4. Identifier les groupes qui matchent au moins un texte de destinataire.
  //    On considère qu'un groupe correspond si son nom apparaît en substring
  //    dans le texte groupe_recherche d'un destinataire (insensible à la casse).
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const groupesRepresentes = allGroupes.filter(g => {
    const gNorm = norm(g.nom)
    return groupeTextesUniques.some(t => norm(t).includes(gNorm) || gNorm.includes(norm(t)))
  })

  if (groupesRepresentes.length === 0) {
    return NextResponse.json({ responsables: [], groupes_representes: [] })
  }

  const groupeIds = groupesRepresentes.map(g => g.id)

  // 5. Récupérer les responsables de ces groupes (qui veulent recevoir les CC)
  const { data: liens } = await supabaseAdmin
    .from('groupes_recherche_responsables')
    .select('groupe_id, benevole_id, recoit_cc_courriels')
    .in('groupe_id', groupeIds)
    .eq('recoit_cc_courriels', true)

  if (!liens || liens.length === 0) {
    return NextResponse.json({
      responsables: [],
      groupes_representes: groupesRepresentes.map(g => g.nom),
    })
  }

  // 6. Récupérer les infos des responsables
  const respIds = Array.from(new Set((liens as any[]).map(l => l.benevole_id)))
  const { data: respData } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, email')
    .in('benevole_id', respIds)

  const respMap = Object.fromEntries((respData || []).map((r: any) => [r.benevole_id, r]))
  const groupeMap = Object.fromEntries(groupesRepresentes.map(g => [g.id, g]))

  // 7. Construire la liste : un responsable peut superviser plusieurs groupes
  //    représentés — on agrège ses groupes en une seule ligne par responsable.
  const agrege = new Map<string, {
    benevole_id: string
    prenom: string
    nom: string
    email: string
    groupes: Array<{ id: string; nom: string; district: number }>
  }>()
  for (const l of (liens as any[])) {
    const resp = respMap[l.benevole_id]
    if (!resp || !resp.email) continue
    // Exclure les responsables qui sont déjà dans les destinataires
    if (benevoleIds.includes(resp.benevole_id)) continue
    const g = groupeMap[l.groupe_id]
    if (!g) continue
    if (!agrege.has(resp.benevole_id)) {
      agrege.set(resp.benevole_id, {
        benevole_id: resp.benevole_id,
        prenom: resp.prenom,
        nom: resp.nom,
        email: resp.email,
        groupes: [],
      })
    }
    agrege.get(resp.benevole_id)!.groupes.push({ id: g.id, nom: g.nom, district: g.district })
  }

  return NextResponse.json({
    responsables: Array.from(agrege.values()),
    groupes_representes: groupesRepresentes.map(g => g.nom),
  })
}
