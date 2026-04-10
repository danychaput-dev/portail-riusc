// app/api/admin/courriels/templates/route.ts
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
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return user
}

// GET — Lister les templates (mes perso + partagés)
export async function GET() {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { data, error } = await supabaseAdmin
      .from('templates_courriels')
      .select('id, user_id, nom, subject, body_html, partage, updated_at')
      .or(`user_id.eq.${admin.id},partage.eq.true`)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ templates: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — Créer un template
export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { nom, subject, body_html, partage } = await req.json()
    if (!nom?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('templates_courriels')
      .insert({
        user_id: admin.id,
        nom: nom.trim(),
        subject: subject || '',
        body_html: body_html || '',
        partage: partage === true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, template: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT — Mettre à jour un template (seulement le sien)
export async function PUT(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { id, nom, subject, body_html, partage } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('templates_courriels')
      .update({ nom, subject, body_html, partage, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', admin.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, template: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — Supprimer un template (seulement le sien)
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('templates_courriels')
      .delete()
      .eq('id', id)
      .eq('user_id', admin.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
