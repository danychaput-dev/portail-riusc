// app/api/admin/reservistes/antecedents/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Admin seulement — pas adjoint, pas coordonnateur
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: res } = await supabase.from('reservistes').select('role').eq('user_id', user.id).single()
  if (!res || !['superadmin', 'admin'].includes(res.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const { benevole_id, date_verification, statut } = await req.json()
  if (!benevole_id) return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })

  // Si on efface la date → repasse en en_attente
  const newStatut = date_verification ? (statut || 'verifie') : 'en_attente'
  const dateVerif = date_verification || null
  const dateExpir = date_verification
    ? new Date(new Date(date_verification).setFullYear(new Date(date_verification).getFullYear() + 3))
        .toISOString().split('T')[0]
    : null

  await setActingUser(supabaseAdmin, user.id, user.email)

  const { error } = await supabaseAdmin
    .from('reservistes')
    .update({
      antecedents_statut: newStatut,
      antecedents_date_verification: dateVerif,
      antecedents_date_expiration: dateExpir,
    })
    .eq('benevole_id', benevole_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, statut: newStatut, date_verification: dateVerif, date_expiration: dateExpir })
}
