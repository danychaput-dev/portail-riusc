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
    const { data: campagnes, error: campErr } = await supabase
      .from('courriel_campagnes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 })

    // Pour chaque campagne, calculer les stats depuis les courriels
    const stats = []
    for (const c of campagnes || []) {
      const { data: courriels } = await supabase
        .from('courriels')
        .select('statut, ouvert_at')
        .eq('campagne_id', c.id)

      const total = courriels?.length || 0
      const delivered = courriels?.filter(e => ['delivered', 'opened', 'clicked'].includes(e.statut)).length || 0
      const opened = courriels?.filter(e => ['opened', 'clicked'].includes(e.statut)).length || 0
      const clicked = courriels?.filter(e => e.statut === 'clicked').length || 0
      const bounced = courriels?.filter(e => e.statut === 'bounced').length || 0
      const failed = courriels?.filter(e => e.statut === 'failed').length || 0

      stats.push({
        ...c,
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
      })
    }

    // Compter les réponses non lues par campagne (courriel_reponses → courriels → campagne_id)
    try {
      const campagneIds = (campagnes || []).map(c => c.id)
      if (campagneIds.length > 0) {
        // Récupérer tous les courriels de campagne avec leur campagne_id
        const { data: campCourriels } = await supabaseAdmin
          .from('courriels')
          .select('id, campagne_id')
          .in('campagne_id', campagneIds)

        if (campCourriels && campCourriels.length > 0) {
          const courrielIds = campCourriels.map(c => c.id)
          const courrielToCampagne = new Map(campCourriels.map(c => [c.id, c.campagne_id]))

          // Récupérer les réponses non lues pour ces courriels
          const { data: reponses } = await supabaseAdmin
            .from('courriel_reponses')
            .select('id, courriel_id, statut')
            .in('courriel_id', courrielIds)

          // Compter par campagne
          const replyCounts = new Map<string, { total: number; non_lues: number }>()
          for (const rep of reponses || []) {
            const campId = courrielToCampagne.get(rep.courriel_id)
            if (!campId) continue
            const curr = replyCounts.get(campId) || { total: 0, non_lues: 0 }
            curr.total++
            if (rep.statut === 'recu') curr.non_lues++
            replyCounts.set(campId, curr)
          }

          // Injecter dans les stats
          for (const s of stats) {
            const rc = replyCounts.get(s.id)
            s.reponses_total = rc?.total || 0
            s.reponses_non_lues = rc?.non_lues || 0
          }
        }
      }
    } catch {
      // Table courriel_reponses pas encore dispo — on continue sans
    }

    return NextResponse.json({ campagnes: stats })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
