// app/api/admin/courriels/config/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: res } = await supabase.from('reservistes').select('role, prenom, nom, email').eq('user_id', user.id).single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null

  return { ...user, reserviste: res }
}

export async function GET() {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { data: config } = await supabaseAdmin
      .from('admin_email_config')
      .select('*')
      .eq('user_id', authUser.id)
      .single()

    // Si pas de config, retourner des valeurs par défaut basées sur le profil
    if (!config) {
      return NextResponse.json({
        config: {
          user_id: authUser.id,
          from_name: `${authUser.reserviste.prenom} ${authUser.reserviste.nom}`,
          from_email: authUser.reserviste.email || `noreply@${process.env.RESEND_FROM_DOMAIN || 'aqbrs.ca'}`,
          signature_html: '',
          reply_to: authUser.reserviste.email || `noreply@${process.env.RESEND_FROM_DOMAIN || 'aqbrs.ca'}`,
        }
      })
    }

    return NextResponse.json({ config })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { from_name, from_email, signature_html, reply_to } = await req.json()

    // Upsert — crée ou met à jour
    const { data, error } = await supabaseAdmin
      .from('admin_email_config')
      .upsert({
        user_id: authUser.id,
        from_name: from_name || '',
        from_email: from_email || `noreply@${process.env.RESEND_FROM_DOMAIN || 'aqbrs.ca'}`,
        signature_html: signature_html || '',
        reply_to: reply_to || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, config: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
