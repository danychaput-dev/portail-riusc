import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

// Client admin (bypass RLS) cree au niveau module pour re-use.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verifie qui appelle et retourne l'utilisateur + son role. Null si non-authentifie.
async function getCaller() {
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
    .select('benevole_id, role, user_id')
    .eq('user_id', user.id)
    .single()
  if (!res) return null
  return { user, reserviste: res }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentification obligatoire
    const caller = await getCaller()
    if (!caller) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { user_id, new_email, benevole_id } = await request.json()
    if (!user_id || !new_email || !benevole_id) {
      return NextResponse.json({ error: 'Parametres manquants' }, { status: 400 })
    }

    // Validation basique du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(new_email)) {
      return NextResponse.json({ error: 'Format email invalide' }, { status: 400 })
    }

    // 2. Autorisation: soit admin/superadmin/coordonnateur, soit le proprietaire
    //    du compte vise (self-service pour changer son propre email).
    const isAdmin = ['superadmin', 'admin', 'coordonnateur'].includes(caller.reserviste.role)
    const isSelf = caller.user.id === user_id && caller.reserviste.benevole_id === benevole_id
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    // 3. Verifier que le couple user_id/benevole_id est coherent cote DB
    //    (empeche un admin de fournir un user_id d'un compte A avec le benevole_id d'un compte B).
    const { data: cible } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, user_id')
      .eq('benevole_id', benevole_id)
      .single()
    if (!cible || cible.user_id !== user_id) {
      return NextResponse.json({ error: 'user_id et benevole_id ne correspondent pas' }, { status: 400 })
    }

    // 4. Mettre a jour auth.users.email via Admin API
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { email: new_email }
    )

    if (authError) {
      console.error('Erreur update auth.users:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // 5. Mettre a jour reservistes.email (audit: tracer l'auteur reel = caller)
    await setActingUser(supabaseAdmin, caller.user.id, caller.user.email)
    const { error: dbError } = await supabaseAdmin
      .from('reservistes')
      .update({ email: new_email })
      .eq('benevole_id', benevole_id)

    if (dbError) {
      console.error('Erreur update reservistes.email:', dbError)
      // auth.users est deja mis a jour - on log mais on ne bloque pas
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Erreur update-email:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
