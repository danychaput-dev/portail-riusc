// app/api/admin/courriels/campagnes/route.ts
// Liste des campagnes avec stats agrégées + compteur réponses
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

    // Récupérer les campagnes
    const { data: campagnes, error: campErr } = await supabaseAdmin
      .from('courriel_campagnes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 })

    const campagneIds = (campagnes || []).map(c => c.id)
    if (campagneIds.length === 0) return NextResponse.json({ campagnes: [] })

    // UNE SEULE requête pour tous les courriels de toutes les campagnes (élimine boucle N+1)
    const [courrielsResult, reponsesResult] = await Promise.allSettled([
      supabaseAdmin
        .from('courriels')
        .select('id, campagne_id, statut, ouvert_at')
        .in('campagne_id', campagneIds),
      supabaseAdmin
        .from('courriel_reponses')
        .select('id, courriel_id, statut')
        .not('courriel_id', 'is', null)
    ])

    const allCourriels = courrielsResult.status === 'fulfilled' ? courrielsResult.value?.data || [] : []
    const allReponses = reponsesResult.status === 'fulfilled' ? reponsesResult.value?.data || [] : []

    // Grouper les courriels par campagne_id en mémoire
    const courrielsByCampagne = new Map<string, typeof allCourriels>()
    const courrielToCampagne = new Map<string, string>()
    for (const c of allCourriels) {
      if (!c.campagne_id) continue
      if (!courrielsByCampagne.has(c.campagne_id)) courrielsByCampagne.set(c.campagne_id, [])
      courrielsByCampagne.get(c.campagne_id)!.push(c)
      courrielToCampagne.set(c.id, c.campagne_id)
    }

    // Compter les réponses par campagne
    const replyCounts = new Map<string, { total: number; non_lues: number }>()
    for (const rep of allReponses) {
      const campId = courrielToCampagne.get(rep.courriel_id)
      if (!campId) continue
      const curr = replyCounts.get(campId) || { total: 0, non_lues: 0 }
      curr.total++
      if (rep.statut === 'recu') curr.non_lues++
      replyCounts.set(campId, curr)
    }

    // Calculer les stats pour chaque campagne en mémoire
    const stats = (campagnes || []).map(c => {
      const courriels = courrielsByCampagne.get(c.id) || []
      const total = courriels.length
      const delivered = courriels.filter(e => ['delivered', 'opened', 'clicked'].includes(e.statut)).length
      const opened = courriels.filter(e => ['opened', 'clicked'].includes(e.statut)).length
      const clicked = courriels.filter(e => e.statut === 'clicked').length
      const bounced = courriels.filter(e => e.statut === 'bounced').length
      const failed = courriels.filter(e => e.statut === 'failed').length
      const rc = replyCounts.get(c.id)

      return {
        ...c,
        reponses_total: rc?.total || 0,
        reponses_non_lues: rc?.non_lues || 0,
        stats: {
          total,
          delivered,
          opened,
          clicked,
          bounced,
          failed,
          taux_ouverture: total > 0 ? Math.round((opened / total) * 100) : 0,
          taux_clics: total > 0 ? Math.round((clicked / total) * 100) : 0,
        }
      }
    })

    return NextResponse.json({ campagnes: stats })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
