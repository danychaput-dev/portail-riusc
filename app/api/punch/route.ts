// app/api/punch/route.ts
// POST — Endpoint d'action pour le pointage QR.
// Authentification requise (réserviste connecté).
//
// Body : { token: string, action: 'arrivee' | 'depart' | 'nouvelle_entree'
//        | 'corriger_arrivee' | 'corriger_depart' }
//
// Règles :
// - 'arrivee'           : crée un nouveau pointage heure_arrivee=now, aucun ouvert
// - 'depart'            : ferme le pointage en cours (arrivée sans départ)
// - 'nouvelle_entree'   : crée un pointage même s'il y en a déjà un complet
// - 'corriger_arrivee'  : met à jour heure_arrivee du pointage actif OU le dernier complet
// - 'corriger_depart'   : met à jour heure_depart du dernier pointage complet
//
// Trace toujours dans pointage_logs.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Action = 'arrivee' | 'depart' | 'nouvelle_entree' | 'corriger_arrivee' | 'corriger_depart' | 'annuler'
const VALID_ACTIONS: Action[] = ['arrivee', 'depart', 'nouvelle_entree', 'corriger_arrivee', 'corriger_depart', 'annuler']

async function getCurrentUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom')
    .eq('user_id', user.id)
    .single()
  return res
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const token: string = body.token
  const action: Action = body.action
  const customTime: string | undefined = body.heure  // ISO string, optionnel pour corrections

  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }

  // 1. Charger la session
  const { data: session, error: sessErr } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id, actif, approuveur_id, type_contexte, contexte_nom, shift, date_shift')
    .eq('token', token)
    .single()
  if (sessErr || !session) {
    return NextResponse.json({ error: 'QR invalide ou introuvable' }, { status: 404 })
  }
  if (!session.actif) {
    return NextResponse.json({ error: 'Ce QR a été désactivé' }, { status: 403 })
  }

  // Vérif date : si le QR est pour une date précise, elle doit correspondre à today
  // (confirmation possible via confirm_wrong_date:true pour cas limites comme un quart
  // de nuit qui déborde après minuit)
  if (session.date_shift && action !== 'corriger_arrivee' && action !== 'corriger_depart' && !body.confirm_wrong_date) {
    // IMPORTANT : le serveur Vercel tourne en UTC. `new Date().getDate()` renvoie
    // le jour UTC. Ex : à 20h Montréal (UTC-4 l'été), il est 00h UTC le lendemain,
    // donc getDate() renvoyait « demain » → faux wrong_date. On force America/Montreal.
    // Le locale 'en-CA' retourne YYYY-MM-DD ce qui matche le format de date_shift.
    const localToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Montreal' })
    if (session.date_shift !== localToday) {
      return NextResponse.json({
        error: 'wrong_date',
        message: `Ce QR est pour le ${session.date_shift}, mais aujourd'hui on est le ${localToday}. Es-tu certain ?`,
        qr_date: session.date_shift,
        today: localToday,
      }, { status: 409 })
    }
  }

  // 2. Chercher le dernier pointage de ce réserviste pour cette session
  const { data: lastPointage } = await supabaseAdmin
    .from('pointages')
    .select('id, heure_arrivee, heure_depart, statut')
    .eq('benevole_id', user.benevole_id)
    .eq('pointage_session_id', session.id)
    .order('heure_arrivee', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const now = new Date().toISOString()
  const heureCible = customTime || now

  // 3. Traiter selon l'action
  if (action === 'arrivee') {
    // Refuser si un pointage est déjà en cours SUR CETTE session
    if (lastPointage && lastPointage.heure_arrivee && !lastPointage.heure_depart) {
      return NextResponse.json({
        error: 'Tu as déjà un pointage en cours. Utilise « Terminer » ou « Corriger l\'arrivée ».',
        existing: lastPointage,
      }, { status: 409 })
    }

    // Garde-fou : si pointage ouvert sur UN AUTRE QR, refuser sauf close_others:true
    if (!body.close_others) {
      const { data: autresOuverts } = await supabaseAdmin
        .from('pointages')
        .select('id, pointage_session_id, heure_arrivee')
        .eq('benevole_id', user.benevole_id)
        .is('heure_depart', null)
        .neq('pointage_session_id', session.id)
      if (autresOuverts && autresOuverts.length > 0) {
        // Récupérer le contexte_nom de chaque autre session en une requête
        const sessIds = Array.from(new Set(autresOuverts.map((a: any) => a.pointage_session_id)))
        const { data: sessList } = await supabaseAdmin
          .from('pointage_sessions')
          .select('id, contexte_nom')
          .in('id', sessIds)
        const nomMap: Record<string, string> = {}
        for (const s of (sessList || [])) nomMap[(s as any).id] = (s as any).contexte_nom
        return NextResponse.json({
          error: 'open_elsewhere',
          message: 'Tu as un pointage en cours sur un autre QR.',
          autres: autresOuverts.map((a: any) => ({
            id: a.id,
            pointage_session_id: a.pointage_session_id,
            heure_arrivee: a.heure_arrivee,
            contexte_nom: nomMap[a.pointage_session_id] || '—',
          })),
        }, { status: 409 })
      }
    } else {
      // Fermeture automatique des autres pointages ouverts avant de créer le nouveau
      const now = heureCible
      const { data: fermes } = await supabaseAdmin
        .from('pointages')
        .update({ heure_depart: now })
        .eq('benevole_id', user.benevole_id)
        .is('heure_depart', null)
        .neq('pointage_session_id', session.id)
        .select('id, pointage_session_id, heure_arrivee')
      if (fermes && fermes.length > 0) {
        for (const f of fermes) {
          await supabaseAdmin.from('pointage_logs').insert({
            pointage_id: f.id, benevole_id: user.benevole_id,
            action: 'depart', valeur_apres: now,
            notes: 'Fermeture automatique — nouveau scan sur un autre QR',
            modifie_par: user.benevole_id,
          })
        }
      }
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('pointages')
      .insert({
        benevole_id: user.benevole_id,
        pointage_session_id: session.id,
        heure_arrivee: heureCible,
        source: 'qr_scan',
        approuveur_id: session.approuveur_id,
      })
      .select('id, heure_arrivee, statut')
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    await supabaseAdmin.from('pointage_logs').insert({
      pointage_id: inserted.id, benevole_id: user.benevole_id,
      action: 'arrivee', valeur_apres: heureCible, modifie_par: user.benevole_id,
    })
    return NextResponse.json({ ok: true, pointage: inserted, action: 'arrivee' })
  }

  if (action === 'depart') {
    if (!lastPointage || !lastPointage.heure_arrivee || lastPointage.heure_depart) {
      return NextResponse.json({
        error: "Aucun pointage en cours à terminer. Utilise « Commencer » d'abord.",
      }, { status: 409 })
    }
    // Garde-fou : si la durée est < 5 min, demander confirmation (sauf si confirm_short:true)
    const dureeMin = (new Date(heureCible).getTime() - new Date(lastPointage.heure_arrivee).getTime()) / 60000
    if (dureeMin < 5 && !body.confirm_short) {
      return NextResponse.json({
        error: 'short_duration',
        message: `Tu as pointé ton arrivée il y a seulement ${Math.floor(dureeMin)} minute(s). Es-tu certain de vouloir terminer ?`,
        duree_minutes: Math.floor(dureeMin),
        heure_arrivee: lastPointage.heure_arrivee,
      }, { status: 409 })
    }
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('pointages')
      .update({ heure_depart: heureCible })
      .eq('id', lastPointage.id)
      .select('id, heure_arrivee, heure_depart, duree_minutes, statut')
      .single()
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    await supabaseAdmin.from('pointage_logs').insert({
      pointage_id: lastPointage.id, benevole_id: user.benevole_id,
      action: 'depart', valeur_apres: heureCible, modifie_par: user.benevole_id,
    })
    return NextResponse.json({ ok: true, pointage: updated, action: 'depart' })
  }

  if (action === 'nouvelle_entree') {
    // Nouvelle entrée — refusée s'il y a déjà un pointage ouvert (il faut le fermer d'abord)
    if (lastPointage && lastPointage.heure_arrivee && !lastPointage.heure_depart) {
      return NextResponse.json({
        error: 'Un pointage est déjà en cours. Termine-le avant d\'en ouvrir un nouveau.',
      }, { status: 409 })
    }

    // Même garde-fou que 'arrivee' : refuser si pointage ouvert sur un autre QR
    if (!body.close_others) {
      const { data: autresOuverts } = await supabaseAdmin
        .from('pointages')
        .select('id, pointage_session_id, heure_arrivee')
        .eq('benevole_id', user.benevole_id)
        .is('heure_depart', null)
        .neq('pointage_session_id', session.id)
      if (autresOuverts && autresOuverts.length > 0) {
        const sessIds = Array.from(new Set(autresOuverts.map((a: any) => a.pointage_session_id)))
        const { data: sessList } = await supabaseAdmin
          .from('pointage_sessions')
          .select('id, contexte_nom')
          .in('id', sessIds)
        const nomMap: Record<string, string> = {}
        for (const s of (sessList || [])) nomMap[(s as any).id] = (s as any).contexte_nom
        return NextResponse.json({
          error: 'open_elsewhere',
          message: 'Tu as un pointage en cours sur un autre QR.',
          autres: autresOuverts.map((a: any) => ({
            id: a.id,
            pointage_session_id: a.pointage_session_id,
            heure_arrivee: a.heure_arrivee,
            contexte_nom: nomMap[a.pointage_session_id] || '—',
          })),
        }, { status: 409 })
      }
    } else {
      // Fermer les autres avant de créer la nouvelle entrée
      const now = heureCible
      const { data: fermes } = await supabaseAdmin
        .from('pointages')
        .update({ heure_depart: now })
        .eq('benevole_id', user.benevole_id)
        .is('heure_depart', null)
        .neq('pointage_session_id', session.id)
        .select('id, pointage_session_id, heure_arrivee')
      if (fermes && fermes.length > 0) {
        for (const f of fermes) {
          await supabaseAdmin.from('pointage_logs').insert({
            pointage_id: f.id, benevole_id: user.benevole_id,
            action: 'depart', valeur_apres: now,
            notes: 'Fermeture automatique — nouvelle entrée sur un autre QR',
            modifie_par: user.benevole_id,
          })
        }
      }
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('pointages')
      .insert({
        benevole_id: user.benevole_id,
        pointage_session_id: session.id,
        heure_arrivee: heureCible,
        source: 'qr_scan',
        approuveur_id: session.approuveur_id,
      })
      .select('id, heure_arrivee, statut')
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    await supabaseAdmin.from('pointage_logs').insert({
      pointage_id: inserted.id, benevole_id: user.benevole_id,
      action: 'nouvelle_entree', valeur_apres: heureCible, modifie_par: user.benevole_id,
    })
    return NextResponse.json({ ok: true, pointage: inserted, action: 'nouvelle_entree' })
  }

  if (action === 'annuler') {
    // Cas : la personne a scanné le mauvais QR, veut supprimer complètement
    // son entrée. On fait un soft-delete via statut='annule' + heure_depart
    // égale à heure_arrivee (pour que le partial unique index libère la session).
    if (!lastPointage || !lastPointage.heure_arrivee) {
      return NextResponse.json({ error: 'Aucun pointage à annuler' }, { status: 409 })
    }
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('pointages')
      .update({
        heure_depart: lastPointage.heure_arrivee,
        statut: 'annule',
        notes: (body.notes || 'Annulé par le réserviste (mauvais QR scanné)'),
      })
      .eq('id', lastPointage.id)
      .select('id, heure_arrivee, heure_depart, statut')
      .single()
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    await supabaseAdmin.from('pointage_logs').insert({
      pointage_id: lastPointage.id, benevole_id: user.benevole_id,
      action: 'annule', valeur_avant: lastPointage.heure_arrivee, valeur_apres: null,
      notes: body.notes || 'Annulé par le réserviste (mauvais QR scanné)',
      modifie_par: user.benevole_id,
    })
    return NextResponse.json({ ok: true, pointage: updated, action: 'annuler' })
  }

  if (action === 'corriger_arrivee' || action === 'corriger_depart') {
    if (!lastPointage) {
      return NextResponse.json({ error: 'Aucun pointage à corriger' }, { status: 409 })
    }
    if (!customTime) {
      return NextResponse.json({ error: 'heure requise pour une correction' }, { status: 400 })
    }
    const field = action === 'corriger_arrivee' ? 'heure_arrivee' : 'heure_depart'
    const valeurAvant = (lastPointage as any)[field] || null

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('pointages')
      .update({ [field]: customTime })
      .eq('id', lastPointage.id)
      .select('id, heure_arrivee, heure_depart, duree_minutes, statut')
      .single()
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    await supabaseAdmin.from('pointage_logs').insert({
      pointage_id: lastPointage.id, benevole_id: user.benevole_id,
      action, valeur_avant: valeurAvant, valeur_apres: customTime,
      modifie_par: user.benevole_id,
    })
    return NextResponse.json({ ok: true, pointage: updated, action })
  }

  return NextResponse.json({ error: 'action non gérée' }, { status: 400 })
}

// GET — Retourne l'état actuel (session + dernier pointage de l'utilisateur) pour un token donné.
// Utilisé par la page /punch/[token] pour afficher les bons boutons.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const { data: session } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id, actif, type_contexte, contexte_nom, contexte_dates, contexte_lieu, shift, date_shift')
    .eq('token', token)
    .single()

  if (!session) return NextResponse.json({ error: 'QR invalide' }, { status: 404 })

  const { data: lastPointage } = await supabaseAdmin
    .from('pointages')
    .select('id, heure_arrivee, heure_depart, duree_minutes, statut')
    .eq('benevole_id', user.benevole_id)
    .eq('pointage_session_id', session.id)
    .order('heure_arrivee', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  // Pointages ouverts sur D'AUTRES QR (l'utilisateur a oublié de fermer quelque part)
  const { data: autresOuverts } = await supabaseAdmin
    .from('pointages')
    .select('id, pointage_session_id, heure_arrivee')
    .eq('benevole_id', user.benevole_id)
    .is('heure_depart', null)
    .neq('pointage_session_id', session.id)

  // Récupérer les contexte_nom en une seconde requête (plus fiable que la jointure)
  let nomMap: Record<string, string> = {}
  if (autresOuverts && autresOuverts.length > 0) {
    const sessIds = Array.from(new Set(autresOuverts.map((a: any) => a.pointage_session_id)))
    const { data: sessList } = await supabaseAdmin
      .from('pointage_sessions')
      .select('id, contexte_nom')
      .in('id', sessIds)
    for (const s of (sessList || [])) nomMap[(s as any).id] = (s as any).contexte_nom
  }

  return NextResponse.json({
    reserviste: { prenom: user.prenom, nom: user.nom },
    session,
    pointage: lastPointage,
    autres_ouverts: (autresOuverts || []).map((a: any) => ({
      id: a.id,
      pointage_session_id: a.pointage_session_id,
      heure_arrivee: a.heure_arrivee,
      contexte_nom: nomMap[a.pointage_session_id] || '—',
    })),
  })
}
