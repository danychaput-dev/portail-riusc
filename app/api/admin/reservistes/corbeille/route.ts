// app/api/admin/reservistes/corbeille/route.ts
// Liste les reservistes en corbeille (soft-deleted).
// Acces: superadmin uniquement.

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
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
  return user
}

export async function GET() {
  const caller = await verifierAdmin()
  if (!caller) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  // On lit directement la table reservistes (pas la vue) car on veut les soft-deleted
  const { data, error } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, email, role, groupe, deleted_at, deleted_reason, deleted_by_user_id')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entries: data || [] })
}
