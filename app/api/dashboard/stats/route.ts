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
    // Fetch all active reservists (non-personal fields only)
    const { data: reservistes, error } = await supabase
      .from('reservistes')
      .select('benevole_id, groupe, region, antecedents_statut')
      .eq('statut', 'Actif')

    if (error) throw error

    // Fetch partenaires organismes
    const { data: partenairesOrgs } = await supabase
      .from('reserviste_organisations')
      .select(`
        benevole_id,
        organisations (nom)
      `)

    // Build a map: benevole_id -> organisme nom
    const orgMap: Record<string, string> = {}
    for (const po of (partenairesOrgs || [])) {
      const org = (po as any).organisations?.nom || ''
      if (org.includes('SOPFEU')) orgMap[po.benevole_id] = 'SOPFEU'
      else if (org.includes('Croix-Rouge')) orgMap[po.benevole_id] = 'Croix-Rouge'
      else if (org.includes('MSP')) orgMap[po.benevole_id] = 'MSP'
      else orgMap[po.benevole_id] = org
    }

    // ── 1. Total par groupe ────────────────────────────────────────────────
    const groupeCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      const g = r.groupe || 'Inconnu'
      groupeCounts[g] = (groupeCounts[g] || 0) + 1
    }
    const parGroupe = Object.entries(groupeCounts)
      .map(([groupe, total]) => ({ groupe, total }))
      .sort((a, b) => b.total - a.total)

    // ── 2. Qualifiés par organisme (Approuvé + Partenaires) ───────────────
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

    // ── 3. Intérêt: public vs AQBRS ───────────────────────────────────────
    const interetAQBRS = (reservistes || []).filter(r =>
      r.groupe === 'Intérêt' && orgMap[r.benevole_id]
    ).length
    const interetPublic = (reservistes || []).filter(r =>
      r.groupe === 'Intérêt' && !orgMap[r.benevole_id]
    ).length
    const interetData = [
      { label: 'Public', total: interetPublic },
      { label: 'AQBRS', total: interetAQBRS },
    ]

    // ── 4. Répartition géographique ───────────────────────────────────────
    const regionCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      if (!r.region) continue
      regionCounts[r.region] = (regionCounts[r.region] || 0) + 1
    }
    const parRegion = Object.entries(regionCounts)
      .map(([region, total]) => ({ region, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15) // top 15 régions

    // ── 5. Antécédents judiciaires ────────────────────────────────────────
    const antecedentsCounts: Record<string, number> = {}
    for (const r of reservistes || []) {
      const s = r.antecedents_statut || 'en_attente'
      antecedentsCounts[s] = (antecedentsCounts[s] || 0) + 1
    }
    const antecedentsData = Object.entries(antecedentsCounts)
      .map(([statut, total]) => ({ statut, total }))

    return NextResponse.json({
      total: reservistes?.length || 0,
      parGroupe,
      parOrganisme,
      interetData,
      parRegion,
      antecedentsData,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
