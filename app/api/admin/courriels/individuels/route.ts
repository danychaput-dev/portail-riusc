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

    let query = supabaseAdmin
      .from('courriels')
      .select('id, benevole_id, subject, from_name, from_email, to_email, statut, ouvert_at, clics_count, created_at, body_html, pieces_jointes, envoye_par')
      .is('campagne_id', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

    const { data: courriels, error } = await query
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
    let enriched = raw.map(c => ({ ...c, nom_complet: nameMap.get(c.benevole_id) || c.to_email }))

    // Filtre recherche côté serveur (nom ou courriel)
    if (search) {
      const s = search.toLowerCase()
      enriched = enriched.filter(c =>
        c.nom_complet.toLowerCase().includes(s) ||
        (c.to_email || '').toLowerCase().includes(s) ||
        (c.subject || '').toLowerCase().includes(s)
      )
    }

    return NextResponse.json({ courriels: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
