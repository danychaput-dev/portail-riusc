// app/api/heures-benevoles/me/route.ts
//
// Retourne le rapport d'heures de bénévolat du bénévole connecté :
//   - Cumul total (primaires, secondaires, qualifié crédit impôt)
//   - Breakdown par événement (déploiement ou camp)
//
// Respecte l'impersonation (cookie `impersonate`).

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Résoudre benevole_id (via impersonation si admin)
    const impersonateCookie = cookieStore.get('impersonate')?.value
    let benevole_id: string | null = null
    if (impersonateCookie) {
      const { data: acteur } = await supabaseAdmin
        .from('reservistes').select('role').eq('user_id', user.id).single()
      if (acteur && ['superadmin', 'admin', 'coordonnateur'].includes(acteur.role)) {
        benevole_id = impersonateCookie
      }
    }
    if (!benevole_id) {
      const { data: me } = await supabaseAdmin
        .from('reservistes').select('benevole_id').eq('user_id', user.id).single()
      benevole_id = me?.benevole_id || null
    }
    if (!benevole_id) return NextResponse.json({ error: 'Bénévole non trouvé' }, { status: 404 })

    // 1. Cumul total (vue)
    const { data: sommaire } = await supabaseAdmin
      .from('heures_benevoles_par_benevole')
      .select('*')
      .eq('benevole_id', benevole_id)
      .single()

    // 2. Pointages + session (pour connaître le contexte = camp ou déploiement)
    const { data: pointages } = await supabaseAdmin
      .from('pointages')
      .select(`
        id, duree_minutes, statut, heure_arrivee, heure_depart,
        pointage_sessions!inner (
          id, type_contexte, session_id, contexte_nom, contexte_dates, contexte_lieu
        )
      `)
      .eq('benevole_id', benevole_id)
      .not('duree_minutes', 'is', null)

    // 3. Trajets
    const { data: trajets } = await supabaseAdmin
      .from('trajets')
      .select('id, type, deployment_id, camp_session_id, duree_minutes, statut, heure_debut, heure_fin')
      .eq('benevole_id', benevole_id)
      .not('duree_minutes', 'is', null)

    // ── Breakdown par événement ─────────────────────────────────────
    // Clé = `${type_contexte}:${session_id}` (ex: "camp:CAMP_CHICOUTIMI_AVR26" ou "deploiement:<uuid>")
    type EventRow = {
      key: string
      type: 'camp' | 'deploiement'
      id: string
      nom: string
      dates: string | null
      lieu: string | null
      minutes_primaires_approuve: number
      minutes_primaires_total: number
      minutes_secondaires_approuve: number
      minutes_secondaires_total: number
      derniere_activite: string | null
    }
    const eventsMap = new Map<string, EventRow>()

    const touchEvent = (key: string, base: Partial<EventRow>) => {
      if (!eventsMap.has(key)) {
        eventsMap.set(key, {
          key, type: 'camp', id: '', nom: '—', dates: null, lieu: null,
          minutes_primaires_approuve: 0, minutes_primaires_total: 0,
          minutes_secondaires_approuve: 0, minutes_secondaires_total: 0,
          derniere_activite: null, ...base,
        } as EventRow)
      }
      return eventsMap.get(key)!
    }

    // Pointages → primaires
    for (const p of (pointages || []) as any[]) {
      const ses = Array.isArray(p.pointage_sessions) ? p.pointage_sessions[0] : p.pointage_sessions
      if (!ses) continue
      const key = `${ses.type_contexte}:${ses.session_id}`
      const ev = touchEvent(key, {
        type: ses.type_contexte, id: ses.session_id, nom: ses.contexte_nom,
        dates: ses.contexte_dates || null, lieu: ses.contexte_lieu || null,
      })
      const dur = Number(p.duree_minutes || 0)
      if (p.statut === 'approuve') ev.minutes_primaires_approuve += dur
      if (p.statut === 'approuve' || p.statut === 'complete') ev.minutes_primaires_total += dur
      const ts = p.heure_depart || p.heure_arrivee
      if (ts && (!ev.derniere_activite || ts > ev.derniere_activite)) ev.derniere_activite = ts
    }

    // Résoudre les noms de déploiement pour les trajets (on doit récupérer deployments.nom)
    const depIds = [...new Set((trajets || []).map((t: any) => t.deployment_id).filter(Boolean))]
    const { data: deps } = depIds.length > 0
      ? await supabaseAdmin.from('deployments')
          .select('id, nom, lieu, date_debut, date_fin')
          .in('id', depIds)
      : { data: [] as any[] }
    const depMap = new Map<string, any>((deps || []).map((d: any) => [d.id, d]))

    // Résoudre les noms de camps depuis inscriptions_camps (ou la liste statique)
    const campIds = [...new Set((trajets || []).map((t: any) => t.camp_session_id).filter(Boolean))]
    const { data: insc } = campIds.length > 0
      ? await supabaseAdmin.from('inscriptions_camps')
          .select('session_id, camp_nom, camp_dates, camp_lieu')
          .eq('benevole_id', benevole_id)
          .in('session_id', campIds)
      : { data: [] as any[] }
    const campMap = new Map<string, any>((insc || []).map((c: any) => [c.session_id, c]))

    // Trajets → secondaires
    for (const t of (trajets || []) as any[]) {
      let key: string, base: Partial<EventRow>
      if (t.deployment_id) {
        const dep = depMap.get(t.deployment_id)
        key = `deploiement:${t.deployment_id}`
        base = { type: 'deploiement', id: t.deployment_id, nom: dep?.nom || '—',
                 dates: dep ? [dep.date_debut, dep.date_fin].filter(Boolean).join(' → ') : null,
                 lieu: dep?.lieu || null }
      } else if (t.camp_session_id) {
        const camp = campMap.get(t.camp_session_id)
        key = `camp:${t.camp_session_id}`
        base = { type: 'camp', id: t.camp_session_id, nom: camp?.camp_nom || t.camp_session_id,
                 dates: camp?.camp_dates || null, lieu: camp?.camp_lieu || null }
      } else continue
      const ev = touchEvent(key, base)
      const dur = Number(t.duree_minutes || 0)
      if (t.statut === 'approuve') ev.minutes_secondaires_approuve += dur
      if (t.statut === 'approuve' || t.statut === 'complete') ev.minutes_secondaires_total += dur
      const ts = t.heure_fin || t.heure_debut
      if (ts && (!ev.derniere_activite || ts > ev.derniere_activite)) ev.derniere_activite = ts
    }

    // Trier par dernière activité (la plus récente d'abord)
    const evenements = Array.from(eventsMap.values())
      .sort((a, b) => (b.derniere_activite || '').localeCompare(a.derniere_activite || ''))

    return NextResponse.json({
      ok: true,
      benevole_id,
      sommaire: sommaire || {
        eligible_credit_impot: false, qualifie_credit_impot: false,
        heures_primaires_approuve: 0, heures_primaires_total: 0,
        heures_secondaires_approuve: 0, heures_secondaires_total: 0,
      },
      evenements,
    })
  } catch (err: any) {
    console.error('Erreur /api/heures-benevoles/me:', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
