import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { user_id, email, telephone, auth_method, benevole_id } = await req.json()
    if (!user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })

    const ua = req.headers.get('user-agent') || null

    // 1. Logger dans auth_logs (connexion réussie)
    await supabaseAdmin.from('auth_logs').insert({
      user_id,
      email: email || null,
      telephone: telephone || null,
      event_type: auth_method === 'sms_otp' ? 'login_sms' : 'login_email',
      auth_method: auth_method || null,
      user_agent: ua,
      metadata: {},
    })

    // 2. Logger dans audit_pages (marqueur __connexion__)
    await supabaseAdmin.from('audit_pages').insert({
      user_id,
      benevole_id: benevole_id || null,
      page: '__connexion__',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[log-success] Erreur:', err)
    return NextResponse.json({ ok: true }) // Silent fail — ne pas bloquer le login
  }
}
