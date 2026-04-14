// app/api/admin/certificats-a-trier/file/route.ts
// Proxy le fichier depuis le bucket privé en streaming, avec en-têtes
// permettant l'embed iframe (Supabase envoie X-Frame-Options:DENY sinon).
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
    .download(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Fichier introuvable' }, { status: 404 })
  }

  const buf = Buffer.from(await data.arrayBuffer())
  const ext = path.toLowerCase().split('.').pop() || ''
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  }
  const contentType = mimeMap[ext] || data.type || 'application/octet-stream'

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
