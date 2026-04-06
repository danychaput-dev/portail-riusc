// app/api/admin/courriels/cc-contacts/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
  return res && ['admin', 'coordonnateur'].includes(res.role)
}

// GET — Lister les contacts CC
export async function GET() {
  if (!await verifierAdmin()) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('admin_cc_contacts')
    .select('*')
    .eq('actif', true)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data || [] })
}

// POST — Ajouter un contact CC
export async function POST(req: NextRequest) {
  if (!await verifierAdmin()) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { nom, email } = await req.json()
  if (!nom || !email) return NextResponse.json({ error: 'Nom et email requis' }, { status: 400 })

  // Position = max actuel + 1
  const { data: maxPos } = await supabaseAdmin
    .from('admin_cc_contacts')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await supabaseAdmin
    .from('admin_cc_contacts')
    .insert({ nom, email, position: (maxPos?.position || 0) + 1 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, contact: data })
}

// PUT — Modifier un contact CC
export async function PUT(req: NextRequest) {
  if (!await verifierAdmin()) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id, nom, email } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('admin_cc_contacts')
    .update({ nom, email })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — Supprimer un contact CC
export async function DELETE(req: NextRequest) {
  if (!await verifierAdmin()) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('admin_cc_contacts')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
