// app/api/punch/on-duty/route.ts
// GET — retourne si l'utilisateur connecté a au moins un pointage en cours
// (heure_depart IS NULL, statut != 'annule'). Utilisé par l'icône QR du header
// pour passer en vert quand le réserviste est "on duty".
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ on_duty: false })

  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id')
    .eq('user_id', user.id)
    .single()
  if (!res) return NextResponse.json({ on_duty: false })

  const { data: ouverts, count } = await supabaseAdmin
    .from('pointages')
    .select('id, pointage_session_id, heure_arrivee', { count: 'exact' })
    .eq('benevole_id', res.benevole_id)
    .is('heure_depart', null)
    .neq('statut', 'annule')

  return NextResponse.json({
    on_duty: (count || 0) > 0,
    count: count || 0,
    ouverts: ouverts || [],
  })
}
