// app/api/admin/reservistes/historique-retraits/route.ts
// Retourne l'historique des retraits temporaires + reactivations d'un reserviste
// Usage: GET /api/admin/reservistes/historique-retraits?benevole_id=...
// Acces: admin, superadmin, coordonnateur

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierCaller() {
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
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return user
}

export async function GET(request: NextRequest) {
  const caller = await verifierCaller()
  if (!caller) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const benevole_id = request.nextUrl.searchParams.get('benevole_id')
  if (!benevole_id) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('retraits_temporaires')
    .select('id, action, raison, effectue_le, effectue_par_email, groupe_au_moment, retrait_parent_id')
    .eq('entity_type', 'reserviste')
    .eq('entity_id', benevole_id)
    .order('effectue_le', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entries: data || [] })
}
