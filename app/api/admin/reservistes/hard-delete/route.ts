// app/api/admin/reservistes/hard-delete/route.ts
// PURGE DEFINITIVE d'un reserviste deja en corbeille (loi 25 / RGPD).
// Supprime reellement: la fiche, toutes les donnees enfants, et l'audit_log.
// IRREVERSIBLE. Acces: superadmin uniquement.
//
// Securite supplementaire:
//   - Le reserviste DOIT etre deja en corbeille (deleted_at NOT NULL)
//   - Confirmation du nom obligatoire
//   - Raison de purge obligatoire (>= 10 caracteres)

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { TABLES_ENFANTS } from '@/utils/reservistes-tables-enfants'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: res } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, role, prenom, nom')
    .eq('user_id', user.id)
    .single()
  if (!res || res.role !== 'superadmin') return null
  return { ...res, auth_user_id: user.id, auth_email: user.email ?? null }
}

export async function POST(request: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { benevole_id, raison_purge, confirmation_nom } = await request.json()

  if (!benevole_id) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }
  if (!raison_purge || String(raison_purge).trim().length < 10) {
    return NextResponse.json(
      { error: 'Raison de purge obligatoire (minimum 10 caracteres)' },
      { status: 400 }
    )
  }
  if (benevole_id === admin.benevole_id) {
    return NextResponse.json(
      { error: 'Impossible de purger votre propre compte' },
      { status: 400 }
    )
  }

  // Verifier que la cible est bien en corbeille
  const { data: cible, error: errGet } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, deleted_at')
    .eq('benevole_id', benevole_id)
    .single()

  if (errGet || !cible) {
    return NextResponse.json({ error: 'Reserviste introuvable' }, { status: 404 })
  }
  if (!cible.deleted_at) {
    return NextResponse.json(
      { error: 'Le reserviste doit etre dans la corbeille avant la purge definitive' },
      { status: 400 }
    )
  }

  // Confirmation du nom obligatoire (anti-clic accidentel)
  const nomAttendu = `${cible.prenom} ${cible.nom}`.trim().toLowerCase()
  const nomFourni = String(confirmation_nom || '').trim().toLowerCase()
  if (nomAttendu !== nomFourni) {
    return NextResponse.json(
      { error: 'La confirmation du nom ne correspond pas' },
      { status: 400 }
    )
  }

  // 1. Mettre a jour le journal de suppression avec la raison de purge
  await supabaseAdmin
    .from('reservistes_suppressions')
    .update({ raison: `[PURGE DEFINITIVE par ${admin.auth_email || admin.prenom + ' ' + admin.nom}] ${String(raison_purge).trim()}` })
    .eq('benevole_id', benevole_id)

  // 2. Supprimer toutes les donnees enfants
  const erreurs: string[] = []
  for (const table of TABLES_ENFANTS) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('benevole_id', benevole_id)
    if (error && !error.message.includes('does not exist')) {
      erreurs.push(`${table}: ${error.message}`)
    }
  }

  // 3. Purge definitive: supprime reellement la fiche + purge l'audit_log
  // (via fonction Postgres qui fait les 2 dans la meme transaction)
  const { data: auditPurged, error: purgeErr } = await supabaseAdmin.rpc(
    'reservistes_hard_delete',
    { p_benevole_id: benevole_id }
  )

  if (purgeErr) {
    return NextResponse.json(
      {
        error: `Echec purge definitive: ${purgeErr.message}`,
        erreurs_enfants: erreurs,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    hard_delete: true,
    benevole_id,
    audit_entries_purged: auditPurged ?? 0,
    erreurs_enfants: erreurs,
  })
}
