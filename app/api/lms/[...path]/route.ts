import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const ADMINS = ['dany.chaput@aqbrs.ca', 'est.lapointe@gmail.com']

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.ico':  'image/x-icon',
}

function getMimeType(filePath: string): string {
  const ext = Object.keys(MIME_TYPES).find(e => filePath.endsWith(e))
  return ext ? MIME_TYPES[ext] : 'application/octet-stream'
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params

  try {
    // 1. Auth via le client serveur qui lit les cookies correctement
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // 2. Vérifier l'accès au module
    const isAdmin = ADMINS.includes(user.email || '')

    if (!isAdmin) {
      const supabaseAdmin = getAdminClient()
      const { data: reserviste } = await supabaseAdmin
        .from('reservistes')
        .select('groupe, benevole_id')
        .eq('user_id', user.id)
        .single()

      if (!reserviste) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }

      const modulePath = path[0]
      const { data: lmsModule } = await supabaseAdmin
        .from('lms_modules')
        .select('actif, groupes')
        .eq('bucket_path', modulePath)
        .single()

      if (!lmsModule?.actif || !lmsModule?.groupes?.includes(reserviste.groupe)) {
        return NextResponse.json({ error: 'Module non disponible' }, { status: 403 })
      }
    }

    // 3. Télécharger le fichier depuis Storage avec service_role
    const filePath = path.join('/')
    const supabaseAdmin = getAdminClient()

    const { data, error } = await supabaseAdmin.storage
      .from('lms-modules')
      .download(filePath)

    if (error || !data) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    // 4. Retourner avec le bon MIME type
    const buffer = await data.arrayBuffer()
    const mimeType = getMimeType(filePath)

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
