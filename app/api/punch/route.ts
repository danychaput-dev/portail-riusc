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
import { setActingUser } from '@/utils/audit'

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
    .select('benevole_id, prenom, nom, role')
    .eq('user_id', user.id)
    .single()
  if (!res) return null
  // Inclure user_id et email pour la traçabilité audit_log (setActingUser).
  return { ...res, user_id: user.id, email: user.email }
}

// Rôles autorisés à utiliser le mode "prêter son cell"
// (pointer pour un collègue via son courriel).
// Un simple 'reserviste' ne peut pas — évite abus type falsification d'heures
// entre collègues. Admin/coord/partenaire ont une responsabilité de supervision.
const ROLES_AUTORISES_PRET = ['superadmin', 'admin', 'partenaire']

function peutPreter(role: string | null | undefined): boolean {
  if (!role) return false
  return ROLES_AUTORISES_PRET.includes(role)
}

// Mode "appareil partagé": identifier un réserviste par email (sans auth session).
// Utilisé en terrain quand la personne n'a pas son cell et scanne depuis un
// device partagé (tablette du coordonnateur). Trust mode: email seul suffit,
// la vérification visuelle se fait par le coord sur place.
async function getReservisteByEmail(email: string) {
  if (!email || !email.trim()) return null
  const { data } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, email')
    .ilike('email', email.trim())
    .is('deleted_at', null)
    .maybeSingle()
  return data || null
}

// Résout le réserviste.
// SÉCURITÉ: le mode email ("prêter son cell") exige une session active.
//   - Sans session + sans email → 401
//   - Sans session + avec email → 403 (refuse, porte potentielle à falsification d'heures)
//   - Avec session + avec email → utilise l'email (mode prêt, la session du prêteur autorise)
//   - Avec session + sans email → utilise la session (punch pour soi-même)
//
// Retourne { reserviste, via, sessionUser } pour tracer qui a prêté le cell dans l'audit.
async function identifierReserviste(emailFallback?: string | null) {
  const sessionUser = await getCurrentUser()

  if (emailFallback && emailFallback.trim()) {
    // Mode "prêter son cell": requiert session ET rôle autorisé
    if (!sessionUser) {
      return { error: 'session_requise' as const }
    }
    if (!peutPreter(sessionUser.role)) {
      return { error: 'role_non_autorise' as const }
    }
    const res = await getReservisteByEmail(emailFallback)
    if (res) return { reserviste: res, via: 'email' as const, sessionUser }
    return { error: 'email_introuvable' as const }
  }

  if (sessionUser) return { reserviste: sessionUser, via: 'session' as const, sessionUser }
  return { error: 'non_authentifie' as const }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const token: string = body.token
  const action: Action = body.action
  const customTime: string | undefined = body.heure  // ISO string, optionnel pour corrections
  const emailFallback: string | undefined = body.email

  const ident = await identifierReserviste(emailFallback)
  if ('error' in ident) {
    if (ident.error === 'non_authentifie') {
      return NextResponse.json({ error: 'Non authentifié', auth_required: true }, { status: 401 })
    }
    if (ident.error === 'session_requise') {
      return NextResponse.json({
        error: 'Pour pointer pour un collègue, tu dois être connecté sur cet appareil. Demande au propriétaire du cell de se connecter au portail, puis réessaie.',
        session_required: true,
      }, { status: 403 })
    }
    if (ident.error === 'role_non_autorise') {
      return NextResponse.json({
        error: 'Ton rôle ne permet pas de pointer pour un collègue. Seuls les admins, superadmins et partenaires peuvent prêter leur cellulaire.',
        role_forbidden: true,
      }, { status: 403 })
    }
    if (ident.error === 'email_introuvable') {
      return NextResponse.json({ error: 'Courriel introuvable ou compte supprimé' }, { status: 404 })
    }
  }
  const user = ident.reserviste!
  const identifieVia = ident.via
  const preteurBenevoleId = ident.sessionUser?.benevole_id ?? null // audit : qui a prêté le cell

  // Auteur des mutations audit_log : la personne loggée (peut être le réserviste lui-même
  // ou l'admin qui prête son cell). En mode email sans session, on tombe sur null — pas
  // idéal mais c'est rare et pas bloquant (audit best-effort).
  await setActingUser(supabaseAdmin, ident.sessionUser?.user_id ?? null, ident.sessionUser?.email ?? null)

  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }

  // 1. Charger la session
  const { data: session, error: sessErr } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id, actif, approuveur_id, type_contexte, contexte_nom, shift, date_shift, archived_at')
    .eq('token', token)
    .single()
  if (sessErr || !session) {
    return NextResponse.json({ error: 'QR invalide ou introuvable' }, { status: 404 })
  }
  if (session.archived_at) {
    return NextResponse.json({ error: 'Ce QR a été archivé et ne peut plus être utilisé.' }, { status: 403 })
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
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

  const emailFallback = searchParams.get('email')
  const ident = await identifierReserviste(emailFallback)
  if ('error' in ident) {
    if (ident.error === 'non_authentifie') {
      return NextResponse.json({ error: 'Non authentifié', auth_required: true }, { status: 401 })
    }
    if (ident.error === 'session_requise') {
      return NextResponse.json({
        error: 'Connecte-toi au portail pour pouvoir prêter ton cellulaire à un collègue.',
        session_required: true,
      }, { status: 403 })
    }
    if (ident.error === 'role_non_autorise') {
      return NextResponse.json({
        error: 'Ton rôle ne permet pas de pointer pour un collègue.',
        role_forbidden: true,
      }, { status: 403 })
    }
    if (ident.error === 'email_introuvable') {
      return NextResponse.json({ error: 'Courriel introuvable ou compte supprimé' }, { status: 404 })
    }
  }
  const user = ident.reserviste!
  // Flag renvoyé au front pour savoir s'il faut afficher le bouton "Prêter mon cell"
  const peutPreterCell = ident.via === 'session' && peutPreter(ident.sessionUser?.role)

  const { data: session } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id, actif, type_contexte, contexte_nom, contexte_dates, contexte_lieu, shift, date_shift, archived_at')
    .eq('token', token)
    .single()

  if (!session) return NextResponse.json({ error: 'QR invalide' }, { status: 404 })
  if ((session as any).archived_at) {
    return NextResponse.json({ error: 'Ce QR a été archivé et ne peut plus être utilisé.' }, { status: 403 })
  }

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
    peut_preter_cell: peutPreterCell,
    autres_ouverts: (autresOuverts || []).map((a: any) => ({
      id: a.id,
      pointage_session_id: a.pointage_session_id,
      heure_arrivee: a.heure_arrivee,
      contexte_nom: nomMap[a.pointage_session_id] || '—',
    })),
  })
}
