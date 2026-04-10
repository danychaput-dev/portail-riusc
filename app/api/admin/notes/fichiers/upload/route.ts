// app/api/admin/notes/fichiers/upload/route.ts
// Upload un fichier attaché à une note
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

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthAdmin()
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const noteId = formData.get('note_id') as string | null
    const nomFichier = formData.get('nom_fichier') as string | null

    if (!file || !noteId) {
      return NextResponse.json({ error: 'Fichier et note_id requis' }, { status: 400 })
    }

    // Vérifier que la note existe
    const { data: note } = await supabaseAdmin
      .from('notes_reservistes')
      .select('id')
      .eq('id', noteId)
      .single()
    if (!note) return NextResponse.json({ error: 'Note introuvable' }, { status: 404 })

    // Upload vers Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const storagePath = `${noteId}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('notes-fichiers')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
      })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    // Enregistrer dans notes_fichiers
    const { data: fichier, error: dbError } = await supabaseAdmin
      .from('notes_fichiers')
      .insert({
        note_id: noteId,
        nom_fichier: nomFichier || file.name,
        storage_path: storagePath,
        taille: file.size,
        type_mime: file.type || null,
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ ok: true, fichier })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
