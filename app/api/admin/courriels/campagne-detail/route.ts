// app/api/admin/courriels/campagne-detail/route.ts
// Détail d'une campagne : liste des destinataires avec statuts individuels
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
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

    const campagneId = req.nextUrl.searchParams.get('campagne_id')
    if (!campagneId) return NextResponse.json({ error: 'campagne_id requis' }, { status: 400 })

    // Étape 1 : campagne + courriels en parallèle
    const [campResult, courrielsResult] = await Promise.allSettled([
      supabaseAdmin.from('courriel_campagnes').select('*').eq('id', campagneId).single(),
      supabaseAdmin
        .from('courriels')
        .select('id, benevole_id, to_email, statut, ouvert_at, clics_count, created_at, body_html, subject, has_reply')
        .eq('campagne_id', campagneId)
        .order('created_at', { ascending: true }),
    ])

    const campagne = campResult.status === 'fulfilled' ? campResult.value?.data : null
    if (!campagne) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })

    let courriels = courrielsResult.status === 'fulfilled' ? courrielsResult.value?.data : null
    const courrielsError = courrielsResult.status === 'fulfilled' ? courrielsResult.value?.error : null

    // Fallback si has_reply n'existe pas encore
    if (courrielsError && courrielsError.message?.includes('has_reply')) {
      const r2 = await supabaseAdmin
        .from('courriels')
        .select('id, benevole_id, to_email, statut, ouvert_at, clics_count, created_at, body_html, subject')
        .eq('campagne_id', campagneId)
        .order('created_at', { ascending: true })
      courriels = r2.data as any
    }

    // Étape 2 : noms + réponses en parallèle (dépendent des courriels)
    // Note: .in() Supabase a une limite URL (~300 UUIDs). On batch par lots de 200.
    const bIds = [...new Set((courriels || []).map((c: any) => c.benevole_id).filter(Boolean))]
    const courrielIds = (courriels || []).map((c: any) => c.id).filter(Boolean)

    const BATCH_IN = 200

    // Helper pour batched .in() queries
    async function batchedIn<T>(table: string, column: string, ids: string[], select: string, orderBy?: { col: string; asc: boolean }): Promise<T[]> {
      if (ids.length === 0) return []
      const results: T[] = []
      for (let i = 0; i < ids.length; i += BATCH_IN) {
        const chunk = ids.slice(i, i + BATCH_IN)
        let query = supabaseAdmin.from(table).select(select).in(column, chunk)
        if (orderBy) query = query.order(orderBy.col, { ascending: orderBy.asc })
        const { data } = await query
        if (data) results.push(...(data as T[]))
      }
      return results
    }

    const [reservistes, reponses] = await Promise.all([
      batchedIn<{ benevole_id: string; prenom: string; nom: string }>('reservistes', 'benevole_id', bIds, 'benevole_id, prenom, nom'),
      batchedIn<any>('courriel_reponses', 'courriel_id', courrielIds, 'id, courriel_id, from_email, from_name, subject, body_text, body_html, pieces_jointes, statut, created_at, resend_email_id', { col: 'created_at', asc: true }),
    ])

    const nameMap = new Map<string, { prenom: string; nom: string }>()
    for (const r of reservistes) nameMap.set(r.benevole_id, { prenom: r.prenom, nom: r.nom })

    const reponsesMap = new Map<string, any[]>()
    for (const rep of reponses) {
      const list = reponsesMap.get(rep.courriel_id) || []
      list.push(rep)
      reponsesMap.set(rep.courriel_id, list)
    }

    const enriched = (courriels || []).map((c: any) => {
      const r = nameMap.get(c.benevole_id)
      return {
        ...c,
        prenom: r?.prenom || '',
        nom: r?.nom || '',
        nom_complet: r ? `${r.prenom} ${r.nom}` : c.to_email,
        reponses: reponsesMap.get(c.id) || [],
      }
    })

    return NextResponse.json({ campagne, destinataires: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
