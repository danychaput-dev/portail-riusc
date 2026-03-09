import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const ADMINS = ['dany.chaput@aqbrs.ca', 'est.lapointe@gmail.com']

const REDIRECT_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.mp4', '.webm', '.mp3', '.pdf']

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.xml':  'application/xml',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkAccess(user: { id: string; email?: string | null }, modulePath: string): Promise<boolean> {
  if (ADMINS.includes(user.email || '')) return true

  const supabaseAdmin = getAdminClient()

  const { data: reserviste } = await supabaseAdmin
    .from('reservistes')
    .select('groupe')
    .eq('user_id', user.id)
    .single()

  if (!reserviste) return false

  const { data: lmsModule } = await supabaseAdmin
    .from('lms_modules')
    .select('actif, groupes')
    .eq('bucket_path', modulePath)
    .single()

  return !!(lmsModule?.actif && lmsModule?.groupes?.includes(reserviste.groupe))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params

  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const modulePath = path[0]
    const filePath = path.join('/')
    const ext = filePath.includes('.') ? '.' + filePath.split('.').pop() : ''

    const hasAccess = await checkAccess(user, modulePath)
    if (!hasAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const supabaseAdmin = getAdminClient()

    // Assets lourds → signed URL redirect (beaucoup plus rapide)
    if (REDIRECT_EXTENSIONS.includes(ext)) {
      const { data, error } = await supabaseAdmin.storage
        .from('lms-modules')
        .createSignedUrl(filePath, 3600)

      if (error || !data?.signedUrl) {
        return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
      }

      return NextResponse.redirect(data.signedUrl, { status: 302 })
    }

    // HTML/JSON/XML → proxy direct
    const { data, error } = await supabaseAdmin.storage
      .from('lms-modules')
      .download(filePath)

    if (error || !data) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    const buffer = await data.arrayBuffer()
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
      }
    })

  } catch (err) {
    console.error('Erreur proxy LMS:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
