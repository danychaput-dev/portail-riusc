// app/api/admin/formations/restore/route.ts
// Restaurer un certificat/formation mis a la corbeille (annule le soft-delete).
// Acces: admin, coordonnateur ou superadmin.

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
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!res) return null
  if (!['admin', 'coordonnateur', 'superadmin'].includes(res.role)) return null
  return { user_id: user.id, email: user.email ?? null }
}

export async function POST(request: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { formation_id } = await request.json()
  if (!formation_id) {
    return NextResponse.json({ error: 'formation_id requis' }, { status: 400 })
  }

  // Verifier que la cible est bien soft-deleted
  const { data: cible, error: errGet } = await supabaseAdmin
    .from('formations_benevoles')
    .select('id, nom_formation, deleted_at, certificat_url, certificat_url_archive')
    .eq('id', formation_id)
    .single()

  if (errGet || !cible) {
    return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
  }
  if (!cible.deleted_at) {
    return NextResponse.json({ error: 'Cette formation n\'est pas dans la corbeille' }, { status: 400 })
  }

  // RPC qui fait update + audit dans la meme transaction
  const { data, error } = await supabaseAdmin.rpc('formations_restore', {
    p_formation_id: formation_id,
    p_caller_user_id: admin.user_id,
    p_caller_email: admin.email,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Si le certificat_url avait ete archive, le restaurer aussi (cas ou c'etait
  // le reserviste qui avait "supprime" son certificat via /api/certificat/supprimer)
  if (!cible.certificat_url && cible.certificat_url_archive) {
    await supabaseAdmin
      .from('formations_benevoles')
      .update({
        certificat_url: cible.certificat_url_archive,
        certificat_url_archive: null,
      })
      .eq('id', formation_id)
  }

  return NextResponse.json({
    success: true,
    restored: data === true,
    formation_id,
    nom_formation: cible.nom_formation,
  })
}
