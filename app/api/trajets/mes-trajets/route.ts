// app/api/trajets/mes-trajets/route.ts
//
// Retourne :
//   - La liste des trajets du bénévole (ordonnée par date DESC)
//   - L'état actuel (trajet ouvert s'il y en a un)
//   - Les contextes actifs (déploiements en cours + camp inscrit à venir)
//     → utilisés par le TrajetButton du header pour savoir quoi proposer
//
// Query params :
//   - limit (optionnel, défaut 50) : nombre de trajets à retourner

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

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

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    // Trajets
    const { data: trajets } = await supabaseAdmin
      .from('trajets')
      .select('id, type, deployment_id, camp_session_id, heure_debut, heure_fin, duree_minutes, covoiturage, covoiturage_role, covoiturage_with, notes, statut, created_at')
      .eq('benevole_id', benevole_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    const trajetOuvert = (trajets || []).find(t => t.heure_fin === null && t.statut === 'en_cours') || null

    // ── Contextes actifs ────────────────────────────────────────
    // 1) Déploiements où ce bénévole est ciblé/mobilisé, actifs aujourd'hui ou à venir
    const todayISO = new Date().toISOString().slice(0, 10)

    const { data: ciblages } = await supabaseAdmin
      .from('ciblages')
      .select('reference_id, niveau, statut')
      .eq('benevole_id', benevole_id)
      .eq('niveau', 'deploiement')
      .neq('statut', 'retire')

    const depIds = [...new Set((ciblages || []).map(c => c.reference_id).filter(Boolean))]

    let deploiementsActifs: any[] = []
    if (depIds.length > 0) {
      // Un déploiement est "actif" si :
      //   - sa date_fin n'est pas encore passée (>= aujourd'hui)
      //   - OU sa date_fin est NULL (durée indéterminée, considéré en cours)
      const { data: deps } = await supabaseAdmin
        .from('deployments')
        .select('id, nom, lieu, date_debut, date_fin, statut')
        .in('id', depIds)
        .or(`date_fin.is.null,date_fin.gte.${todayISO}`)
      deploiementsActifs = deps || []
    }

    // 2) Camps inscrits à venir (dont la date n'est pas passée)
    const { data: inscCamps } = await supabaseAdmin
      .from('inscriptions_camps')
      .select('session_id, camp_nom, camp_dates, camp_lieu, presence')
      .eq('benevole_id', benevole_id)
      .neq('presence', 'annule')

    // On ne filtre pas par date côté SQL car camp_dates est souvent texte —
    // on laisse le UI décider, mais on renvoie quand même tous les camps inscrits non-annulés.
    const campsInscrits = inscCamps || []

    // 3) Extension : camps/deploiements ou l'utilisateur a CREE ou APPROUVE un QR
    //    actif non-archive. Cas d'usage : chefs d'equipe, partenaires SOPFEU/Croix-
    //    Rouge qui supervisent un camp mais ne sont pas inscrits comme participants.
    //    Ils vont physiquement au camp, donc ont droit de declarer un trajet.
    const { data: qrSupervises } = await supabaseAdmin
      .from('pointage_sessions')
      .select('type_contexte, session_id, contexte_nom, contexte_lieu, contexte_dates')
      .or(`cree_par.eq.${benevole_id},approuveur_id.eq.${benevole_id}`)
      .eq('actif', true)
      .is('archived_at', null)

    if (qrSupervises && qrSupervises.length > 0) {
      // Camps : ajouter ceux qui ne sont pas deja dans campsInscrits
      const campsExistants = new Set(campsInscrits.map((c: any) => c.session_id))
      for (const qr of qrSupervises) {
        if (qr.type_contexte !== 'camp') continue
        if (campsExistants.has(qr.session_id)) continue
        campsInscrits.push({
          session_id: qr.session_id,
          camp_nom: qr.contexte_nom,
          camp_dates: qr.contexte_dates || null,
          camp_lieu: qr.contexte_lieu || null,
          presence: 'superviseur',  // marqueur pour distinguer d'une inscription
        } as any)
        campsExistants.add(qr.session_id)
      }

      // Deploiements : ajouter ceux qui ne sont pas deja dans deploiementsActifs
      const depsExistants = new Set(deploiementsActifs.map((d: any) => d.id))
      const depIdsQR = qrSupervises
        .filter(qr => qr.type_contexte === 'deploiement' && !depsExistants.has(qr.session_id))
        .map(qr => qr.session_id)
      if (depIdsQR.length > 0) {
        const { data: depsFromQR } = await supabaseAdmin
          .from('deployments')
          .select('id, nom, lieu, date_debut, date_fin, statut')
          .in('id', depIdsQR)
          .or(`date_fin.is.null,date_fin.gte.${todayISO}`)
        for (const d of (depsFromQR || [])) {
          if (!depsExistants.has(d.id)) {
            deploiementsActifs.push(d)
            depsExistants.add(d.id)
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      benevole_id,
      trajets: trajets || [],
      trajet_ouvert: trajetOuvert,
      contextes: {
        deploiements: deploiementsActifs,
        camps: campsInscrits,
      },
    })
  } catch (err: any) {
    console.error('Erreur /api/trajets/mes-trajets:', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
