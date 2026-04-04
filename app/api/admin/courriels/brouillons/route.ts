// app/api/admin/courriels/brouillons/route.ts
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
  const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
  if (!res || !['admin', 'coordonnateur'].includes(res.role)) return null
  return user
}

// GET — Lister mes brouillons
export async function GET() {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { data, error } = await supabaseAdmin
      .from('brouillons_courriels')
      .select('id, subject, body_html, destinataires, updated_at')
      .eq('user_id', admin.id)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ brouillons: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Sauvegarder un brouillon (upsert)
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { id, subject, body_html, destinataires } = await req.json()

    if (id) {
      // Update existant
      const { data, error } = await supabaseAdmin
        .from('brouillons_courriels')
        .update({ subject, body_html, destinataires, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', admin.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, brouillon: data })
    } else {
      // Créer nouveau
      const { data, error } = await supabaseAdmin
        .from('brouillons_courriels')
        .insert({ user_id: admin.id, subject, body_html, destinataires })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, brouillon: data })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — Supprimer un brouillon
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('brouillons_courriels')
      .delete()
      .eq('id', id)
      .eq('user_id', admin.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
