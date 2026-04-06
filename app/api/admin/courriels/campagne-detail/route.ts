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
    const { data: courriels, error } = await supabaseAdmin
      .from('courriels')
      .select('id, benevole_id, to_email, statut, ouvert_at, clics_count, created_at, body_html, subject')
      .eq('campagne_id', campagneId)
      .order('created_at', { ascending: true })

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

    const enriched = (courriels || []).map(c => {
      const r = nameMap.get(c.benevole_id)
      return {
        ...c,
        prenom: r?.prenom || '',
        nom: r?.nom || '',
        nom_complet: r ? `${r.prenom} ${r.nom}` : c.to_email,
      }
    })

    return NextResponse.json({ campagne, destinataires: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
