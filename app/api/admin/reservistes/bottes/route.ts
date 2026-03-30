// app/api/admin/reservistes/bottes/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Vérifier que l'appelant est admin/coordonnateur/adjoint
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: res } = await supabase
    .from('reservistes')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['admin', 'coordonnateur', 'adjoint'].includes(res.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { benevole_id, date } = await req.json()
  if (!benevole_id) return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('reservistes')
    .update({ remboursement_bottes_date: date ?? null })
    .eq('benevole_id', benevole_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
