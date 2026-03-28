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
  inscrits: number
  informe_absence: number | null
  attendues: number | null
  no_show: number | null
  qualifie: number | null
  passe: boolean
}

export async function GET() {
  try {
    const { data: reservistes, error } = await supabase
      .from('reservistes')
      .select('benevole_id, groupe, region, antecedents_statut, monday_created_at, created_at')
      .eq('statut', 'Actif')

    if (error) throw error

    const { data: partenairesOrgs } = await supabase
      .from('reserviste_organisations')
      .select('benevole_id, organisations (nom)')

    const orgMap: Record<string, string> = {}
    for (const po of (partenairesOrgs || [])) {
      const org = (po as any).organisations?.nom || ''
      orgMap[po.benevole_id] = org
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

    // ── Qualifiés par organisme ───────────────────────────────────────────────
    const qualifies = (reservistes || []).filter(r =>
      r.groupe === 'Approuvé' || r.groupe === 'Partenaires'
    )
    const orgCounts: Record<string, number> = {}
    for (const r of qualifies) {
      const rawOrg = orgMap[r.benevole_id] || ''
      const org = rawOrg ? orgDisplayName(rawOrg) : 'AQBRS-RS'
      orgCounts[org] = (orgCounts[org] || 0) + 1
    }
    const parOrganisme = Object.entries(orgCounts)
      .map(([organisme, total]) => ({ organisme, total }))
      .sort((a, b) => b.total - a.total)

    // ── Intérêt: public vs AQBRS ──────────────────────────────────────────────
    const interetData = [
      { label: 'Public', total: (reservistes || []).filter(r => r.groupe === 'Intérêt' && !orgMap[r.benevole_id]).length },
      { label: 'AQBRS',  total: (reservistes || []).filter(r => r.groupe === 'Intérêt' && !!orgMap[r.benevole_id]).length },
    ]

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

    // ── Nouvelles inscriptions ────────────────────────────────────────────────
    const now = Date.now()
    const DAY = 86400000
    const getInscDate = (r: any): number | null => {
      const d = r.monday_created_at || r.created_at
      return d ? new Date(d).getTime() : null
    }
    const last24h = (reservistes || []).filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= DAY }).length
    const last7d  = (reservistes || []).filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= 7 * DAY }).length
    const last30d = (reservistes || []).filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= 30 * DAY }).length

    const dailyCounts: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      dailyCounts[formatDate(new Date(now - i * DAY))] = 0
    }
    for (const r of reservistes || []) {
      const d = r.monday_created_at || r.created_at
      if (!d) continue
      const day = formatDate(new Date(d))
      if (day in dailyCounts) dailyCounts[day]++
    }
    const dailyData = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))

    // ── Inscriptions camps ────────────────────────────────────────────────────
    // Données historiques hardcodées
    const CAMPS_HISTORIQUES: CampEntry[] = [
      { cohort: 6, dates: '', inscrits: 65, informe_absence: 5,  attendues: 60, no_show: 6,  qualifie: 54, passe: true },
      { cohort: 7, dates: '', inscrits: 30, informe_absence: 3,  attendues: 27, no_show: 9,  qualifie: 19, passe: true },
      { cohort: 8, dates: '', inscrits: 75, informe_absence: 14, attendues: 61, no_show: 13, qualifie: 47, passe: true },
    ]

    // Camps futurs depuis DB (inscrits seulement)
    const { data: campsRaw } = await supabase
      .from('inscriptions_camps')
      .select('camp_nom, camp_dates, session_id')

    const futurMap: Record<string, { cohort: number; dates: string; inscrits: number }> = {}
    for (const c of campsRaw || []) {
      const cohortNum = extractCohort(c.camp_nom || '')
      if (CAMPS_HISTORIQUES.some(h => h.cohort === cohortNum)) continue
      const key = c.session_id || c.camp_nom || 'inconnu'
      if (!futurMap[key]) futurMap[key] = { cohort: cohortNum, dates: c.camp_dates || '—', inscrits: 0 }
      futurMap[key].inscrits++
    }

    const campsFuturs: CampEntry[] = Object.values(futurMap).map(f => ({
      cohort: f.cohort, dates: f.dates, inscrits: f.inscrits,
      informe_absence: null, attendues: null, no_show: null, qualifie: null,
      passe: false,
    }))

    const campsData = [...CAMPS_HISTORIQUES, ...campsFuturs]
      .sort((a, b) => a.cohort - b.cohort)

    return NextResponse.json({
      totalInscrits:    reservistes?.length || 0,
      totalInteret:     groupeCounts['Intérêt']     || 0,
      totalApprouves:   groupeCounts['Approuvé']    || 0,
      totalPartenaires: groupeCounts['Partenaires'] || 0,
      parOrganisme,
      interetData,
      parRegionApprouves,
      parRegionInteret,
      antecedentsData,
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
