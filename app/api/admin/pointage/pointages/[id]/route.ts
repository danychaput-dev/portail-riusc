// app/api/admin/pointage/pointages/[id]/route.ts
// PATCH — modifier un pointage côté admin (corriger heures, approuver, contester, annuler)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierRole() {
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
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur', 'partenaire', 'partenaire_lect'].includes(res.role)) return null
  return res
}

type Action = 'edit' | 'approuver' | 'contester' | 'annuler' | 'reset'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id: pointageId } = await ctx.params
  const body = await req.json()
  const action: Action = body.action
  const notes: string | undefined = body.notes

  if (!['edit', 'approuver', 'contester', 'annuler', 'reset'].includes(action)) {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }

  // Charger le pointage + la session pour check permissions
  const { data: pointage } = await supabaseAdmin
    .from('pointages')
    .select('id, benevole_id, pointage_session_id, heure_arrivee, heure_depart, statut, notes')
    .eq('id', pointageId)
    .single()
  if (!pointage) return NextResponse.json({ error: 'Pointage introuvable' }, { status: 404 })

  const { data: session } = await supabaseAdmin
    .from('pointage_sessions')
    .select('approuveur_id')
    .eq('id', pointage.pointage_session_id)
    .single()

  // Permissions :
  // - superadmin / admin : tout
  // - coordonnateur : peut corriger (edit) mais pas approuver/contester
  // - partenaire (approuveur désigné) : peut tout SUR SA SESSION
  // - partenaire_lect : lecture seule (refus)
  const isAdminLike = user.role === 'superadmin' || user.role === 'admin'
  const isDesignatedApprouveur = session?.approuveur_id === user.benevole_id
  if (user.role === 'partenaire_lect') {
    return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })
  }
  if (user.role === 'partenaire' && !isDesignatedApprouveur) {
    return NextResponse.json({ error: 'Tu n\'es pas l\'approuveur désigné pour cette session.' }, { status: 403 })
  }
  if (user.role === 'coordonnateur' && (action === 'approuver' || action === 'contester')) {
    return NextResponse.json({ error: 'Approbation réservée à l\'approuveur désigné ou à un admin.' }, { status: 403 })
  }

  // Traitement selon action
  if (action === 'edit') {
    // Corriger heures manuellement
    const updates: Record<string, any> = {}
    if (body.heure_arrivee !== undefined) updates.heure_arrivee = body.heure_arrivee || null
    if (body.heure_depart !== undefined) updates.heure_depart = body.heure_depart || null
    if (notes !== undefined) updates.notes = notes
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })
    }
    const { data: updated, error } = await supabaseAdmin
      .from('pointages')
      .update(updates)
      .eq('id', pointageId)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Logger les champs modifiés
    if (updates.heure_arrivee !== undefined && updates.heure_arrivee !== pointage.heure_arrivee) {
      await supabaseAdmin.from('pointage_logs').insert({
        pointage_id: pointageId, benevole_id: pointage.benevole_id,
        action: 'correction_arrivee',
        valeur_avant: pointage.heure_arrivee, valeur_apres: updates.heure_arrivee,
        notes: notes || null, modifie_par: user.benevole_id,
      })
    }
    if (updates.heure_depart !== undefined && updates.heure_depart !== pointage.heure_depart) {
      await supabaseAdmin.from('pointage_logs').insert({
        pointage_id: pointageId, benevole_id: pointage.benevole_id,
        action: 'correction_depart',
        valeur_avant: pointage.heure_depart, valeur_apres: updates.heure_depart,
        notes: notes || null, modifie_par: user.benevole_id,
      })
    }
    return NextResponse.json({ ok: true, pointage: updated })
  }

  if (action === 'approuver' || action === 'contester' || action === 'annuler') {
    const newStatut = action === 'approuver' ? 'approuve' : action === 'contester' ? 'conteste' : 'annule'
    const updates: Record<string, any> = { statut: newStatut }
    if (action === 'approuver') {
      updates.approuve_par = user.benevole_id
      updates.approuve_at = new Date().toISOString()
    }
    if (notes) updates.notes = notes

    const { data: updated, error } = await supabaseAdmin
      .from('pointages')
      .update(updates)
      .eq('id', pointageId)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('pointage_logs').insert({
      pointage_id: pointageId, benevole_id: pointage.benevole_id,
      action: action === 'approuver' ? 'approuve' : action === 'contester' ? 'conteste' : 'annule',
      valeur_avant: pointage.statut, valeur_apres: newStatut,
      notes: notes || null, modifie_par: user.benevole_id,
    })
    return NextResponse.json({ ok: true, pointage: updated })
  }

  if (action === 'reset') {
    // Remet le statut à en_cours / complete selon les heures
    if (!isAdminLike) {
      return NextResponse.json({ error: 'Admin seulement' }, { status: 403 })
    }
    const newStatut = pointage.heure_depart ? 'complete' : 'en_cours'
    const { data: updated, error } = await supabaseAdmin
      .from('pointages')
      .update({ statut: newStatut, approuve_par: null, approuve_at: null })
      .eq('id', pointageId)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('pointage_logs').insert({
      pointage_id: pointageId, benevole_id: pointage.benevole_id,
      action: 'annule', valeur_avant: pointage.statut, valeur_apres: newStatut,
      notes: notes || 'Reset du statut par admin',
      modifie_par: user.benevole_id,
    })
    return NextResponse.json({ ok: true, pointage: updated })
  }

  return NextResponse.json({ error: 'action non gérée' }, { status: 400 })
}
