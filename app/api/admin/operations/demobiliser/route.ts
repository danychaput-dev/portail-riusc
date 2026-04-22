// app/api/admin/operations/demobiliser/route.ts
//
// Démobilisation d'une vague: passe tous les ciblages des gens assignés
// à cette vague au statut 'termine'. Marque aussi la vague comme 'Terminée'.
//
// Usage: POST { vague_id } ou { deployment_id, all_vagues: true }

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return res
}

export async function POST(req: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { vague_id, deployment_id, all_vagues } = body

  if (!vague_id && !(deployment_id && all_vagues)) {
    return NextResponse.json({ error: 'vague_id ou (deployment_id + all_vagues) requis' }, { status: 400 })
  }

  // 1. Récupérer les vagues concernées
  let vagueIds: string[] = []
  let deploymentId: string | null = null
  if (vague_id) {
    const { data: v } = await supabaseAdmin
      .from('vagues')
      .select('id, deployment_id')
      .eq('id', vague_id)
      .single()
    if (!v) return NextResponse.json({ error: 'Vague introuvable' }, { status: 404 })
    vagueIds = [v.id]
    deploymentId = v.deployment_id
  } else if (deployment_id && all_vagues) {
    const { data: vs } = await supabaseAdmin
      .from('vagues')
      .select('id')
      .eq('deployment_id', deployment_id)
    vagueIds = (vs || []).map(v => v.id)
    deploymentId = deployment_id
  }

  if (!vagueIds.length) return NextResponse.json({ error: 'Aucune vague trouvée' }, { status: 404 })

  // 2. Trouver les réservistes assignés à ces vagues
  const { data: assignations } = await supabaseAdmin
    .from('assignations')
    .select('benevole_id, vague_id')
    .in('vague_id', vagueIds)

  const benevoleIds = [...new Set((assignations || []).map(a => a.benevole_id).filter(Boolean))]

  let ciblagesUpdated = 0
  if (benevoleIds.length && deploymentId) {
    // 3. UPDATE ciblages de ces benevoles pour ce déploiement
    const { data, error } = await supabaseAdmin
      .from('ciblages')
      .update({ statut: 'termine', updated_at: new Date().toISOString() })
      .eq('reference_id', deploymentId)
      .eq('niveau', 'deploiement')
      .in('benevole_id', benevoleIds)
      .in('statut', ['mobilise', 'confirme']) // ne touche pas les 'cible', 'notifie', 'retire'
      .select('id')
    if (error) {
      console.error('Erreur demobiliser ciblages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    ciblagesUpdated = data?.length ?? 0
  }

  // 4. Marquer les vagues comme 'Terminée'
  const { data: vaguesUpd, error: errVag } = await supabaseAdmin
    .from('vagues')
    .update({ statut: 'Terminée' })
    .in('id', vagueIds)
    .in('statut', ['Mobilisée', 'Planifiée', 'En cours'])
    .select('id')

  if (errVag) {
    console.error('Erreur demobiliser vagues:', errVag)
    // Non bloquant: les ciblages sont déjà mis à jour, on signale juste
  }

  return NextResponse.json({
    success: true,
    vagues_terminees: vaguesUpd?.length ?? 0,
    ciblages_termines: ciblagesUpdated,
    benevoles_affectes: benevoleIds.length,
  })
}
