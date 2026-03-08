import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // 1. Vérifier l'auth via cookie Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Cookie: request.headers.get('cookie') || '' }
        }
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // 2. Vérifier que l'utilisateur a accès au module
    // Pour l'instant : admins seulement
    // Plus tard : vérifier lms_modules.groupes vs reservistes.groupe
    const isAdmin = ADMINS.includes(user.email || '')

    if (!isAdmin) {
      // Vérifier accès via groupe (pour plus tard quand on ouvre à tous)
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: reserviste } = await supabaseAdmin
        .from('reservistes')
        .select('groupe, benevole_id')
        .eq('user_id', user.id)
        .single()

      if (!reserviste) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }

      // Vérifier que le module est actif et accessible au groupe
      const modulePath = params.path[0]
      const { data: module } = await supabaseAdmin
        .from('lms_modules')
        .select('actif, groupes')
        .eq('bucket_path', modulePath)
        .single()

      if (!module?.actif || !module?.groupes?.includes(reserviste.groupe)) {
        return NextResponse.json({ error: 'Module non disponible' }, { status: 403 })
      }
    }

    // 3. Construire le chemin dans le bucket
    const filePath = params.path.join('/')

    // 4. Télécharger le fichier depuis Supabase Storage
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin.storage
      .from('lms-modules')
      .download(filePath)

    if (error || !data) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 })
    }

    // 5. Retourner le fichier avec le bon MIME type
    const buffer = await data.arrayBuffer()
    const mimeType = getMimeType(filePath)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600',
        // Permettre l'exécution dans iFrame du même domaine
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
      }
    })

  } catch (err) {
    console.error('Erreur proxy LMS:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
