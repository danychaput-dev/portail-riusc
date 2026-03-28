// app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const revalidate = 300 // cache 5 min pour les nouvelles inscriptions

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
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

    // Organisme display name
    const orgDisplayName = (org: string): string => {
      if (org.includes('SOPFEU')) return 'SOPFEU'
      if (org.includes('Croix-Rouge')) return 'Croix-Rouge'
      if (org.includes('MSP')) return 'MSP'
      return org
    }

    // ── 1. Répartition par groupe ─────────────────────────────────────────────
    const groupeOrder = ['Intérêt', 'Approuvé', 'Partenaires']
    const groupeCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      const g = r.groupe || 'Autre'
      groupeCounts[g] = (groupeCounts[g] || 0) + 1
    }
    const parGroupe = groupeOrder
      .filter(g => groupeCounts[g])
      .map(groupe => ({ groupe, total: groupeCounts[groupe] }))

    // ── 2. Qualifiés par organisme ────────────────────────────────────────────
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

    // ── 3. Intérêt: public vs AQBRS ──────────────────────────────────────────
    const interetPublic = (reservistes || []).filter(r =>
      r.groupe === 'Intérêt' && !orgMap[r.benevole_id]
    ).length
    const interetAQBRS = (reservistes || []).filter(r =>
      r.groupe === 'Intérêt' && !!orgMap[r.benevole_id]
    ).length
    const interetData = [
      { label: 'Public', total: interetPublic },
      { label: 'AQBRS', total: interetAQBRS },
    ]

    // ── 4. Répartition géographique ───────────────────────────────────────────
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

    // ── 5. Antécédents judiciaires — Approuvés seulement ─────────────────────
    const antecedentsCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      if (r.groupe !== 'Approuvé') continue
      const s = r.antecedents_statut || 'en_attente'
      antecedentsCounts[s] = (antecedentsCounts[s] || 0) + 1
    }
    const antecedentsData = Object.entries(antecedentsCounts)
      .map(([statut, total]) => ({ statut, total }))

    // ── 6. Nouvelles inscriptions ─────────────────────────────────────────────
    const now = Date.now()
    const DAY = 86400000
    const getInscDate = (r: any): number | null => {
      const d = r.monday_created_at || r.created_at
      return d ? new Date(d).getTime() : null
    }
    const last24h  = (reservistes || []).filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= DAY }).length
    const last7d   = (reservistes || []).filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= 7 * DAY }).length
    const last30d  = (reservistes || []).filter(r => { const t = getInscDate(r); return t !== null && (now - t) <= 30 * DAY }).length

    // Sparkline 30 jours
    const dailyCounts: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * DAY)
      dailyCounts[formatDate(d)] = 0
    }
    for (const r of reservistes || []) {
      const d = r.monday_created_at || r.created_at
      if (!d) continue
      const day = formatDate(new Date(d))
      if (day in dailyCounts) dailyCounts[day]++
    }
    const dailyData = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))

    // ── 7. Inscriptions camps ─────────────────────────────────────────────────
    const { data: campsRaw } = await supabase
      .from('inscriptions_camps')
      .select('camp_nom, camp_dates, camp_lieu, session_id, presence')

    const campMap: Record<string, { nom: string; dates: string; lieu: string; confirmes: number; total: number }> = {}
    for (const c of campsRaw || []) {
      const key = c.session_id || c.camp_nom
      if (!campMap[key]) {
        campMap[key] = { nom: c.camp_nom || '—', dates: c.camp_dates || '—', lieu: c.camp_lieu || '—', confirmes: 0, total: 0 }
      }
      campMap[key].total++
      if (c.presence === 'confirme') campMap[key].confirmes++
    }
    const campsData = Object.values(campMap).sort((a, b) => a.nom.localeCompare(b.nom))

    // ── Totaux ────────────────────────────────────────────────────────────────
    return NextResponse.json({
      totalInscrits:    reservistes?.length || 0,
      totalInteret:     groupeCounts['Intérêt']     || 0,
      totalApprouves:   groupeCounts['Approuvé']    || 0,
      totalPartenaires: groupeCounts['Partenaires'] || 0,
      parGroupe,
      parOrganisme,
      interetData,
      parRegionApprouves,
      parRegionInteret,
      antecedentsData,
      last24h,
      last7d,
      last30d,
      dailyData,
      campsData,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
