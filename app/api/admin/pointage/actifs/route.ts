// app/api/admin/pointage/actifs/route.ts
//
// GET — Données pour la page /admin/pointage. Retourne :
//
// 1. actifs : Réservistes actuellement pointés (heure_depart NULL) sur QR actifs
//    → utilisé par le bloc "👥 Personnes actuellement actives"
//
// 2. sessions : Liste des sessions QR actives avec compteurs (pour dropdown)
//
// 3. scans : Historique complet de tous les pointages (in + out) sur sessions QR
//    actives → utilisé par le bloc "Historique complet" (sort + search)
//
// 4. stats_par_jour : Agrégation par date (nb arrivées, nb départs, uniques)
//
// 5. inscrits_absents : Pour chaque date où il y a eu des scans sur un camp,
//    liste des inscrits au camp (presence != annule) qui n'ont JAMAIS scanné
//    ce jour-là.
//
// Filtre groupes : 'Approuvé' + 'Intérêt' (aligné avec /api/punch/on-duty).

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

// Convertit un timestamp en date locale Montréal (YYYY-MM-DD).
// Important parce que le serveur tourne en UTC mais on veut grouper par jour
// civil québécois (un scan à 23h45 UTC = 19h45 Montréal = même jour pas le lendemain).
function dateJourMontreal(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  // 'en-CA' retourne YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Montreal' })
}

function labelJour(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00') // midi local pour éviter les problèmes de fuseau
  return d.toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Montreal',
  })
}

export async function GET(_req: NextRequest) {
  const role = await verifierRole()
  if (!role) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // ── 1. Sessions actives (non archivées) ─────────────────────────────────
  const { data: sessionsActives } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id, contexte_nom, titre, date_shift, shift, type_contexte, session_id')
    .eq('actif', true)
    .is('archived_at', null)

  if (!sessionsActives || sessionsActives.length === 0) {
    return NextResponse.json({
      actifs: [], sessions: [], scans: [], stats_par_jour: [], inscrits_absents: [],
    })
  }

  const sessIds = sessionsActives.map((s: any) => s.id)
  const sessMap: Record<string, any> = {}
  for (const s of sessionsActives) sessMap[(s as any).id] = s

  // ── 2. TOUS les pointages sur ces sessions (in + out) ──────────────────
  const { data: pointages } = await supabaseAdmin
    .from('pointages')
    .select('id, benevole_id, heure_arrivee, heure_depart, statut, pointage_session_id')
    .in('pointage_session_id', sessIds)
    .neq('statut', 'annule')
    .order('heure_arrivee', { ascending: false })

  // ── 3. Réservistes correspondants (filtre Approuvé + Intérêt) ───────────
  const benevoleIds = [...new Set((pointages || []).map((p: any) => p.benevole_id))]
  const { data: reservistes } = benevoleIds.length > 0
    ? await supabaseAdmin
        .from('reservistes')
        .select('benevole_id, prenom, nom, groupe, email, telephone')
        .in('benevole_id', benevoleIds)
        .in('groupe', ['Approuvé', 'Intérêt'])
    : { data: [] }

  const resMap: Record<string, any> = {}
  for (const r of (reservistes || [])) resMap[(r as any).benevole_id] = r

  // ── 4. Construire scans (filtrés sur Approuvé + Intérêt) ────────────────
  const now = Date.now()
  const scans = (pointages || [])
    .filter((p: any) => resMap[p.benevole_id])
    .map((p: any) => {
      const r = resMap[p.benevole_id]
      const s = sessMap[p.pointage_session_id]
      const dureeMin =
        p.heure_arrivee && p.heure_depart
          ? Math.round(
              (new Date(p.heure_depart).getTime() - new Date(p.heure_arrivee).getTime()) / 60000
            )
          : p.heure_arrivee
          ? Math.round((now - new Date(p.heure_arrivee).getTime()) / 60000)
          : null
      return {
        pointage_id: p.id,
        benevole_id: p.benevole_id,
        prenom: r.prenom,
        nom: r.nom,
        groupe: r.groupe,
        heure_arrivee: p.heure_arrivee,
        heure_depart: p.heure_depart,
        duree_minutes: dureeMin,
        en_cours: !p.heure_depart,
        session_id: p.pointage_session_id,
        contexte_nom: s?.contexte_nom || '',
        titre: s?.titre || null,
        type_contexte: s?.type_contexte || null,
        date_shift: s?.date_shift || null,
        shift: s?.shift || null,
        date_jour: dateJourMontreal(p.heure_arrivee),
      }
    })

  // ── 5. Actifs (subset des scans : en_cours seulement) ───────────────────
  const actifs = scans
    .filter((s: any) => s.en_cours)
    .map((s: any) => ({
      pointage_id: s.pointage_id,
      benevole_id: s.benevole_id,
      prenom: s.prenom,
      nom: s.nom,
      groupe: s.groupe,
      heure_arrivee: s.heure_arrivee,
      duree_minutes: s.duree_minutes,
      session_id: s.session_id,
      contexte_nom: s.contexte_nom,
      titre: s.titre,
      date_shift: s.date_shift,
      shift: s.shift,
    }))

  const countParSession: Record<string, number> = {}
  for (const a of actifs) {
    countParSession[a.session_id] = (countParSession[a.session_id] || 0) + 1
  }
  const sessionsAvecCounts = sessionsActives.map((s: any) => ({
    ...s,
    nb_actifs: countParSession[s.id] || 0,
  }))

  // ── 6. Stats par jour ───────────────────────────────────────────────────
  const statsMap: Record<
    string,
    { date_jour: string; nb_arrivees: number; nb_departs: number; uniques: Set<string> }
  > = {}
  for (const sc of scans) {
    const j = sc.date_jour
    if (!j) continue
    if (!statsMap[j]) {
      statsMap[j] = { date_jour: j, nb_arrivees: 0, nb_departs: 0, uniques: new Set() }
    }
    statsMap[j].nb_arrivees += 1
    statsMap[j].uniques.add(sc.benevole_id)
    if (sc.heure_depart) statsMap[j].nb_departs += 1
  }
  const stats_par_jour = Object.values(statsMap)
    .map((s) => ({
      date_jour: s.date_jour,
      label: labelJour(s.date_jour),
      nb_arrivees: s.nb_arrivees,
      nb_departs: s.nb_departs,
      nb_uniques: s.uniques.size,
    }))
    .sort((a, b) => (a.date_jour < b.date_jour ? -1 : 1))

  // ── 7. Inscrits absents par jour (uniquement pour sessions de type 'camp') ─
  // Pour chaque date où il y a eu des scans sur des QR de type camp, on regarde
  // les inscriptions au camp correspondant et on liste ceux qui n'ont aucun
  // pointage ce jour-là.
  const sessionsCamp = sessionsActives.filter((s: any) => s.type_contexte === 'camp')
  const campSessionIdsText = [...new Set(sessionsCamp.map((s: any) => s.session_id).filter(Boolean))]

  let inscrits_absents: any[] = []
  if (campSessionIdsText.length > 0 && stats_par_jour.length > 0) {
    // Charger inscriptions actives (presence != annule) pour ces camps
    const { data: inscriptions } = await supabaseAdmin
      .from('inscriptions_camps')
      .select('benevole_id, session_id, presence')
      .in('session_id', campSessionIdsText)
      .neq('presence', 'annule')

    const inscritIds = [...new Set((inscriptions || []).map((i: any) => i.benevole_id))]
    const { data: inscritsRes } = inscritIds.length > 0
      ? await supabaseAdmin
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, telephone, groupe')
          .in('benevole_id', inscritIds)
      : { data: [] }
    const inscritsMap: Record<string, any> = {}
    for (const r of (inscritsRes || [])) inscritsMap[(r as any).benevole_id] = r

    // Pour chaque jour avec scans, identifier qui était inscrit mais n'a pas scanné
    for (const stat of stats_par_jour) {
      // benevole_ids qui ONT scanné ce jour-là
      const scannesCeJour = new Set(
        scans.filter((sc: any) => sc.date_jour === stat.date_jour).map((sc: any) => sc.benevole_id)
      )
      // inscrits non scannés
      const absents = (inscriptions || [])
        .filter((i: any) => !scannesCeJour.has(i.benevole_id))
        .map((i: any) => inscritsMap[i.benevole_id])
        .filter(Boolean)
        // Dédupliquer (un réserviste peut être inscrit à plusieurs camps)
        .reduce((acc: any[], r: any) => {
          if (!acc.find((x: any) => x.benevole_id === r.benevole_id)) acc.push(r)
          return acc
        }, [])
        .sort((a: any, b: any) => (a.nom || '').localeCompare(b.nom || ''))

      if (absents.length > 0) {
        inscrits_absents.push({
          date_jour: stat.date_jour,
          label: stat.label,
          nb_absents: absents.length,
          reservistes: absents,
        })
      }
    }
  }

  return NextResponse.json({
    actifs,
    sessions: sessionsAvecCounts,
    scans,
    stats_par_jour,
    inscrits_absents,
  })
}
