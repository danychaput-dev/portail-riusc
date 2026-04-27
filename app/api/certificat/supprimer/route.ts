// app/api/certificat/supprimer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Auth requise : sans cette vérif, n'importe qui pouvait POST un formation_id
    // et supprimer le certificat d'autrui (la vérif eq.benevole_id ne suffisait pas
    // car le caller pouvait connaître les deux IDs).
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    const { formation_id, benevole_id, storage_path } = body

    if (!formation_id || !benevole_id) {
      return NextResponse.json({ error: 'formation_id et benevole_id requis' }, { status: 400 })
    }

    // Le réserviste ne peut supprimer que ses propres certificats.
    // Les admins peuvent supprimer ceux de n'importe qui.
    const { data: caller } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, role')
      .eq('user_id', user.id)
      .single()
    const isAdmin = caller && ['superadmin', 'admin', 'coordonnateur'].includes(caller.role)
    if (!isAdmin && caller?.benevole_id !== benevole_id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Vérifier que la formation appartient bien à ce réserviste
    const { data: formation, error: fetchError } = await supabaseAdmin
      .from('formations_benevoles')
      .select('id, benevole_id, certificat_url')
      .eq('id', formation_id)
      .eq('benevole_id', benevole_id)
      .single()

    if (fetchError || !formation) {
      return NextResponse.json({ error: 'Formation introuvable ou non autorisée' }, { status: 403 })
    }

    await setActingUser(supabaseAdmin, user.id, user.email)

    // IMPORTANT: NE PAS supprimer le fichier du Storage (protection anti-perte).
    // On conserve le fichier et l'URL dans certificat_url_archive pour pouvoir
    // le restaurer si la suppression etait accidentelle.
    const { error: updateError } = await supabaseAdmin
      .from('formations_benevoles')
      .update({
        certificat_url: null,
        certificat_url_archive: formation.certificat_url,
      })
      .eq('id', formation_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
