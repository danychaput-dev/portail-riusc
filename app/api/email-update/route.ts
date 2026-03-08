import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { user_id, new_email, benevole_id } = await request.json()

    if (!user_id || !new_email || !benevole_id) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // Validation basique du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(new_email)) {
      return NextResponse.json({ error: 'Format email invalide' }, { status: 400 })
    }

    // Client admin avec service_role key (bypass RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Mettre à jour auth.users.email via Admin API
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { email: new_email }
    )

    if (authError) {
      console.error('Erreur update auth.users:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // 2. Mettre à jour reservistes.email
    const { error: dbError } = await supabaseAdmin
      .from('reservistes')
      .update({ email: new_email })
      .eq('benevole_id', benevole_id)

    if (dbError) {
      console.error('Erreur update reservistes.email:', dbError)
      // auth.users est déjà mis à jour — on log mais on ne bloque pas
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Erreur update-email:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
