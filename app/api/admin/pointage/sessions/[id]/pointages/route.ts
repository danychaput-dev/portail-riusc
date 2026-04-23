// app/api/admin/pointage/sessions/[id]/pointages/route.ts
// GET  — liste des pointages d'une session (avec infos réservistes enrichies)
// POST — création manuelle d'un pointage (cas "oublié de scanner")
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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id: sessionId } = await ctx.params

  // La session (pour retourner metadata)
  const { data: session } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id, type_contexte, session_id, contexte_nom, contexte_dates, contexte_lieu, shift, date_shift, actif, approuveur_id, created_at')
    .eq('id', sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  // Aucune restriction par approuveur_id: tous les admin/superadmin/coordonnateur/
  // partenaire/partenaire_lect peuvent voir les pointages de n'importe quelle session.
  // Justification (2026-04-23): les partenaires doivent pouvoir approuver pour leurs
  // collègues (ex: Laurence SOPFEU absente le samedi, un autre partenaire prend le relais).

  // Approbateur info
  let approuveur = null
  if (session.approuveur_id) {
    const { data: app } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, prenom, nom')
      .eq('benevole_id', session.approuveur_id)
      .single()
    approuveur = app ? { benevole_id: app.benevole_id, nom: `${app.prenom} ${app.nom}` } : null
  }

  // Pointages pour cette session
  const { data: pointages } = await supabaseAdmin
    .from('pointages')
    .select('id, benevole_id, heure_arrivee, heure_depart, duree_minutes, statut, source, notes, approuveur_id, approuve_par, approuve_at, created_at, updated_at')
    .eq('pointage_session_id', sessionId)
    .order('heure_arrivee', { ascending: false, nullsFirst: false })

  // Enrichir avec les infos réservistes + approuveur qui a approuvé
  const bIds = Array.from(new Set((pointages || []).flatMap((p: any) =>
    [p.benevole_id, p.approuve_par].filter(Boolean)
  )))
  const { data: resList } = bIds.length > 0
    ? await supabaseAdmin.from('reservistes').select('benevole_id, prenom, nom').in('benevole_id', bIds)
    : { data: [] }
  const resMap: Record<string, { prenom: string; nom: string }> = {}
  for (const r of (resList || [])) resMap[(r as any).benevole_id] = { prenom: (r as any).prenom, nom: (r as any).nom }

  const enriched = (pointages || []).map((p: any) => ({
    ...p,
    reserviste_nom: resMap[p.benevole_id] ? `${resMap[p.benevole_id].prenom} ${resMap[p.benevole_id].nom}` : p.benevole_id,
    approuve_par_nom: p.approuve_par && resMap[p.approuve_par] ? `${resMap[p.approuve_par].prenom} ${resMap[p.approuve_par].nom}` : null,
  }))

  return NextResponse.json({ session, approuveur, pointages: enriched })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id: sessionId } = await ctx.params
  const { benevole_id, heure_arrivee, heure_depart, notes } = await req.json()

  if (!benevole_id || !heure_arrivee) {
    return NextResponse.json({ error: 'benevole_id et heure_arrivee requis' }, { status: 400 })
  }
  if (!notes || !notes.trim()) {
    return NextResponse.json({ error: 'Une note est obligatoire pour les créations manuelles (raison).' }, { status: 400 })
  }

  // Vérif session + approuveur + restriction partenaire
  const { data: session } = await supabaseAdmin
    .from('pointage_sessions')
    .select('id, approuveur_id')
    .eq('id', sessionId)
    .single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
  // partenaire_lect reste en lecture seule (ne peut pas créer un pointage manuel)
  if (user.role === 'partenaire_lect') return NextResponse.json({ error: 'Lecture seule' }, { status: 403 })
  // partenaire (écriture) peut créer pour n'importe quelle session (pas de restriction approuveur_id)

  // Vérif benevole existe
  const { data: benef } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id')
    .eq('benevole_id', benevole_id)
    .single()
  if (!benef) return NextResponse.json({ error: 'Réserviste introuvable' }, { status: 400 })

  const { data: inserted, error } = await supabaseAdmin
    .from('pointages')
    .insert({
      benevole_id,
      pointage_session_id: sessionId,
      heure_arrivee,
      heure_depart: heure_depart || null,
      source: 'manuel',
      approuveur_id: session.approuveur_id,
      notes: notes.trim(),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('pointage_logs').insert({
    pointage_id: inserted.id, benevole_id,
    action: 'creation_manuelle',
    valeur_apres: heure_arrivee,
    notes: notes.trim(),
    modifie_par: user.benevole_id,
  })

  return NextResponse.json({ ok: true, pointage_id: inserted.id })
}
