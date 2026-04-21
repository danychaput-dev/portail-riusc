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

  // Récupérer l'acteur connecté (pour savoir s'il est admin et respecter l'emprunt)
  const { data: acteur } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!acteur) return NextResponse.json({ on_duty: false })

  const acteurIsAdmin = ['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(acteur.role)

  // Si emprunt d'identité par un admin, utiliser le benevole_id et le rôle de la cible
  const impersonateCookie = cookieStore.get('impersonate')?.value
  let res: { benevole_id: string; role: string } = acteur
  if (impersonateCookie && acteurIsAdmin) {
    const { data: cible } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, role')
      .eq('benevole_id', impersonateCookie)
      .single()
    if (cible) res = cible
  }

  const isAdmin = ['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(res.role)

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

  // ── Éligibilité au scan QR ────────────────────────────────────────────────
  // Un utilisateur peut scanner s'il a une raison légitime aujourd'hui :
  //   - admin/coord/adjoint (toujours, pour gestion/test)
  //   - déjà on duty (doit terminer son poste)
  //   - supervise au moins un QR (admin de session)
  //   - inscrit à un camp dont le QR est actif
  //   - ciblé/notifié/mobilisé pour un déploiement dont le QR est actif
  // Sinon, le bouton est caché côté client pour éviter les scans curieux.
  let eligible_today = isAdmin || (count || 0) > 0 || supervisingCount > 0
  if (!eligible_today) {
    // Récupérer toutes les sessions QR actives en une fois
    const { data: actives } = await supabaseAdmin
      .from('pointage_sessions')
      .select('type_contexte, session_id')
      .eq('actif', true)
    if (actives && actives.length > 0) {
      const sessionsCamp = actives.filter(s => s.type_contexte === 'camp').map(s => s.session_id)
      const sessionsDep  = actives.filter(s => s.type_contexte === 'deploiement').map(s => s.session_id)

      // Camp : a-t-il une inscription active dans un de ces session_id ?
      if (sessionsCamp.length > 0) {
        const { count: cmpCount } = await supabaseAdmin
          .from('inscriptions_camps')
          .select('benevole_id', { count: 'exact', head: true })
          .eq('benevole_id', res.benevole_id)
          .in('session_id', sessionsCamp)
        if ((cmpCount || 0) > 0) eligible_today = true
      }

      // Déploiement : a-t-il un ciblage notifié/mobilisé pour un de ces deployment_id ?
      if (!eligible_today && sessionsDep.length > 0) {
        const { count: cibCount } = await supabaseAdmin
          .from('ciblages')
          .select('benevole_id', { count: 'exact', head: true })
          .eq('benevole_id', res.benevole_id)
          .eq('niveau', 'deploiement')
          .in('reference_id', sessionsDep)
          .in('statut', ['cible', 'notifie', 'mobilise'])
        if ((cibCount || 0) > 0) eligible_today = true
      }
    }
  }

  return NextResponse.json({
    on_duty: (count || 0) > 0,
    count: count || 0,
    ouverts,
    supervising_count: supervisingCount,
    eligible_today,
    is_admin: isAdmin,
  })
}
