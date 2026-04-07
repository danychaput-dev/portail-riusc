// GET — Compter les notes non lues par l'admin courant
// PATCH — Marquer des notes comme lues (par benevole_id ou toutes)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
  if (!res || !['admin', 'coordonnateur'].includes(res.role)) return null
  return user
}

// GET — Nombre de notes non lues + optionnellement les benevole_ids
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const detail = req.nextUrl.searchParams.get('detail') === '1'

    // Notes où l'user courant n'est PAS dans lu_par ET n'est PAS l'auteur
    const { data: notes, count, error } = await supabaseAdmin
      .from('notes_reservistes')
      .select('id, benevole_id', { count: 'exact' })
      .not('auteur_id', 'eq', user.id)
      .not('lu_par', 'cs', `{${user.id}}`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const result: any = { count: count || 0 }
    if (detail && notes) {
      // Retourner les benevole_ids uniques qui ont des notes non lues
      result.benevole_ids = [...new Set(notes.map(n => n.benevole_id))]
    }
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — Marquer comme lu
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const { benevole_id, note_ids, tout } = body

    let query = supabaseAdmin
      .from('notes_reservistes')
      .select('id, lu_par')
      .not('auteur_id', 'eq', user.id)
      .not('lu_par', 'cs', `{${user.id}}`)

    if (benevole_id) {
      query = query.eq('benevole_id', benevole_id)
    } else if (note_ids && Array.isArray(note_ids)) {
      query = query.in('id', note_ids)
    }
    // Si tout=true, pas de filtre supplémentaire (marque toutes les non-lues)

    const { data: notes, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Ajouter l'user_id à lu_par pour chaque note
    for (const note of (notes || [])) {
      const newLuPar = [...(note.lu_par || []), user.id]
      await supabaseAdmin
        .from('notes_reservistes')
        .update({ lu_par: newLuPar })
        .eq('id', note.id)
    }

    // Recompter les non-lues
    const { count } = await supabaseAdmin
      .from('notes_reservistes')
      .select('id', { count: 'exact', head: true })
      .not('auteur_id', 'eq', user.id)
      .not('lu_par', 'cs', `{${user.id}}`)

    return NextResponse.json({ ok: true, count: count || 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
