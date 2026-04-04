// app/api/admin/notes/route.ts
// Notes internes entre admins sur un réserviste
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabase.from('reservistes').select('role, prenom, nom').eq('user_id', user.id).single()
  if (!res || !['admin', 'coordonnateur'].includes(res.role)) return null
  return { ...user, prenom: res.prenom, nom: res.nom }
}

// GET — Lister les notes d'un réserviste
export async function GET(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const benevole_id = req.nextUrl.searchParams.get('benevole_id')
    if (!benevole_id) return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })

    const { data: notes, error } = await supabaseAdmin
      .from('notes_reservistes')
      .select('id, auteur_id, auteur_nom, contenu, created_at')
      .eq('benevole_id', benevole_id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ notes: notes || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Ajouter une note
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { benevole_id, contenu } = await req.json()
    if (!benevole_id) return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
    if (!contenu?.trim()) return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('notes_reservistes')
      .insert({
        benevole_id,
        auteur_id: admin.id,
        auteur_nom: `${admin.prenom} ${admin.nom}`,
        contenu: contenu.trim(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, note: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — Supprimer sa propre note
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('notes_reservistes')
      .delete()
      .eq('id', id)
      .eq('auteur_id', admin.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
