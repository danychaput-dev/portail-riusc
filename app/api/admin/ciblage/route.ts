// app/api/admin/ciblage/route.ts
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
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: reserviste } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, role')
    .eq('user_id', user.id)
    .single()

  if (!reserviste || !['admin', 'coordonnateur'].includes(reserviste.role)) return null
  return reserviste
}

// ============================================================
// GET — lecture données
// ============================================================
export async function GET(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // --- Sinistres actifs ou en veille ---
  if (action === 'sinistres') {
    const { data, error } = await supabaseAdmin
      .from('sinistres')
      .select('id, nom, statut, type_incident, lieu, date_debut')
      .in('statut', ['Actif', 'En veille'])
      .order('date_debut', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  // --- Déploiements d'un sinistre ---
  if (action === 'deployments') {
    const sinistre_id = searchParams.get('sinistre_id')
    if (!sinistre_id) return NextResponse.json({ error: 'sinistre_id manquant' }, { status: 400 })

    // sinistres → demandes → deployments_demandes → deployments
    const { data: demandes } = await supabaseAdmin
      .from('demandes')
      .select('id')
      .eq('sinistre_id', sinistre_id)

    if (!demandes || demandes.length === 0) return NextResponse.json([])

    const demandeIds = demandes.map((d: any) => d.id)

    const { data: links } = await supabaseAdmin
      .from('deployments_demandes')
      .select('deployment_id')
      .in('demande_id', demandeIds)

    if (!links || links.length === 0) return NextResponse.json([])

    const deploymentIds = [...new Set(links.map((l: any) => l.deployment_id))]

    const { data, error } = await supabaseAdmin
      .from('deployments')
      .select('id, identifiant, nom, statut, nb_personnes_par_vague, date_debut, date_fin, lieu')
      .in('id', deploymentIds)
      .not('statut', 'in', '("Complété","Annulé")')
      .order('identifiant')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  // --- Rotations d'un déploiement ---
  if (action === 'vagues') {
    const deployment_id = searchParams.get('deployment_id')
    if (!deployment_id) return NextResponse.json({ error: 'deployment_id manquant' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('vagues')
      .select('id, identifiant, numero, date_debut, date_fin, nb_personnes_requis, statut')
      .eq('deployment_id', deployment_id)
      .not('statut', 'in', '("Complété","Annulé")')
      .order('numero')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  // --- Pool de candidats via RPC ---
  if (action === 'pool') {
    const niveau       = searchParams.get('niveau')
    const reference_id = searchParams.get('reference_id')
    const date_debut   = searchParams.get('date_debut')
    const date_fin     = searchParams.get('date_fin')

    if (!niveau || !reference_id || !date_debut || !date_fin) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('get_pool_ciblage', {
      p_niveau:       niveau,
      p_reference_id: reference_id,
      p_date_debut:   date_debut,
      p_date_fin:     date_fin,
      p_regions:      null,
      p_preference:   null
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  // --- Ciblés actuels pour une référence ---
  if (action === 'ciblages') {
    const reference_id = searchParams.get('reference_id')
    if (!reference_id) return NextResponse.json({ error: 'reference_id manquant' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('ciblages')
      .select('id, benevole_id, niveau, reference_id, statut, ajoute_par_ia, created_at')
      .eq('reference_id', reference_id)
      .neq('statut', 'retire')
      .order('created_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) return NextResponse.json([])

    // Enrichir avec les infos réserviste
    const benevoleIds = data.map((c: any) => c.benevole_id)
    const { data: reservistes, error: errRes } = await supabaseAdmin
      .from('reservistes')
      .select('benevole_id, prenom, nom, telephone, region, ville, preference_tache')
      .in('benevole_id', benevoleIds)

    if (errRes) return NextResponse.json({ error: errRes.message }, { status: 500 })

    const resMap = Object.fromEntries((reservistes || []).map((r: any) => [r.benevole_id, r]))
    const enriched = data.map((c: any) => ({
      ...c,
      reservistes: resMap[c.benevole_id] || { prenom: '?', nom: '?', telephone: '', region: '', ville: '', preference_tache: '' }
    }))

    return NextResponse.json(enriched)
  }

  // --- Langues disponibles ---
  if (action === 'langues') {
    const { data, error } = await supabaseAdmin
      .from('langues')
      .select('id, nom')
      .order('nom')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  }

  return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
}

// ============================================================
// POST — actions
// ============================================================
export async function POST(req: NextRequest) {
  const user = await verifierRole()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { action } = body

  // --- Ajouter un réserviste au ciblage ---
  if (action === 'ajouter') {
    const { niveau, reference_id, benevole_id, ajoute_par_ia } = body

    const { data, error } = await supabaseAdmin
      .from('ciblages')
      .insert({
        niveau,
        reference_id,
        benevole_id,
        ajoute_par: user.benevole_id,
        ajoute_par_ia: ajoute_par_ia || false,
        statut: 'cible'
      })
      .select('id, benevole_id, niveau, reference_id, statut, ajoute_par_ia')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // --- Retirer un réserviste du ciblage ---
  if (action === 'retirer') {
    const { ciblage_id } = body

    const { error } = await supabaseAdmin
      .from('ciblages')
      .update({ statut: 'retire', updated_at: new Date().toISOString() })
      .eq('id', ciblage_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // --- Suggestions IA ---
  if (action === 'ai-suggestions') {
    const { pool, cibles_actuels, nb_cible, context } = body

    const manquants = Math.max(0, nb_cible - cibles_actuels.length)
    if (manquants === 0) return NextResponse.json({ suggestions: [] })

    // Prioriser déployables, limiter à 80 pour le contexte
    const candidats = pool
      .filter((c: any) => !cibles_actuels.includes(c.benevole_id))
      .slice(0, 80)
      .map((c: any) => ({
        benevole_id: c.benevole_id,
        prenom: c.prenom,
        nom: c.nom,
        region: c.region,
        ville: c.ville,
        preference_tache: c.preference_tache,
        deployable: c.deployable,
        en_deploiement_actif: c.en_deploiement_actif,
        rotations_consecutives: c.rotations_consecutives
      }))

    const prompt = `Tu es un assistant pour l'AQBRS, organisation québécoise de réservistes bénévoles en sécurité civile.

Contexte : ${context}

Il y a actuellement ${cibles_actuels.length} réservistes ciblés.
Objectif : atteindre ${nb_cible} réservistes (ratio 3-4x pour compenser les désistements bénévoles).
Tu dois suggérer exactement ${manquants} réservistes supplémentaires.

Critères de priorité :
1. deployable = true (pas en déploiement actif, pas en repos obligatoire)
2. Diversité géographique des régions
3. Variété des préférences (terrain + sinistres)

Candidats disponibles :
${JSON.stringify(candidats, null, 2)}

Réponds UNIQUEMENT en JSON valide, sans markdown ni explication, format exact :
{"suggestions":[{"benevole_id":"...","raison":"justification courte max 80 chars"}]}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Erreur API IA', suggestions: [] }, { status: 500 })
    }

    const aiData = await response.json()
    const text = aiData.content?.[0]?.text || '{}'
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ suggestions: [], error: 'Erreur parsing IA' })
    }
  }

  // --- Envoyer notifications (déclenche n8n) ---
  if (action === 'notifier') {
    const { reference_id, niveau, ciblages } = body

    // Déclencher le webhook n8n
    try {
      await fetch(`${process.env.N8N_WEBHOOK_BASE_URL}/ciblage-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_id, niveau, ciblages })
      })
    } catch (e) {
      console.error('Erreur webhook n8n:', e)
      // Ne pas bloquer — marquer quand même comme notifié
    }

    // Marquer les ciblés comme notifiés
    const { error } = await supabaseAdmin
      .from('ciblages')
      .update({ statut: 'notifie', updated_at: new Date().toISOString() })
      .eq('reference_id', reference_id)
      .eq('statut', 'cible')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, count: ciblages?.length || 0 })
  }

  return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
}
