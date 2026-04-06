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

    // Enrichir avec le nom du réserviste
    const raw = courriels || []
    const bIds = [...new Set(raw.map(c => c.benevole_id).filter(Boolean))]
    const nameMap = new Map<string, string>()
    if (bIds.length > 0) {
      const { data: reservistes } = await supabaseAdmin
        .from('reservistes')
        .select('benevole_id, prenom, nom')
        .in('benevole_id', bIds)
      for (const r of reservistes || []) nameMap.set(r.benevole_id, `${r.prenom} ${r.nom}`)
    }
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

    // Récupérer les réponses liées à ces courriels (défensif si table pas encore créée)
    const courrielIds = enriched.map(c => c.id).filter(Boolean)
    if (courrielIds.length > 0) {
      try {
        const { data: reponses } = await supabaseAdmin
          .from('courriel_reponses')
          .select('id, courriel_id, from_email, from_name, subject, body_text, body_html, pieces_jointes, statut, created_at, resend_email_id')
          .in('courriel_id', courrielIds)
          .order('created_at', { ascending: true })
        const repMap = new Map<string, any[]>()
        for (const rep of reponses || []) {
          const list = repMap.get(rep.courriel_id) || []
          list.push(rep)
          repMap.set(rep.courriel_id, list)
        }
        enriched = enriched.map(c => ({ ...c, reponses: repMap.get(c.id) || [] }))
      } catch {
        // Table courriel_reponses pas encore créée — on continue sans
      }
    }

    // Récupérer les réponses orphelines (sans courriel_id ou avec un courriel_id qui n'existe pas dans nos courriels)
    // Ces réponses apparaissent dans le dossier du réserviste mais pas ici sans ce fix
    let reponsesOrphelines: any[] = []
    try {
      const { data: allReponses } = await supabaseAdmin
        .from('courriel_reponses')
        .select('id, courriel_id, benevole_id, from_email, from_name, subject, body_text, body_html, pieces_jointes, statut, created_at, resend_email_id')
        .is('courriel_id', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (allReponses && allReponses.length > 0) {
        // Enrichir avec le nom du réserviste
        const orphBIds = [...new Set(allReponses.map(r => r.benevole_id).filter(Boolean))]
        const orphNameMap = new Map<string, { prenom: string; nom: string }>()
        if (orphBIds.length > 0) {
          const { data: reservistes } = await supabaseAdmin
            .from('reservistes')
            .select('benevole_id, prenom, nom')
            .in('benevole_id', orphBIds)
          for (const r of reservistes || []) orphNameMap.set(r.benevole_id, { prenom: r.prenom, nom: r.nom })
        }
        reponsesOrphelines = allReponses.map(r => ({
          ...r,
          nom_complet: orphNameMap.get(r.benevole_id)
            ? `${orphNameMap.get(r.benevole_id)!.prenom} ${orphNameMap.get(r.benevole_id)!.nom}`
            : r.from_email,
        }))
      }
    } catch {
      // Table pas encore prête — on continue
    }

    return NextResponse.json({ courriels: enriched, reponses_orphelines: reponsesOrphelines })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
