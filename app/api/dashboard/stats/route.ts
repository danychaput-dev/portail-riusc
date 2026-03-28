// app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const revalidate = 3600 // cache 1h

export async function GET() {
  try {
    const { data: reservistes, error } = await supabase
      .from('reservistes')
      .select('benevole_id, groupe, region, antecedents_statut')
      .eq('statut', 'Actif')

    if (error) throw error

    const { data: partenairesOrgs } = await supabase
      .from('reserviste_organisations')
      .select('benevole_id, organisations (nom)')

    const orgMap: Record<string, string> = {}
    for (const po of (partenairesOrgs || [])) {
      const org = (po as any).organisations?.nom || ''
      if (org.includes('SOPFEU')) orgMap[po.benevole_id] = 'SOPFEU'
      else if (org.includes('Croix-Rouge')) orgMap[po.benevole_id] = 'Croix-Rouge'
      else if (org.includes('MSP')) orgMap[po.benevole_id] = 'MSP'
      else orgMap[po.benevole_id] = org
    }

    // ── 1. Répartition par groupe (Intérêt, Approuvé, Partenaires seulement) ─
    const groupeOrder = ['Intérêt', 'Approuvé', 'Partenaires']
    const groupeCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      const g = r.groupe || 'Autre'
      if (groupeOrder.includes(g)) {
        groupeCounts[g] = (groupeCounts[g] || 0) + 1
      }
    }
    const parGroupe = groupeOrder
      .filter(g => groupeCounts[g])
      .map(groupe => ({ groupe, total: groupeCounts[groupe] }))

    // ── 2. Qualifiés par organisme (Approuvé + Partenaires) ──────────────────
    const qualifies = (reservistes || []).filter(r =>
      r.groupe === 'Approuvé' || r.groupe === 'Partenaires'
    )
    const orgCounts: Record<string, number> = {}
    for (const r of qualifies) {
      const org = orgMap[r.benevole_id] || 'AQBRS-RS'
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
      r.groupe === 'Intérêt' && orgMap[r.benevole_id]
    ).length
    const interetData = [
      { label: 'Public', total: interetPublic },
      { label: 'AQBRS', total: interetAQBRS },
    ]

    // ── 4. Répartition géographique — Approuvés ───────────────────────────────
    const regionApprouvesCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      if (!r.region || r.groupe !== 'Approuvé') continue
      regionApprouvesCounts[r.region] = (regionApprouvesCounts[r.region] || 0) + 1
    }
    const parRegionApprouves = Object.entries(regionApprouvesCounts)
      .map(([region, total]) => ({ region, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)

    // ── 5. Répartition géographique — Intérêt ────────────────────────────────
    const regionInteretCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      if (!r.region || r.groupe !== 'Intérêt') continue
      regionInteretCounts[r.region] = (regionInteretCounts[r.region] || 0) + 1
    }
    const parRegionInteret = Object.entries(regionInteretCounts)
      .map(([region, total]) => ({ region, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)

    // ── 6. Antécédents judiciaires — Approuvés seulement ─────────────────────
    const antecedentsCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      if (r.groupe !== 'Approuvé') continue
      const s = r.antecedents_statut || 'en_attente'
      antecedentsCounts[s] = (antecedentsCounts[s] || 0) + 1
    }
    const antecedentsData = Object.entries(antecedentsCounts)
      .map(([statut, total]) => ({ statut, total }))

    // ── Totaux ────────────────────────────────────────────────────────────────
    const totalInscrits   = reservistes?.length || 0
    const totalInteret    = (groupeCounts['Intérêt'] || 0)
    const totalApprouves  = (groupeCounts['Approuvé'] || 0)
    const totalPartenaires = (groupeCounts['Partenaires'] || 0)

    return NextResponse.json({
      totalInscrits,
      totalInteret,
      totalApprouves,
      totalPartenaires,
      parGroupe,
      parOrganisme,
      interetData,
      parRegionApprouves,
      parRegionInteret,
      antecedentsData,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
