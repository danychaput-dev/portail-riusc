// app/api/admin/notes/fichiers/download/route.ts
// Télécharger un fichier attaché à une note
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
    if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Récupérer le fichier dans la DB
    const { data: fichier } = await supabaseAdmin
      .from('notes_fichiers')
      .select('storage_path, nom_fichier, type_mime')
      .eq('id', id)
      .single()

    if (!fichier) return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 })

    // Télécharger depuis Storage
    const { data: fileData, error: dlError } = await supabaseAdmin.storage
      .from('notes-fichiers')
      .download(fichier.storage_path)

    if (dlError || !fileData) return NextResponse.json({ error: dlError?.message || 'Erreur téléchargement' }, { status: 500 })

    const buffer = Buffer.from(await fileData.arrayBuffer())

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': fichier.type_mime || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fichier.nom_fichier}"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
