// app/api/admin/reservistes/restore/route.ts
// Restaurer un reserviste mis a la corbeille (annule le soft-delete).
// Acces: superadmin uniquement (meme garde que la suppression).

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
  if (!res || res.role !== 'superadmin') return null
  return { user_id: user.id, email: user.email ?? null }
}

export async function POST(request: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { benevole_id } = await request.json()
  if (!benevole_id) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }

  // Verifier que la cible est bien soft-deleted
  const { data: cible, error: errGet } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, deleted_at')
    .eq('benevole_id', benevole_id)
    .single()

  if (errGet || !cible) {
    return NextResponse.json({ error: 'Reserviste introuvable' }, { status: 404 })
  }
  if (!cible.deleted_at) {
    return NextResponse.json({ error: 'Ce reserviste n\'est pas dans la corbeille' }, { status: 400 })
  }

  // Utilise la fonction Postgres qui fait l'update + l'audit dans la meme transaction
  const { data, error } = await supabaseAdmin.rpc('reservistes_restore', {
    p_benevole_id: benevole_id,
    p_caller_user_id: admin.user_id,
    p_caller_email: admin.email,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    restored: data === true,
    benevole_id,
    prenom: cible.prenom,
    nom: cible.nom,
  })
}
