// app/api/admin/courriels/reponses/route.ts
// Liste des réponses inbound reçues, avec filtres par benevole_id ou courriel_id
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    // Auth — admin ou coordonnateur
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

    const { searchParams } = new URL(req.url)
    const benevoleId = searchParams.get('benevole_id')
    const courrielId = searchParams.get('courriel_id')
    const statut = searchParams.get('statut')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin
      .from('courriel_reponses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (benevoleId) query = query.eq('benevole_id', benevoleId)
    if (courrielId) query = query.eq('courriel_id', courrielId)
    if (statut) query = query.eq('statut', statut)

    const { data: reponses, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ reponses })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — Marquer une réponse comme lue/traitée/archivée
export async function PATCH(req: NextRequest) {
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

    const { reponse_id, statut } = await req.json()

    if (!reponse_id) return NextResponse.json({ error: 'reponse_id requis' }, { status: 400 })
    if (!['recu', 'lu', 'traite', 'archive'].includes(statut)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const updates: Record<string, any> = { statut }
    if (statut === 'lu' || statut === 'traite') {
      updates.lu_par = user.id
      updates.lu_at = new Date().toISOString()
    }

    const { error } = await supabaseAdmin
      .from('courriel_reponses')
      .update(updates)
      .eq('id', reponse_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
