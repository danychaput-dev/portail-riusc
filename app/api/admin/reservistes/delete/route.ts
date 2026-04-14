// app/api/admin/reservistes/delete/route.ts
// SOFT-DELETE UNITAIRE d'un reserviste avec raison obligatoire et journalisation.
// Le reserviste est marque deleted_at = now() mais ses donnees ne sont PAS purgees.
// Restauration possible via /api/admin/reservistes/restore.
// Purge definitive via /api/admin/reservistes/hard-delete (superadmin uniquement).
// Conforme loi 25: on conserve le minimum (nom, prenom, role, groupe, raison, auteur, date)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

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
    .select('benevole_id, prenom, nom, role, user_id')
    .eq('user_id', user.id)
    .single()
  if (!res || res.role !== 'superadmin') return null
  return { ...res, auth_user_id: user.id, auth_email: user.email ?? null }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const body = await request.json()
  const benevole_id: string | undefined = body.benevole_id
  const raison: string | undefined = body.raison
  const demande_par_reserviste: boolean = Boolean(body.demande_par_reserviste)
  const confirmation_nom: string | undefined = body.confirmation_nom

  // Rejeter toute tentative de suppression en lot
  if (body.benevole_ids) {
    return NextResponse.json(
      { error: 'La suppression en lot n\'est plus autorisee. Supprimer un compte a la fois.' },
      { status: 400 }
    )
  }

  if (!benevole_id) {
    return NextResponse.json({ error: 'benevole_id requis' }, { status: 400 })
  }

  if (!raison || raison.trim().length < 10) {
    return NextResponse.json(
      { error: 'Raison obligatoire (minimum 10 caracteres)' },
      { status: 400 }
    )
  }

  if (benevole_id === admin.benevole_id) {
    return NextResponse.json(
      { error: 'Impossible de supprimer votre propre compte' },
      { status: 400 }
    )
  }

  // Recuperer l'info du reserviste avant suppression (pour le journal)
  const { data: cible, error: fetchErr } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, role, groupe, statut')
    .eq('benevole_id', benevole_id)
    .single()

  if (fetchErr || !cible) {
    return NextResponse.json({ error: 'Reserviste introuvable' }, { status: 404 })
  }

  // Verifier la confirmation du nom (protection anti-clic accidentel)
  if (confirmation_nom !== undefined) {
    const nomAttendu = `${cible.prenom} ${cible.nom}`.trim().toLowerCase()
    const nomFourni = confirmation_nom.trim().toLowerCase()
    if (nomAttendu !== nomFourni) {
      return NextResponse.json(
        { error: 'La confirmation du nom ne correspond pas' },
        { status: 400 }
      )
    }
  }

  // Identifier l'auteur pour le trigger audit sur toutes les suppressions
  await setActingUser(supabaseAdmin, admin.auth_user_id, admin.auth_email)

  // 1. Inserer dans le journal AVANT de supprimer (pour tracabilite loi 25)
  const { error: logErr } = await supabaseAdmin
    .from('reservistes_suppressions')
    .insert({
      benevole_id: cible.benevole_id,
      prenom: cible.prenom,
      nom: cible.nom,
      role: cible.role,
      groupe_au_moment: cible.groupe,
      raison: raison.trim(),
      demande_par_reserviste,
      supprime_par_user_id: admin.auth_user_id,
      supprime_par_email: `${admin.prenom} ${admin.nom}`,
    })

  if (logErr) {
    return NextResponse.json(
      { error: `Impossible de journaliser la suppression: ${logErr.message}` },
      { status: 500 }
    )
  }

  // 2. SOFT-DELETE: marquer le reserviste comme supprime sans purger ses donnees enfants
  // (les enfants sont conserves pour permettre une restauration complete)
  const { error: delErr } = await supabaseAdmin
    .from('reservistes')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: raison.trim(),
      deleted_by_user_id: admin.auth_user_id,
    })
    .eq('benevole_id', benevole_id)

  if (delErr) {
    return NextResponse.json(
      { error: `Echec suppression reserviste: ${delErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    soft_delete: true,
    benevole_id,
    prenom: cible.prenom,
    nom: cible.nom,
    message: 'Reserviste mis a la corbeille. Restauration possible via /admin/corbeille.',
  })
}

