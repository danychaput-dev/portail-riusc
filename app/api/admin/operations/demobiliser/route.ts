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
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()
  if (!res || !['superadmin', 'admin', 'coordonnateur'].includes(res.role)) return null
  return { ...res, user_id: user.id, email: user.email }
}

export async function POST(req: NextRequest) {
  const admin = await verifierAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  await setActingUser(supabaseAdmin, admin.user_id, admin.email)

  const body = await req.json()
  const { vague_id, deployment_id, all_vagues, all_deployment, close_deployment, benevole_id } = body

  const nothingSpecified = !vague_id && !(deployment_id && (all_vagues || all_deployment || close_deployment)) && !(deployment_id && benevole_id)
  if (nothingSpecified) {
    return NextResponse.json({ error: 'Paramètres requis: vague_id, OU (deployment_id + all_vagues|all_deployment|close_deployment), OU (deployment_id + benevole_id)' }, { status: 400 })
  }

  let deploymentId: string | null = null
  let vagueIds: string[] = []
  let benevoleIds: string[] = []

  if (vague_id) {
    // Cas 1: démobiliser une vague spécifique
    const { data: v } = await supabaseAdmin.from('vagues').select('id, deployment_id').eq('id', vague_id).single()
    if (!v) return NextResponse.json({ error: 'Vague introuvable' }, { status: 404 })
    vagueIds = [v.id]
    deploymentId = v.deployment_id
    const { data: assignations } = await supabaseAdmin
      .from('assignations').select('benevole_id').in('vague_id', vagueIds)
    benevoleIds = [...new Set((assignations || []).map(a => a.benevole_id).filter(Boolean))] as string[]
  } else if (deployment_id && all_deployment) {
    // Cas 2: démobiliser TOUT le déploiement (ignore les vagues, prend tous les ciblages mobilise/confirme)
    deploymentId = deployment_id
    const { data: allCiblages } = await supabaseAdmin
      .from('ciblages').select('benevole_id')
      .eq('reference_id', deployment_id).eq('niveau', 'deploiement')
      .in('statut', ['mobilise', 'confirme'])
    benevoleIds = [...new Set((allCiblages || []).map(c => c.benevole_id).filter(Boolean))] as string[]
    const { data: vs } = await supabaseAdmin.from('vagues').select('id').eq('deployment_id', deployment_id)
    vagueIds = (vs || []).map(v => v.id)
  } else if (deployment_id && close_deployment) {
    // Cas 5: CLÔTURE COMPLÈTE du déploiement — inclut notifie en plus
    deploymentId = deployment_id
    const { data: allCiblages } = await supabaseAdmin
      .from('ciblages').select('benevole_id')
      .eq('reference_id', deployment_id).eq('niveau', 'deploiement')
      .in('statut', ['notifie', 'mobilise', 'confirme'])
    benevoleIds = [...new Set((allCiblages || []).map(c => c.benevole_id).filter(Boolean))] as string[]
    const { data: vs } = await supabaseAdmin.from('vagues').select('id').eq('deployment_id', deployment_id)
    vagueIds = (vs || []).map(v => v.id)
  } else if (deployment_id && all_vagues) {
    // Cas 3: démobiliser toutes les vagues (via assignations)
    deploymentId = deployment_id
    const { data: vs } = await supabaseAdmin.from('vagues').select('id').eq('deployment_id', deployment_id)
    vagueIds = (vs || []).map(v => v.id)
    if (vagueIds.length) {
      const { data: assignations } = await supabaseAdmin
        .from('assignations').select('benevole_id').in('vague_id', vagueIds)
      benevoleIds = [...new Set((assignations || []).map(a => a.benevole_id).filter(Boolean))] as string[]
    }
  } else if (deployment_id && benevole_id) {
    // Cas 4: démobiliser UNE seule personne d'un déploiement
    deploymentId = deployment_id
    benevoleIds = [benevole_id]
    // Pas de vagues à marquer Terminée pour un démo individuel
  }

  // En mode close_deployment, on accepte aussi notifie → termine (clôture complète)
  const statutsACibler = close_deployment
    ? ['notifie', 'mobilise', 'confirme']
    : ['mobilise', 'confirme']

  let ciblagesUpdated = 0
  if (benevoleIds.length && deploymentId) {
    const { data, error } = await supabaseAdmin
      .from('ciblages')
      .update({ statut: 'termine', updated_at: new Date().toISOString() })
      .eq('reference_id', deploymentId)
      .eq('niveau', 'deploiement')
      .in('benevole_id', benevoleIds)
      .in('statut', statutsACibler)
      .select('id')
    if (error) {
      console.error('Erreur demobiliser ciblages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    ciblagesUpdated = data?.length ?? 0
  }

  // En mode close_deployment, marquer le déploiement comme 'Complété'
  let deploymentClosed = false
  if (close_deployment && deploymentId) {
    const { error: errDep } = await supabaseAdmin
      .from('deployments')
      .update({ statut: 'Complété' })
      .eq('id', deploymentId)
    if (!errDep) deploymentClosed = true
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
    deployment_closed: deploymentClosed,
  })
}
