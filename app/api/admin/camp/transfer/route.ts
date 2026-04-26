import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/utils/auth-api'
import { createClient } from '@supabase/supabase-js'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Liste statique des camps 2026 (même source que inscription/page.tsx)
const CAMPS = [
  { session_id: 'CAMP_STE_CATHERINE_MAR26', nom: 'Cohorte 8 - Sainte-Catherine', dates: '14-15 mars 2026', site: 'Centre Municipal Aimé-Guérin', location: 'Sainte-Catherine, QC' },
  { session_id: 'CAMP_CHICOUTIMI_AVR26', nom: 'Cohorte 9 - Chicoutimi', dates: '25-26 avril 2026', site: 'Hôtel Chicoutimi', location: 'Chicoutimi, QC' },
  { session_id: 'CAMP_QUEBEC_MAI26', nom: 'Cohorte 10 - Québec', dates: '23-24 mai 2026', site: 'Campus Notre-Dame-de-Foy', location: 'Québec, QC' },
  { session_id: 'CAMP_RIMOUSKI_SEP26', nom: 'Cohorte 11 - Rimouski', dates: '26-27 sept 2026', site: 'À définir', location: 'Rimouski, QC' },
  { session_id: 'CAMP_SHERBROOKE_OCT26', nom: 'Cohorte 12 - Sherbrooke', dates: '17-18 oct 2026', site: 'À définir', location: 'Sherbrooke, QC' },
  { session_id: 'CAMP_GATINEAU_NOV26', nom: 'Cohorte 13 - Gatineau', dates: '14-15 nov 2026', site: 'À définir', location: 'Gatineau, QC' },
]

/**
 * POST /api/admin/camp/transfer
 * Body: { benevole_ids: string[], target_session_id: string }
 * Transfere un ou plusieurs reservistes vers un autre camp.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole('admin', 'superadmin')
  if (isAuthError(auth)) return auth

  const { benevole_ids, target_session_id } = await request.json()

  if (!benevole_ids?.length || !target_session_id) {
    return NextResponse.json({ error: 'benevole_ids et target_session_id requis' }, { status: 400 })
  }

  const targetCamp = CAMPS.find(c => c.session_id === target_session_id)
  if (!targetCamp) {
    return NextResponse.json({ error: 'Session de camp invalide' }, { status: 400 })
  }

  await setActingUser(supabaseAdmin, auth.user_id, auth.email)

  const results: { benevole_id: string; ok: boolean; message: string }[] = []

  for (const benevole_id of benevole_ids) {
    // Chercher l'inscription actuelle (non annulee)
    const { data: existing } = await supabaseAdmin
      .from('inscriptions_camps')
      .select('id, session_id, camp_nom, presence')
      .eq('benevole_id', benevole_id)
      .neq('presence', 'annule')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!existing) {
      // Pas d'inscription existante — on cree une nouvelle
      const { data: reserviste } = await supabaseAdmin
        .from('reservistes_actifs')
        .select('prenom, nom, email')
        .eq('benevole_id', benevole_id)
        .single()

      if (!reserviste) {
        results.push({ benevole_id, ok: false, message: 'Réserviste introuvable' })
        continue
      }

      const { error } = await supabaseAdmin
        .from('inscriptions_camps')
        .insert({
          benevole_id,
          session_id: target_session_id,
          camp_nom: targetCamp.nom,
          camp_dates: targetCamp.dates,
          camp_lieu: targetCamp.location,
          prenom_nom: `${reserviste.prenom} ${reserviste.nom}`,
          courriel: reserviste.email,
          presence: 'confirme',
          statut_inscription: 'inscrit',
        })

      if (error) {
        results.push({ benevole_id, ok: false, message: error.message })
      } else {
        results.push({ benevole_id, ok: true, message: `Inscrit à ${targetCamp.nom}` })
      }
      continue
    }

    // Deja dans le meme camp
    if (existing.session_id === target_session_id) {
      results.push({ benevole_id, ok: false, message: 'Déjà inscrit à ce camp' })
      continue
    }

    // Log dans inscriptions_camps_logs
    const { data: reserviste } = await supabaseAdmin
      .from('reservistes_actifs')
      .select('prenom, nom')
      .eq('benevole_id', benevole_id)
      .single()

    await supabaseAdmin.from('inscriptions_camps_logs').insert({
      inscription_id: existing.id,
      benevole_id,
      session_id: existing.session_id,
      prenom_nom: reserviste ? `${reserviste.prenom} ${reserviste.nom}` : '',
      presence_avant: existing.presence,
      presence_apres: 'transfere',
      modifie_par: auth.benevole_id,
    })

    // Mettre a jour l'inscription existante
    const { error } = await supabaseAdmin
      .from('inscriptions_camps')
      .update({
        session_id: target_session_id,
        camp_nom: targetCamp.nom,
        camp_dates: targetCamp.dates,
        camp_lieu: targetCamp.location,
        presence: 'confirme',
      })
      .eq('id', existing.id)
      .select()

    if (error) {
      results.push({ benevole_id, ok: false, message: error.message })
    } else {
      results.push({ benevole_id, ok: true, message: `Transféré de ${existing.camp_nom || existing.session_id} → ${targetCamp.nom}` })
    }
  }

  const allOk = results.every(r => r.ok)
  return NextResponse.json({ results }, { status: allOk ? 200 : 207 })
}

/** GET /api/admin/camp/transfer — retourne la liste des camps disponibles */
export async function GET() {
  const auth = await requireRole('admin', 'superadmin')
  if (isAuthError(auth)) return auth

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Filtrer les camps passes
  const dateFins: Record<string, Date> = {
    CAMP_STE_CATHERINE_MAR26: new Date('2026-03-15'),
    CAMP_CHICOUTIMI_AVR26: new Date('2026-04-26'),
    CAMP_QUEBEC_MAI26: new Date('2026-05-24'),
    CAMP_RIMOUSKI_SEP26: new Date('2026-09-27'),
    CAMP_SHERBROOKE_OCT26: new Date('2026-10-18'),
    CAMP_GATINEAU_NOV26: new Date('2026-11-15'),
  }

  const disponibles = CAMPS.filter(c => {
    const fin = dateFins[c.session_id]
    return fin && fin >= today
  })

  return NextResponse.json({ camps: disponibles })
}
