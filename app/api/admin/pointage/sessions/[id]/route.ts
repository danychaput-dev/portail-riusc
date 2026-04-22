// app/api/admin/pointage/sessions/[id]/route.ts
//
// PATCH  — Mettre à jour un champ modifiable d'une pointage_session.
//          Champs supportés : actif, approuveur_id, archived (bool).
// DELETE — Suppression définitive de la session + de tous ses pointages
//          + logs. Reservée à admin/superadmin (coordonnateur et partenaire
//          n'ont pas le droit de hard-delete, ils doivent archiver).
//
// Utilisés par la page /admin/pointage.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierRole(rolesAutorises: string[] = ['superadmin', 'admin', 'coordonnateur', 'partenaire']) {
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
  if (!res || !rolesAutorises.includes(res.role)) return null
  return res
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const body = await req.json()
  const updates: Record<string, any> = {}

  // --- Champs toujours modifiables ---
  if (typeof body.actif === 'boolean') updates.actif = body.actif
  if (typeof body.approuveur_id === 'string' || body.approuveur_id === null) {
    updates.approuveur_id = body.approuveur_id || null
  }

  // Archivage : body.archived = true/false
  if (typeof body.archived === 'boolean') {
    if (body.archived) {
      updates.archived_at = new Date().toISOString()
      updates.archived_by = user.benevole_id
    } else {
      updates.archived_at = null
      updates.archived_by = null
    }
  }

  // --- Champs metadonnees — editables SEULEMENT si aucun pointage n'existe ---
  // (titre, shift, date_shift). On empeche de changer le contexte apres coup.
  const wantsMetaEdit = body.titre !== undefined
    || body.shift !== undefined
    || body.date_shift !== undefined

  if (wantsMetaEdit) {
    // Verifier qu'aucun pointage n'existe sur cette session
    const { count } = await supabaseAdmin
      .from('pointages')
      .select('id', { count: 'exact', head: true })
      .eq('pointage_session_id', id)
    if ((count || 0) > 0) {
      return NextResponse.json({
        error: 'Modification impossible : des pointages existent deja sur cette session. Archive-la et cree un nouveau QR a la place.',
      }, { status: 409 })
    }
    if (body.titre !== undefined) {
      const t = typeof body.titre === 'string' && body.titre.trim() ? body.titre.trim() : null
      updates.titre = t
    }
    if (body.shift !== undefined) {
      if (body.shift && !['jour', 'nuit', 'complet'].includes(body.shift)) {
        return NextResponse.json({ error: 'shift invalide' }, { status: 400 })
      }
      updates.shift = body.shift || null
    }
    if (body.date_shift !== undefined) {
      updates.date_shift = body.date_shift || null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('pointage_sessions')
    .update(updates)
    .eq('id', id)
    .select('id, actif, approuveur_id, archived_at, archived_by, titre, shift, date_shift')
    .single()

  if (error) {
    // Collision unique (un autre QR a deja ce meme contexte/shift/date/titre)
    if (error.message.includes('duplicate') || error.code === '23505') {
      return NextResponse.json(
        { error: 'Un autre QR existe deja pour ce contexte, shift, date et titre. Change le titre.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, session: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Hard-delete reservee a admin/superadmin
  const user = await verifierRole(['superadmin', 'admin'])
  if (!user) {
    return NextResponse.json({ error: 'Suppression reservee aux admin/superadmin. Utilise Archiver a la place.' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  // 1. Récupérer tous les pointages de la session (pour cascader les logs)
  const { data: pointages } = await supabaseAdmin
    .from('pointages')
    .select('id')
    .eq('pointage_session_id', id)
  const pointageIds = (pointages || []).map((p: any) => p.id)

  let nbLogs = 0
  if (pointageIds.length > 0) {
    const { data: deletedLogs } = await supabaseAdmin
      .from('pointage_logs')
      .delete()
      .in('pointage_id', pointageIds)
      .select('id')
    nbLogs = (deletedLogs || []).length
  }

  // 2. Supprimer les pointages
  const { data: deletedPointages } = await supabaseAdmin
    .from('pointages')
    .delete()
    .eq('pointage_session_id', id)
    .select('id')
  const nbPointages = (deletedPointages || []).length

  // 3. Supprimer la session
  const { data: deletedSession, error } = await supabaseAdmin
    .from('pointage_sessions')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deletedSession) {
    return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    deleted: {
      session_id: id,
      nb_pointages: nbPointages,
      nb_logs: nbLogs,
    },
  })
}
