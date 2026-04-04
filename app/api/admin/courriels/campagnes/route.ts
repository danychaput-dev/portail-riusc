// app/api/admin/courriels/campagnes/route.ts
// Liste des campagnes avec stats agrégées
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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

    return NextResponse.json({ campagnes: stats })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
