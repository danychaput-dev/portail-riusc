// app/api/admin/verifier-mdp-sante/route.ts
// Vérifie le mot de passe santé — accessible aux admins et coordonnateurs
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Vérifier que l'utilisateur est admin ou coordonnateur
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['admin', 'coordonnateur'].includes(res.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { mot_de_passe } = await req.json()
  if (!mot_de_passe) return NextResponse.json({ ok: false })

  // Lire le mot de passe configuré
  const { data: config } = await supabaseAdmin
    .from('app_config')
    .select('valeur')
    .eq('cle', 'mot_de_passe_sante')
    .single()

  const mdpCorrect = config?.valeur || ''
  if (!mdpCorrect) return NextResponse.json({ ok: false, error: 'Mot de passe non configuré' })

  return NextResponse.json({ ok: mot_de_passe === mdpCorrect })
}
