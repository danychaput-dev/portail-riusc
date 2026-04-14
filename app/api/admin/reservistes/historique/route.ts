// app/api/admin/reservistes/historique/route.ts
// Retourne l'historique complet des modifications d'un reserviste depuis audit_log.
// Usage: GET /api/admin/reservistes/historique?benevole_id=...&limit=200
// Acces: admin, superadmin, coordonnateur

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Champs techniques qu'on n'affiche pas dans la timeline
const CHAMPS_TECHNIQUES = new Set([
  'updated_at',
  'created_at',
])

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
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '200', 10), 1000)
  const includeTechniques = request.nextUrl.searchParams.get('all') === '1'

  if (!benevole_id) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('id, action, field_name, old_value, new_value, full_snapshot, changed_by_email, changed_at')
    .eq('table_name', 'reservistes')
    .eq('record_id', benevole_id)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const entries = (data || []).filter((e) =>
    includeTechniques || !e.field_name || !CHAMPS_TECHNIQUES.has(e.field_name)
  )

  return NextResponse.json({ entries })
}
