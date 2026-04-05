// app/api/admin/reserviste-detail/route.ts
// Charge un réserviste par benevole_id (service_role, réservé aux admins/coordonnateurs)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierRole() {
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
  if (!res || !['admin', 'coordonnateur', 'adjoint'].includes(res.role)) return null
  return res
}

export async function GET(req: NextRequest) {
  const admin = await verifierRole()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const bid = req.nextUrl.searchParams.get('bid')
  if (!bid) return NextResponse.json({ error: 'bid requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('reservistes')
    .select('*')
    .eq('benevole_id', bid)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Réserviste non trouvé' }, { status: 404 })
  }

  return NextResponse.json({ reserviste: data })
}
