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

  const { data: ouvertsRaw, count } = await supabaseAdmin
    .from('pointages')
    .select('id, pointage_session_id, heure_arrivee', { count: 'exact' })
    .eq('benevole_id', res.benevole_id)
    .is('heure_depart', null)
    .neq('statut', 'annule')

  // Enrichir avec le token et le nom du contexte de chaque session
  // (pour que le menu du bouton QR puisse rediriger directement vers /punch/[token])
  let ouverts: any[] = []
  if (ouvertsRaw && ouvertsRaw.length > 0) {
    const sessIds = ouvertsRaw.map((p: any) => p.pointage_session_id)
    const { data: sessList } = await supabaseAdmin
      .from('pointage_sessions')
      .select('id, token, contexte_nom, contexte_lieu, shift, date_shift')
      .in('id', sessIds)
    const sessMap: Record<string, any> = {}
    for (const s of (sessList || [])) sessMap[(s as any).id] = s
    ouverts = ouvertsRaw.map((p: any) => ({
      ...p,
      token: sessMap[p.pointage_session_id]?.token || null,
      contexte_nom: sessMap[p.pointage_session_id]?.contexte_nom || '',
      contexte_lieu: sessMap[p.pointage_session_id]?.contexte_lieu || null,
      shift: sessMap[p.pointage_session_id]?.shift || null,
      date_shift: sessMap[p.pointage_session_id]?.date_shift || null,
    }))
  }

  // Supervision : combien de personnes sont actuellement actives sur les QR
  // que j'ai créés OU dont je suis l'approuveur désigné ?
  const { data: mesSessions } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id')
    .or(`cree_par.eq.${res.benevole_id},approuveur_id.eq.${res.benevole_id}`)
    .eq('actif', true)

  let supervisingCount = 0
  if (mesSessions && mesSessions.length > 0) {
    const sessIds = mesSessions.map((s: any) => s.id)
    const { count: supCount } = await supabaseAdmin
      .from('pointages')
      .select('id', { count: 'exact', head: true })
      .in('pointage_session_id', sessIds)
      .is('heure_depart', null)
      .neq('statut', 'annule')
      .neq('benevole_id', res.benevole_id)
    supervisingCount = supCount || 0
  }

  return NextResponse.json({
    on_duty: (count || 0) > 0,
    count: count || 0,
    ouverts,
    supervising_count: supervisingCount,
  })
}
