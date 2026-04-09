// app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const revalidate = 300

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function extractCohort(nom: string): number {
  const m = nom.match(/(\d+)/);
  return m ? parseInt(m[1]) : 999;
}

interface CampEntry {
  cohort: number
  dates: string
  ville?: string
  inscrits: number
  annule: number | null
  informe_absence: number | null
  attendues: number | null
  no_show: number | null
  qualifie: number | null
  passe: boolean
  session_id?: string
}

export async function GET() {
  try {
    const { data: reservistes, error } = await supabase
      .from('reservistes')
      .select('benevole_id, groupe, region, antecedents_statut, monday_created_at, created_at, remboursement_bottes_date')
      .eq('statut', 'Actif')
      .not('nom', 'is', null)
      .neq('nom', '')

    if (error) throw error

    // Compteurs exacts via COUNT SQL (pas affectés par la limite de 1000 lignes)
    const baseFilter = () => supabase.from('reservistes').select('id', { count: 'exact', head: true }).eq('statut', 'Actif').not('nom', 'is', null).neq('nom', '')
    const [cntApprouves, cntInteret, cntPartenaires] = await Promise.all([
      baseFilter().eq('groupe', 'Approuvé'),
      baseFilter().eq('groupe', 'Intérêt'),
      baseFilter().eq('groupe', 'Partenaires'),
    ])
    const exactApprouves   = cntApprouves.count || 0
    const exactInteret     = cntInteret.count || 0
    const exactPartenaires = cntPartenaires.count || 0
    const exactReservistes = exactApprouves + exactInteret
    const exactRIUSC       = exactApprouves + exactInteret + exactPartenaires

    const { data: partenairesOrgs } = await supabase
      .from('reserviste_organisations')
      .select('benevole_id, organisations (nom)')

    // orgMapAll : toutes les orgs par personne (plusieurs possibles)
    const orgMapAll: Record<string, string[]> = {}
    for (const po of (partenairesOrgs || [])) {
      const org = (po as any).organisations?.nom || ''
      if (!org) continue
      if (!orgMapAll[po.benevole_id]) orgMapAll[po.benevole_id] = []
      orgMapAll[po.benevole_id].push(org)
    }

    // orgMap : org principale (AQBRS prioritaire)
    const orgMap: Record<string, string> = {}
    for (const [benevoleId, orgs] of Object.entries(orgMapAll)) {
      const hasAQBRS = orgs.some(o => o.includes('AQBRS'))
      orgMap[benevoleId] = hasAQBRS
        ? orgs.find(o => o.includes('AQBRS'))!
        : orgs[0]
    }

    const orgDisplayName = (org: string): string => {
      if (org.includes('SOPFEU')) return 'SOPFEU'
      if (org.includes('Croix-Rouge')) return 'Croix-Rouge'
      if (org.includes('MSP')) return 'MSP'
      return org
    }

    // ── Répartition par groupe ────────────────────────────────────────────────
    const groupeOrder = ['Intérêt', 'Approuvé', 'Partenaires']
    const groupeCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      const g = r.groupe || 'Autre'
      groupeCounts[g] = (groupeCounts[g] || 0) + 1
    }

    // ── Réservistes qualifiés (Approuvés) par organisme ─────────────────────
    // Inclut aussi les Partenaires avec AQBRS comme org principale
    const approuvesOrgCounts: Record<string, number> = {}
    for (const r of (reservistes || [])) {
      const rawOrg = orgMap[r.benevole_id] || ''
      const isAQBRS = rawOrg.includes('AQBRS')

      if (r.groupe === 'Approuvé') {
        let org: string
        if (!rawOrg) org = 'Réservistes sans groupe assigné'
        else if (isAQBRS) org = 'Membres AQBRS Recherche et Sauvetage'
        else org = orgDisplayName(rawOrg)
        approuvesOrgCounts[org] = (approuvesOrgCounts[org] || 0) + 1
      } else if (r.groupe === 'Partenaires' && isAQBRS) {
        // Partenaire avec AQBRS → affiché dans section Réservistes qualifiés
        approuvesOrgCounts['Membres AQBRS Recherche et Sauvetage'] =
          (approuvesOrgCounts['Membres AQBRS Recherche et Sauvetage'] || 0) + 1
      }
    }
    const reservistesQualifies = Object.entries(approuvesOrgCounts)
      .map(([organisme, total]) => ({ organisme, total }))
      .sort((a, b) => b.total - a.total)

    // ── Partenaires : regroupés par organisme (excl. ceux avec AQBRS) ─────────
    const partOrgCounts: Record<string, number> = {}
    for (const r of (reservistes || []).filter(r => r.groupe === 'Partenaires')) {
      const rawOrg = orgMap[r.benevole_id] || ''
      if (rawOrg.includes('AQBRS')) continue // déjà dans section AQBRS
      const org = orgDisplayName(rawOrg) || 'Autre'
      partOrgCounts[org] = (partOrgCounts[org] || 0) + 1
    }
    const partenairesOrganismes = Object.entries(partOrgCounts)
      .map(([organisme, total]) => ({ organisme, total }))
      .sort((a, b) => b.total - a.total)

    const parOrganisme = [...reservistesQualifies, ...partenairesOrganismes]

    // ── Intérêt: public vs membres d'un organisme ─────────────────────────────
    const interetData = [
      { label: 'Public', total: (reservistes || []).filter(r => r.groupe === 'Intérêt' && !orgMap[r.benevole_id]).length },
      { label: 'AQBRS',  total: (reservistes || []).filter(r => r.groupe === 'Intérêt' && (orgMap[r.benevole_id] || '').includes('AQBRS')).length },
      { label: 'Autres organismes', total: (reservistes || []).filter(r => r.groupe === 'Intérêt' && !!orgMap[r.benevole_id] && !(orgMap[r.benevole_id] || '').includes('AQBRS')).length },
    ].filter(d => d.total > 0)

    // ── Répartition géographique ──────────────────────────────────────────────
    const buildRegionData = (groupe: string) => {
      const counts: Record<string, number> = {}
      for (const r of reservistes || []) {
        if (!r.region || r.groupe !== groupe) continue
        counts[r.region] = (counts[r.region] || 0) + 1
      }
      return Object.entries(counts)
        .map(([region, total]) => ({ region, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15)
    }
    const parRegionApprouves = buildRegionData('Approuvé')
    const parRegionInteret   = buildRegionData('Intérêt')

    // ── Antécédents — Approuvés seulement ─────────────────────────────────────
    const antecedentsCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      if (r.groupe !== 'Approuvé') continue
      const s = r.antecedents_statut || 'en_attente'
      antecedentsCounts[s] = (antecedentsCounts[s] || 0) + 1
    }
    const antecedentsData = Object.entries(antecedentsCounts)
      .map(([statut, total]) => ({ statut, total }))

    // ── Bottes — Approuvés seulement ──────────────────────────────────────────
    const approuvesOnly = (reservistes || []).filter(r => r.groupe === 'Approuvé')
    const avecBottes = approuvesOnly.filter(r => !!r.remboursement_bottes_date).length
    const sansBottes = approuvesOnly.length - avecBottes
    const bottesData = [
      { label: 'Avec bottes', total: avecBottes },
      { label: 'Sans bottes', total: sansBottes },
    ]

    // ── Nouvelles inscriptions ────────────────────────────────────────────────
    const now = Date.now()
    const DAY = 86400000
    const getInscDate = (r: any): number | null => {
      const d = r.monday_created_at || r.created_at
      return d ? new Date(d).getTime() : null
    }
    // Exclure "Retrait temporaire" des compteurs d'inscription
    const reservistesSansRetrait = (reservistes || []).filter(r => r.groupe !== 'Retrait temporaire')
    const last24h = reservistesSansRetrait.filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= DAY }).length
    const last7d  = reservistesSansRetrait.filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= 7 * DAY }).length
    const last30d = reservistesSansRetrait.filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= 30 * DAY }).length

    const dailyCounts: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      dailyCounts[formatDate(new Date(now - i * DAY))] = 0
    }
    for (const r of reservistesSansRetrait) {
      const d = r.monday_created_at || r.created_at
      if (!d) continue
      const day = formatDate(new Date(d))
      if (day in dailyCounts) dailyCounts[day]++
    }
    const dailyData = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))

    // ── Inscriptions camps ────────────────────────────────────────────────────
    // Données historiques hardcodées
    const CAMPS_HISTORIQUES: CampEntry[] = [
      { cohort: 6, dates: '31 jan – 1er fév 2026', ville: 'Laval',            inscrits: 65, annule: 0, informe_absence: 5,  attendues: 60, no_show: 6,  qualifie: 54, passe: true },
      { cohort: 7, dates: '21–22 fév 2026',        ville: 'Trois-Rivières',   inscrits: 30, annule: 0, informe_absence: 3,  attendues: 27, no_show: 9,  qualifie: 19, passe: true },
      { cohort: 8, dates: '14–15 mars 2026',        ville: 'Sainte-Catherine', inscrits: 75, annule: 0, informe_absence: 14, attendues: 61, no_show: 13, qualifie: 47, passe: true },
    ]

    // Camps futurs depuis DB (tous sauf Retrait temporaire)
    const { data: campsRaw } = await supabase
      .from('inscriptions_camps')
      .select('benevole_id, camp_nom, camp_dates, camp_lieu, session_id, presence')

    // Set des benevole_id actifs (hors Retrait temporaire) pour filtrer les inscriptions
    const activeIds = new Set(reservistesSansRetrait.map(r => r.benevole_id))

    // Grouper par session_id uniquement (ignore les variations de camp_lieu)
    // Pour la ville, extraire depuis camp_nom (ex: "Cohorte 10 - Camp de qualification - Québec")
    const extractVille = (nom: string): string => {
      const parts = nom.split(' - ')
      return parts.length >= 3 ? parts[parts.length - 1].trim() : '—'
    }

    const futurMap: Record<string, { cohort: number; dates: string; ville: string; inscrits: number; annule: number }> = {}
    for (const c of campsRaw || []) {
      if (!activeIds.has(c.benevole_id)) continue
      const cohortNum = extractCohort(c.camp_nom || '')
      if (CAMPS_HISTORIQUES.some(h => h.cohort === cohortNum)) continue
      const key = c.session_id || 'inconnu'
      if (!futurMap[key]) {
        futurMap[key] = {
          cohort: cohortNum,
          dates: c.camp_dates || '—',
          ville: extractVille(c.camp_nom || ''),
          inscrits: 0,
          annule: 0,
        }
      }
      if (c.presence === 'annule') {
        futurMap[key].annule++
      } else {
        futurMap[key].inscrits++
      }
    }

    const campsFuturs: CampEntry[] = Object.entries(futurMap).map(([sessionId, f]) => ({
      cohort: f.cohort, dates: f.dates, ville: f.ville, inscrits: f.inscrits,
      annule: f.annule, informe_absence: null, attendues: null, no_show: null, qualifie: null,
      passe: false,
      session_id: sessionId,
    }))

    const campsData = [...CAMPS_HISTORIQUES, ...campsFuturs]
      .sort((a, b) => a.cohort - b.cohort)

    return NextResponse.json({
      totalReservistes: exactReservistes,
      totalRIUSC:      exactRIUSC,
      totalInteret:     exactInteret,
      totalApprouves:   exactApprouves,
      totalPartenaires: exactPartenaires,
      parOrganisme,
      reservistesQualifies,
      partenairesOrganismes,
      interetData,
      parRegionApprouves,
      parRegionInteret,
      antecedentsData,
      bottesData,
      last24h, last7d, last30d,
      dailyData,
      campsData,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
