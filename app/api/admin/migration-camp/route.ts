// app/api/admin/migration-camp/route.ts
// Migration ponctuelle : récupère le statut camp de chaque réserviste via n8n (Monday.com)
// et insère les « Camp de qualification — Réussi » dans formations_benevoles (Supabase).
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const N8N_BASE = process.env.NEXT_PUBLIC_N8N_BASE_URL || 'https://n8n.aqbrs.ca'

async function verifierAdmin(): Promise<string | null> {
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
  if (!res || res.role !== 'admin') return null
  return res.benevole_id
}

// GET  → mode « dry run » : montre ce qui serait migré sans écrire
// POST → exécute la migration
export async function GET(req: NextRequest) {
  const adminId = await verifierAdmin()
  if (!adminId) return NextResponse.json({ error: 'Non autorisé (admin requis)' }, { status: 401 })

  const dryRun = req.nextUrl.searchParams.get('execute') !== 'true'
  const BATCH_SIZE = 30 // requêtes n8n en parallèle

  // 1. Tous les réservistes
  const { data: reservistes, error } = await supabaseAdmin
    .from('reservistes')
    .select('benevole_id, prenom, nom')
    .not('nom', 'is', null)
    .neq('nom', '')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reservistes?.length) return NextResponse.json({ error: 'Aucun réserviste' }, { status: 404 })

  // 2. Réservistes qui ont DÉJÀ un camp réussi dans Supabase (on ne duplique pas)
  const { data: existing } = await supabaseAdmin
    .from('formations_benevoles')
    .select('benevole_id')
    .ilike('nom_formation', '%camp%')
    .eq('resultat', 'Réussi')

  const dejaOk = new Set((existing || []).map(e => e.benevole_id))

  // 3. Appeler n8n par batch pour ceux qui n'ont pas encore de camp
  const aMigrer = reservistes.filter(r => !dejaOk.has(r.benevole_id))
  const certifies: { benevole_id: string; prenom: string; nom: string }[] = []
  const erreurs: { benevole_id: string; nom: string; erreur: string }[] = []

  for (let i = 0; i < aMigrer.length; i += BATCH_SIZE) {
    const batch = aMigrer.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (r) => {
        const res = await fetch(`${N8N_BASE}/webhook/camp-status?benevole_id=${r.benevole_id}`, {
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        return { ...r, is_certified: json?.is_certified || false }
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.is_certified) {
          certifies.push({
            benevole_id: result.value.benevole_id,
            prenom: result.value.prenom,
            nom: result.value.nom,
          })
        }
      } else {
        // On logue l'erreur mais on continue
        erreurs.push({
          benevole_id: batch[results.indexOf(result)]?.benevole_id || '?',
          nom: batch[results.indexOf(result)]?.nom || '?',
          erreur: String(result.reason),
        })
      }
    }
  }

  // 4. Insérer dans formations_benevoles (sauf dry run)
  let inseres = 0
  if (!dryRun && certifies.length > 0) {
    const rows = certifies.map(c => ({
      benevole_id: c.benevole_id,
      nom_complet: `${c.nom} ${c.prenom}`,
      nom_formation: 'Camp de qualification',
      resultat: 'Réussi',
      etat_validite: 'À jour',
      source: 'migration-monday',
      date_reussite: new Date().toISOString().slice(0, 10),
    }))

    // Insérer par batch de 100
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100)
      const { error: insertErr } = await supabaseAdmin
        .from('formations_benevoles')
        .insert(chunk)
      if (insertErr) {
        erreurs.push({ benevole_id: 'batch', nom: `lignes ${i}-${i + chunk.length}`, erreur: insertErr.message })
      } else {
        inseres += chunk.length
      }
    }
  }

  return NextResponse.json({
    mode: dryRun ? 'dry_run (ajouter ?execute=true pour migrer)' : 'migration_executee',
    total_reservistes: reservistes.length,
    deja_dans_supabase: dejaOk.size,
    verifies_via_n8n: aMigrer.length,
    certifies_monday: certifies.length,
    inseres_supabase: inseres,
    erreurs: erreurs.length,
    detail_certifies: certifies.map(c => `${c.prenom} ${c.nom}`),
    detail_erreurs: erreurs.slice(0, 20),
  })
}
