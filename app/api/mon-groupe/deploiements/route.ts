// app/api/mon-groupe/deploiements/route.ts
//
// GET — retourne les déploiements actifs où des membres des groupes de R&S
// dont l'utilisateur connecté est responsable sont ciblés.
//
// Réponse :
//   {
//     is_responsable: boolean,
//     groupes: [{ id, nom, district }],
//     deploiements: [{
//       id, nom, identifiant, lieu, date_debut, date_fin, statut,
//       membres: [{
//         benevole_id, prenom, nom, email, telephone, groupe_recherche,
//         ciblage_statut, dispos: [{ date_jour, disponible, a_confirmer }],
//         vague_id, vague_identifiant
//       }]
//     }]
//   }
//
// Service_role utilisé pour bypasser les RLS sur ciblages/disponibilités/vagues
// (le responsable n'est pas admin mais doit voir les données de ses membres).

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Récupérer le benevole_id courant
  const { data: self } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id')
    .eq('user_id', user.id)
    .single()
  if (!self) return NextResponse.json({ error: 'Profil réserviste introuvable' }, { status: 404 })

  // Trouver les groupes dont je suis responsable
  const { data: mesResponsabilites } = await supabaseAdmin
    .from('groupes_recherche_responsables')
    .select('groupe_id')
    .eq('benevole_id', self.benevole_id)

  if (!mesResponsabilites || mesResponsabilites.length === 0) {
    return NextResponse.json({
      is_responsable: false, groupes: [], deploiements: [],
    })
  }

  const groupeIds = mesResponsabilites.map((r: any) => r.groupe_id)
  const { data: groupes } = await supabaseAdmin
    .from('groupes_recherche')
    .select('id, nom, district')
    .in('id', groupeIds)

  if (!groupes || groupes.length === 0) {
    return NextResponse.json({
      is_responsable: true, groupes: [], deploiements: [],
    })
  }

  // Récupérer les membres de ces groupes
  // Note : reservistes.groupe_recherche est TEXT, potentiellement plusieurs
  // noms séparés par virgule. On utilise ILIKE %nom% — suffisant en pratique
  // mais imparfait si deux groupes partagent un mot commun (ex: "Estrie" vs
  // "Sud-Estrie"). À raffiner si le besoin se présente.
  const nomsGroupes = groupes.map((g: any) => g.nom)
  const orFilter = nomsGroupes.map(nom => `groupe_recherche.ilike.%${nom}%`).join(',')

  const { data: membres } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, email, telephone, groupe_recherche, ville, region')
    .or(orFilter)

  const membreIds = (membres || []).map((m: any) => m.benevole_id)
  if (membreIds.length === 0) {
    return NextResponse.json({
      is_responsable: true,
      groupes,
      deploiements: [],
    })
  }

  // Récupérer les ciblages actifs (non retirés) de ces membres
  const { data: ciblages } = await supabaseAdmin
    .from('ciblages')
    .select('id, benevole_id, reference_id, statut, updated_at')
    .eq('niveau', 'deploiement')
    .in('benevole_id', membreIds)
    .neq('statut', 'retire')

  if (!ciblages || ciblages.length === 0) {
    return NextResponse.json({
      is_responsable: true, groupes, deploiements: [],
    })
  }

  // Récupérer les infos des déploiements concernés (actifs seulement)
  const depIds = Array.from(new Set(ciblages.map((c: any) => c.reference_id).filter(Boolean)))
  const { data: deployments } = await supabaseAdmin
    .from('deployments')
    .select('id, identifiant, nom, lieu, date_debut, date_fin, statut')
    .in('id', depIds)
    .in('statut', ['Planifié', 'En cours', 'Actif'])

  const deployments_active = deployments || []
  const activeDepIds = deployments_active.map((d: any) => d.id)
  if (activeDepIds.length === 0) {
    return NextResponse.json({
      is_responsable: true, groupes, deploiements: [],
    })
  }

  // Disponibilités pour les membres x déploiements actifs
  const ciblagesActifs = ciblages.filter((c: any) => activeDepIds.includes(c.reference_id))
  const dispos = await supabaseAdmin
    .from('disponibilites_v2')
    .select('benevole_id, deployment_id, date_jour, disponible, a_confirmer')
    .in('deployment_id', activeDepIds)
    .in('benevole_id', membreIds)
  const disposRows = dispos.data || []

  // Assignations (qui est dans une vague)
  const assign = await supabaseAdmin
    .from('assignations')
    .select('benevole_id, vague_id')
    .in('benevole_id', membreIds)
  const assignRows = assign.data || []

  const vagueIds = Array.from(new Set(assignRows.map((a: any) => a.vague_id).filter(Boolean)))
  let vaguesRows: any[] = []
  if (vagueIds.length > 0) {
    const vgs = await supabaseAdmin
      .from('vagues')
      .select('id, identifiant, numero, deployment_id, date_debut, date_fin, statut')
      .in('id', vagueIds)
      .in('deployment_id', activeDepIds)
    vaguesRows = vgs.data || []
  }

  // Construire la réponse groupée par déploiement
  const membresMap = Object.fromEntries((membres || []).map((m: any) => [m.benevole_id, m]))
  const vaguesMap = Object.fromEntries(vaguesRows.map((v: any) => [v.id, v]))

  const result = deployments_active.map((d: any) => {
    // Ciblages sur ce déploiement
    const cibs = ciblagesActifs.filter((c: any) => c.reference_id === d.id)
    const membresDep = cibs.map((c: any) => {
      const m = membresMap[c.benevole_id]
      if (!m) return null
      const dispoMembre = disposRows.filter((x: any) =>
        x.benevole_id === c.benevole_id && x.deployment_id === d.id
      )
      // Trouver une assignation dans une vague de ce déploiement
      const assignMembre = assignRows.find((a: any) => {
        if (a.benevole_id !== c.benevole_id) return false
        const vg = vaguesMap[a.vague_id]
        return vg && vg.deployment_id === d.id
      })
      const vague = assignMembre ? vaguesMap[assignMembre.vague_id] : null
      return {
        benevole_id: m.benevole_id,
        prenom: m.prenom,
        nom: m.nom,
        email: m.email,
        telephone: m.telephone,
        ville: m.ville,
        region: m.region,
        groupe_recherche: m.groupe_recherche,
        ciblage_statut: c.statut,
        ciblage_updated_at: c.updated_at,
        dispos: dispoMembre.map((x: any) => ({
          date_jour: x.date_jour,
          disponible: x.disponible,
          a_confirmer: x.a_confirmer,
        })),
        vague_id: vague?.id || null,
        vague_identifiant: vague ? (vague.identifiant || `ROT-${vague.numero}`) : null,
        vague_statut: vague?.statut || null,
      }
    }).filter(Boolean)

    return {
      id: d.id,
      identifiant: d.identifiant,
      nom: d.nom,
      lieu: d.lieu,
      date_debut: d.date_debut,
      date_fin: d.date_fin,
      statut: d.statut,
      membres: membresDep,
    }
  })

  // Ne garder que les déploiements qui ont au moins un membre du groupe
  const deploiementsFiltres = result.filter((d: any) => d.membres.length > 0)

  return NextResponse.json({
    is_responsable: true,
    groupes,
    deploiements: deploiementsFiltres,
  })
}
