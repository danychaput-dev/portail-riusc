// app/api/admin/courriels/campagnes/route.ts
// Liste des campagnes avec stats agrégées via SQL (GROUP BY) — plus de fetch all rows
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
    if (!res || !['admin', 'coordonnateur'].includes(res.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Tout en parallèle : campagnes + stats agrégées SQL + réponses agrégées SQL
    const [campagnesResult, statsResult, repStatsResult] = await Promise.allSettled([
      // 1. Campagnes (métadonnées seulement)
      supabaseAdmin
        .from('courriel_campagnes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
      // 2. Stats courriels agrégées par campagne (GROUP BY via RPC)
      supabaseAdmin.rpc('get_campagne_courriel_stats'),
      // 3. Stats réponses agrégées par campagne (GROUP BY via RPC)
      supabaseAdmin.rpc('get_campagne_reponse_stats'),
    ])

    const campagnes = campagnesResult.status === 'fulfilled' ? campagnesResult.value?.data || [] : []
    const campErr = campagnesResult.status === 'fulfilled' ? campagnesResult.value?.error : null
    if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 })
    if (campagnes.length === 0) return NextResponse.json({ campagnes: [] })

    // Indexer les stats par campagne_id
    const statsRows = statsResult.status === 'fulfilled' ? statsResult.value?.data || [] : []
    const statsMap = new Map<string, any>()
    for (const row of statsRows) statsMap.set(row.campagne_id, row)

    const repRows = repStatsResult.status === 'fulfilled' ? repStatsResult.value?.data || [] : []
    const repMap = new Map<string, any>()
    for (const row of repRows) repMap.set(row.campagne_id, row)

    // Assembler les résultats
    const result = campagnes.map((c: any) => {
      const s = statsMap.get(c.id)
      const r = repMap.get(c.id)
      const total = s?.total || 0
      const opened = s?.opened || 0
      const clicked = s?.clicked || 0

      return {
        ...c,
        reponses_total: r?.total || 0,
        reponses_non_lues: r?.non_lues || 0,
        stats: {
          total,
          delivered: s?.delivered || 0,
          opened,
          clicked,
          bounced: s?.bounced || 0,
          failed: s?.failed || 0,
          taux_ouverture: total > 0 ? Math.round((opened / total) * 100) : 0,
          taux_clics: total > 0 ? Math.round((clicked / total) * 100) : 0,
        }
      }
    })

    return NextResponse.json({ campagnes: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
