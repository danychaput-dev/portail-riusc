// app/api/admin/reservistes/groupe/route.ts
// Changement rapide du groupe d'un reserviste (Approuve, Retrait temporaire, etc.)
// Journalise automatiquement les transitions vers/depuis Retrait temporaire
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { setActingUser } from '@/utils/audit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifierCaller() {
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
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return { user, reserviste: res }
}

const GROUPES_VALIDES = ['Approuvé', 'Intérêt', 'Retrait temporaire', 'Retiré']

export async function PATCH(request: NextRequest) {
  const caller = await verifierCaller()
  if (!caller) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { benevole_id, groupe, raison } = await request.json()
  if (!benevole_id || !groupe) {
    return NextResponse.json({ error: 'benevole_id et groupe requis' }, { status: 400 })
  }

  if (!GROUPES_VALIDES.includes(groupe)) {
    return NextResponse.json({ error: `Groupe invalide. Valeurs acceptees: ${GROUPES_VALIDES.join(', ')}` }, { status: 400 })
  }

  // Récupérer l'état courant pour détecter la transition
  const { data: avant, error: errGet } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom, role, groupe')
    .eq('benevole_id', benevole_id)
    .single()
  if (errGet || !avant) {
    return NextResponse.json({ error: 'Réserviste introuvable' }, { status: 404 })
  }

  const entreEnRetrait = avant.groupe !== 'Retrait temporaire' && groupe === 'Retrait temporaire'
  const sortDeRetrait = avant.groupe === 'Retrait temporaire' && groupe !== 'Retrait temporaire'
  const besoinRaison = entreEnRetrait || sortDeRetrait

  if (besoinRaison && (!raison || String(raison).trim().length < 10)) {
    return NextResponse.json({
      error: 'Raison obligatoire (minimum 10 caractères) pour les transitions vers ou depuis Retrait temporaire',
      requires_raison: true,
    }, { status: 400 })
  }

  // Identifier l'auteur pour le trigger audit
  await setActingUser(supabaseAdmin, caller.user.id, caller.user.email)

  // 1. Update du groupe
  const { error } = await supabaseAdmin
    .from('reservistes')
    .update({ groupe })
    .eq('benevole_id', benevole_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. Journalisation si transition
  if (entreEnRetrait || sortDeRetrait) {
    const action = entreEnRetrait ? 'retrait' : 'reactivation'

    // Pour une réactivation, retrouver le retrait parent ouvert
    let retrait_parent_id: string | null = null
    if (sortDeRetrait) {
      const { data: parent } = await supabaseAdmin
        .from('retraits_temporaires')
        .select('id')
        .eq('entity_type', 'reserviste')
        .eq('entity_id', benevole_id)
        .eq('action', 'retrait')
        .order('effectue_le', { ascending: false })
        .limit(1)
        .maybeSingle()
      retrait_parent_id = parent?.id ?? null
    }

    const insertPayload = {
      entity_type: 'reserviste',
      entity_id: benevole_id,
      prenom: avant.prenom,
      nom: avant.nom,
      role: avant.role,
      groupe_au_moment: avant.groupe,
      action,
      raison: String(raison).trim(),
      effectue_par_user_id: caller.user.id,
      effectue_par_email: caller.user.email,
      retrait_parent_id,
    }

    const { error: errLog } = await supabaseAdmin
      .from('retraits_temporaires')
      .insert(insertPayload)
      .select()

    // Si la journalisation échoue, on ne rollback pas l'update (la DB reste cohérente)
    // mais on renvoie un avertissement
    if (errLog) {
      return NextResponse.json({
        success: true,
        benevole_id,
        groupe,
        warning: `Groupe mis à jour mais échec de journalisation: ${errLog.message}`,
      })
    }
  }

  return NextResponse.json({ success: true, benevole_id, groupe })
}
