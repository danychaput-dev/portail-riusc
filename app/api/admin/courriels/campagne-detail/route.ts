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

    // Récupérer la campagne
    const { data: campagne } = await supabaseAdmin
      .from('courriel_campagnes')
      .select('*')
      .eq('id', campagneId)
      .single()

    if (!campagne) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })

    // Récupérer tous les courriels de la campagne
    let { data: courriels, error } = await supabaseAdmin
      .from('courriels')
      .select('id, benevole_id, to_email, statut, ouvert_at, clics_count, created_at, body_html, subject, has_reply')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: true })

    // Fallback si has_reply n'existe pas encore
    if (error && error.message?.includes('has_reply')) {
      const r2 = await supabaseAdmin
        .from('courriels')
        .select('id, benevole_id, to_email, statut, ouvert_at, clics_count, created_at, body_html, subject')
        .eq('campagne_id', campagneId)
        .order('created_at', { ascending: true })
      courriels = r2.data
      error = r2.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrichir avec noms des réservistes
    const bIds = [...new Set((courriels || []).map(c => c.benevole_id).filter(Boolean))]
    const nameMap = new Map<string, { prenom: string; nom: string }>()
    if (bIds.length > 0) {
      const { data: reservistes } = await supabaseAdmin
        .from('reservistes')
        .select('benevole_id, prenom, nom')
        .in('benevole_id', bIds)
      for (const r of reservistes || []) {
        nameMap.set(r.benevole_id, { prenom: r.prenom, nom: r.nom })
      }
    }

    // Récupérer les réponses liées aux courriels de cette campagne (défensif)
    const courrielIds = (courriels || []).map(c => c.id).filter(Boolean)
    let reponsesMap = new Map<string, any[]>()
    if (courrielIds.length > 0) {
      try {
        const { data: reponses } = await supabaseAdmin
          .from('courriel_reponses')
          .select('id, courriel_id, from_email, from_name, subject, body_text, body_html, pieces_jointes, statut, created_at')
          .in('courriel_id', courrielIds)
          .order('created_at', { ascending: true })
        for (const rep of reponses || []) {
          const list = reponsesMap.get(rep.courriel_id) || []
          list.push(rep)
          reponsesMap.set(rep.courriel_id, list)
        }
      } catch {
        // Table courriel_reponses pas encore créée — on continue sans
      }
    }

    const enriched = (courriels || []).map(c => {
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
