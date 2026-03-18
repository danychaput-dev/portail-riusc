// app/api/admin/sinistres/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAcces(benevole_id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('reservistes')
    .select('role')
    .eq('benevole_id', benevole_id)
    .single()
  return data?.role === 'admin' || data?.role === 'coordonnateur'
}

// CREATE sinistre ou demande
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, payload, admin_benevole_id } = body
    if (!await verifierAcces(admin_benevole_id)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!['sinistres', 'demandes'].includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

    const { data, error } = await supabaseAdmin.from(table).insert(payload).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// UPDATE sinistre ou demande
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, id, payload, admin_benevole_id } = body
    if (!await verifierAcces(admin_benevole_id)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!['sinistres', 'demandes'].includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

    const { data, error } = await supabaseAdmin.from(table).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE sinistre ou demande
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, id, admin_benevole_id } = body
    if (!await verifierAcces(admin_benevole_id)) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!['sinistres', 'demandes'].includes(table)) return NextResponse.json({ error: 'Table invalide' }, { status: 400 })

    const { error } = await supabaseAdmin.from(table).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
