// app/api/admin/courriels/individuels/route.ts
// Liste les courriels envoyés individuellement (sans campagne)
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

    // Filtres optionnels
    const search = req.nextUrl.searchParams.get('search') || ''
    const dateFrom = req.nextUrl.searchParams.get('from') || ''
    const dateTo = req.nextUrl.searchParams.get('to') || ''
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100')

    const selectCols = 'id, benevole_id, subject, from_name, from_email, to_email, statut, ouvert_at, clics_count, created_at, body_html, pieces_jointes, envoye_par, has_reply'
    const selectColsFallback = 'id, benevole_id, subject, from_name, from_email, to_email, statut, ouvert_at, clics_count, created_at, body_html, pieces_jointes, envoye_par'

    let query = supabaseAdmin
      .from('courriels')
      .select(selectCols)
      .is('campagne_id', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

    let { data: courriels, error } = await query

    // Fallback si has_reply n'existe pas encore
    if (error && error.message?.includes('has_reply')) {
      let q2 = supabaseAdmin
        .from('courriels')
        .select(selectColsFallback)
        .is('campagne_id', null)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (dateFrom) q2 = q2.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo) q2 = q2.lte('created_at', `${dateTo}T23:59:59`)
      const r2 = await q2
      courriels = r2.data as any
      error = r2.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Étape 2 : noms, réponses et orphelines en PARALLÈLE
    const raw = courriels || []
    const bIds = [...new Set(raw.map(c => c.benevole_id).filter(Boolean))]
    const courrielIds = raw.map(c => c.id).filter(Boolean)

    const [namesResult, reponsesResult, orphelinesResult] = await Promise.allSettled([
      // Noms des réservistes
      bIds.length > 0
        ? supabaseAdmin.from('reservistes').select('benevole_id, prenom, nom').in('benevole_id', bIds)
        : Promise.resolve({ data: [] }),
      // Réponses liées aux courriels
      courrielIds.length > 0
        ? supabaseAdmin
            .from('courriel_reponses')
            .select('id, courriel_id, from_email, from_name, subject, body_text, body_html, pieces_jointes, statut, created_at, resend_email_id')
            .in('courriel_id', courrielIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      // Réponses orphelines (sans courriel_id)
      supabaseAdmin
        .from('courriel_reponses')
        .select('id, courriel_id, benevole_id, from_email, from_name, subject, body_text, body_html, pieces_jointes, statut, created_at, resend_email_id')
        .is('courriel_id', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    // Noms
    const nameMap = new Map<string, string>()
    const reservistes = namesResult.status === 'fulfilled' ? (namesResult.value as any)?.data || [] : []
    for (const r of reservistes) nameMap.set(r.benevole_id, `${r.prenom} ${r.nom}`)

    let enriched: any[] = raw.map(c => ({ ...c, nom_complet: nameMap.get(c.benevole_id) || c.to_email }))

    // Filtre recherche côté serveur (nom ou courriel)
    if (search) {
      const s = search.toLowerCase()
      enriched = enriched.filter(c =>
        c.nom_complet.toLowerCase().includes(s) ||
        (c.to_email || '').toLowerCase().includes(s) ||
        (c.subject || '').toLowerCase().includes(s)
      )
    }

    // Réponses liées
    const allReponses = reponsesResult.status === 'fulfilled' ? (reponsesResult.value as any)?.data || [] : []
    const repMap = new Map<string, any[]>()
    for (const rep of allReponses) {
      const list = repMap.get(rep.courriel_id) || []
      list.push(rep)
      repMap.set(rep.courriel_id, list)
    }
    enriched = enriched.map(c => ({ ...c, reponses: repMap.get(c.id) || [] }))

    // Réponses orphelines — enrichir avec noms
    let reponsesOrphelines: any[] = []
    const orphData = orphelinesResult.status === 'fulfilled' ? (orphelinesResult.value as any)?.data || [] : []
    if (orphData.length > 0) {
      // Vérifier si on a déjà les noms, sinon fetch les manquants
      const orphBIds: string[] = [...new Set(orphData.map((r: any) => r.benevole_id).filter(Boolean) as string[])]
      const missingBIds = orphBIds.filter((id: string) => !nameMap.has(id))
      if (missingBIds.length > 0) {
        const { data: orphReservistes } = await supabaseAdmin
          .from('reservistes')
          .select('benevole_id, prenom, nom')
          .in('benevole_id', missingBIds)
        for (const r of orphReservistes || []) nameMap.set(r.benevole_id, `${r.prenom} ${r.nom}`)
      }
      reponsesOrphelines = orphData.map((r: any) => ({
        ...r,
        nom_complet: nameMap.get(r.benevole_id) || r.from_email,
      }))
    }

    return NextResponse.json({ courriels: enriched, reponses_orphelines: reponsesOrphelines })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
