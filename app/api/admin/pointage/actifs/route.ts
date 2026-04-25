// app/api/admin/pointage/actifs/route.ts
//
// GET — Liste des réservistes actuellement pointés (heure_depart IS NULL,
// statut != 'annule') sur des sessions QR actives (non archivées).
//
// Filtré pour ne retourner que les réservistes en groupe 'Approuvé' ou 'Intérêt'
// (pour aligner avec le compteur supervising_count de /api/punch/on-duty).
//
// Retour:
//   {
//     actifs: [
//       { pointage_id, benevole_id, prenom, nom, groupe, heure_arrivee,
//         duree_minutes, session_id, contexte_nom, titre, date_shift, shift }
//     ],
//     sessions: [{ id, contexte_nom, titre, date_shift, shift, nb_actifs }]
//   }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

export async function GET(_req: NextRequest) {
  const role = await verifierRole()
  if (!role) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // 1. Sessions actives (non archivées)
  const { data: sessionsActives } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id, contexte_nom, titre, date_shift, shift')
    .eq('actif', true)
    .is('archived_at', null)

  if (!sessionsActives || sessionsActives.length === 0) {
    return NextResponse.json({ actifs: [], sessions: [] })
  }

  const sessIds = sessionsActives.map((s: any) => s.id)

  // 2. Pointages ouverts dans ces sessions
  const { data: pointages } = await supabaseAdmin
    .from('pointages')
    .select('id, benevole_id, heure_arrivee, pointage_session_id')
    .in('pointage_session_id', sessIds)
    .is('heure_depart', null)
    .neq('statut', 'annule')
    .order('heure_arrivee', { ascending: false })

  if (!pointages || pointages.length === 0) {
    const sessionsAvecCounts = sessionsActives.map((s: any) => ({ ...s, nb_actifs: 0 }))
    return NextResponse.json({ actifs: [], sessions: sessionsAvecCounts })
  }

  // 3. Charger les réservistes correspondants, filtrés sur Approuvé + Intérêt
  const benevoleIds = [...new Set(pointages.map((p: any) => p.benevole_id))]
  const { data: reservistes } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, groupe')
    .in('benevole_id', benevoleIds)
    .in('groupe', ['Approuvé', 'Intérêt'])

  const resMap: Record<string, any> = {}
  for (const r of (reservistes || [])) resMap[r.benevole_id] = r

  // 4. Map sessions pour enrichissement
  const sessMap: Record<string, any> = {}
  for (const s of sessionsActives) sessMap[(s as any).id] = s

  // 5. Construire la liste des actifs (uniquement ceux qui matchent le filtre groupe)
  const now = Date.now()
  const actifs = pointages
    .filter((p: any) => resMap[p.benevole_id])
    .map((p: any) => {
      const r = resMap[p.benevole_id]
      const s = sessMap[p.pointage_session_id]
      const dureeMin = p.heure_arrivee
        ? Math.round((now - new Date(p.heure_arrivee).getTime()) / 60000)
        : null
      return {
        pointage_id: p.id,
        benevole_id: p.benevole_id,
        prenom: r.prenom,
        nom: r.nom,
        groupe: r.groupe,
        heure_arrivee: p.heure_arrivee,
        duree_minutes: dureeMin,
        session_id: p.pointage_session_id,
        contexte_nom: s?.contexte_nom || '',
        titre: s?.titre || null,
        date_shift: s?.date_shift || null,
        shift: s?.shift || null,
      }
    })

  // 6. Compter par session pour le dropdown
  const countParSession: Record<string, number> = {}
  for (const a of actifs) {
    countParSession[a.session_id] = (countParSession[a.session_id] || 0) + 1
  }
  const sessionsAvecCounts = sessionsActives.map((s: any) => ({
    ...s,
    nb_actifs: countParSession[s.id] || 0,
  }))

  return NextResponse.json({ actifs, sessions: sessionsAvecCounts })
}
