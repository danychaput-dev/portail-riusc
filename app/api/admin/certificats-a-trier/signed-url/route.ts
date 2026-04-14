// app/api/admin/certificats-a-trier/signed-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAdmin(admin_benevole_id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('reservistes')
    .select('role')
    .eq('benevole_id', admin_benevole_id)
    .single()
  return ['superadmin', 'admin', 'coordonnateur'].includes(data?.role || '')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path') || ''
  const admin_benevole_id = searchParams.get('admin_benevole_id') || ''

  if (!await verifierAdmin(admin_benevole_id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  if (!path) return NextResponse.json({ error: 'path requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin.storage
    .from('certificats-a-trier')
    .createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'URL introuvable' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
