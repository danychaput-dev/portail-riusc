// app/api/admin/config/route.ts
// Lecture/écriture de la table app_config (clé/valeur) — réservé aux admins
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
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin'].includes(res.role)) return null
  return res
}

// GET /api/admin/config?key=mot_de_passe_sante
export async function GET(req: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key requis' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('app_config')
    .select('valeur')
    .eq('cle', key)
    .single()

  return NextResponse.json({ valeur: data?.valeur || '' })
}

// POST /api/admin/config  { key: "mot_de_passe_sante", valeur: "etnas" }
export async function POST(req: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { key, valeur } = await req.json()
  if (!key) return NextResponse.json({ error: 'key requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({ cle: key, valeur }, { onConflict: 'cle' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
