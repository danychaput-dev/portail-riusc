// app/api/admin/reservistes/groupe/route.ts
// Changement rapide du groupe d'un reserviste (Approuve, Retrait temporaire, etc.)
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
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return res
}

const GROUPES_VALIDES = ['Approuvé', 'Intérêt', 'Retrait temporaire', 'Retiré']

export async function PATCH(request: NextRequest) {
  const caller = await verifierRole()
  if (!caller) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { benevole_id, groupe } = await request.json()
  if (!benevole_id || !groupe) {
    return NextResponse.json({ error: 'benevole_id et groupe requis' }, { status: 400 })
  }

  if (!GROUPES_VALIDES.includes(groupe)) {
    return NextResponse.json({ error: `Groupe invalide. Valeurs acceptees: ${GROUPES_VALIDES.join(', ')}` }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('reservistes')
    .update({ groupe })
    .eq('benevole_id', benevole_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, benevole_id, groupe })
}
