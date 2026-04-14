#!/usr/bin/env node
/**
 * Snapshot quotidien de l'etat des reservistes.
 *
 * Exporte un CSV horodate dans /snapshots/ avec:
 *  - Les 5 criteres de readiness (profil, initiation SC, camp, bottes, antecedents)
 *  - Nombre de formations totales et par categorie
 *  - Nombre de fichiers certificats presents
 *
 * Usage: node scripts/snapshot_reservistes.js
 * Requiert: .env.local avec NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('ERREUR: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

// Retry helper avec backoff exponentiel pour erreurs reseau transitoires
// (fetch failed, ECONNRESET, ETIMEDOUT, etc.) lors d'appels Supabase
async function withRetry(label, fn, maxAttempts = 4, baseDelayMs = 1000) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fn()
      // Supabase renvoie { data, error } au lieu de throw
      if (res && res.error) {
        const msg = res.error.message || String(res.error)
        // Erreurs reseau a re-essayer
        if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|socket hang up|503|504/i.test(msg) && attempt < maxAttempts) {
          throw new Error(`Retry-able: ${msg}`)
        }
        return res
      }
      return res
    } catch (e) {
      lastErr = e
      const msg = e && e.message ? e.message : String(e)
      if (attempt >= maxAttempts) break
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      console.warn(`[${label}] Tentative ${attempt}/${maxAttempts} echouee (${msg}). Retry dans ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function csvField(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  const outDir = path.join(__dirname, '..', 'snapshots')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `${today}_snapshot.csv`)

  console.log(`Extraction du snapshot pour ${today}...`)

  // 1. Fetch all reservistes (avec retry sur erreurs reseau)
  const { data: reservistes, error } = await withRetry('reservistes', () => supabase
    .from('reservistes')
    .select('benevole_id, prenom, nom, email, telephone, groupe, statut, camp_qualif_complete, antecedents_statut, antecedents_date_verification, antecedents_date_expiration, remboursement_bottes_date, date_naissance, adresse, ville, region, contact_urgence_nom, contact_urgence_telephone')
    .order('benevole_id')
    .range(0, 9999)
  )

  if (error) {
    console.error('Erreur fetch reservistes:', error.message)
    process.exit(1)
  }

  console.log(`${reservistes.length} reservistes recuperes`)

  // 2. Fetch formations enrichment (par batch de 500)
  const ids = reservistes.map(r => r.benevole_id)
  const formMap = {}
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500)
    const { data: formations } = await withRetry(`formations[${i}]`, () => supabase
      .from('formations_benevoles')
      .select('benevole_id, resultat, nom_formation, certificat_url, certificat_requis, initiation_sc_completee, source')
      .in('benevole_id', batch)
    )
    for (const f of (formations || [])) {
      if (!formMap[f.benevole_id]) {
        formMap[f.benevole_id] = {
          total: 0, init_reussi: 0, camp_reussi: 0,
          cert_avec_fichier: 0, cert_requis_sans_fichier: 0,
          en_attente: 0
        }
      }
      const m = formMap[f.benevole_id]
      m.total++
      const nm = (f.nom_formation || '').toLowerCase()
      if (f.resultat === 'Réussi') {
        if (f.initiation_sc_completee === true || nm.includes('initier')) m.init_reussi++
        if (nm.includes('camp de qualification')) m.camp_reussi++
        if (f.certificat_requis && !f.certificat_url) m.cert_requis_sans_fichier++
      } else if (f.resultat === 'En attente' || f.resultat === 'Soumis') {
        m.en_attente++
      }
      if (f.certificat_url) m.cert_avec_fichier++
    }
  }

  // 3. Write CSV
  const headers = [
    'benevole_id', 'prenom', 'nom', 'email', 'telephone',
    'groupe', 'statut',
    'camp_qualif_complete', 'antecedents_statut',
    'antecedents_date_verification', 'antecedents_date_expiration',
    'remboursement_bottes_date',
    'has_dob', 'has_adresse', 'has_ville', 'has_region',
    'has_urgence_nom', 'has_urgence_tel',
    'nb_formations_total', 'nb_initiations_reussies', 'nb_camps_reussis',
    'nb_certificats_avec_fichier', 'nb_certificats_requis_sans_fichier',
    'nb_formations_en_attente',
    // Readiness booleens (pour comparaison directe)
    'readiness_profil', 'readiness_initiation', 'readiness_camp',
    'readiness_bottes', 'readiness_antecedents'
  ]
  const lines = [headers.join(',')]

  for (const r of reservistes) {
    const f = formMap[r.benevole_id] || {
      total: 0, init_reussi: 0, camp_reussi: 0,
      cert_avec_fichier: 0, cert_requis_sans_fichier: 0, en_attente: 0
    }

    const hasField = v => (v !== null && v !== undefined && String(v).trim() !== '')
    const profil = hasField(r.prenom) && hasField(r.nom) && hasField(r.email) &&
                   hasField(r.telephone) && hasField(r.date_naissance) &&
                   hasField(r.adresse) && hasField(r.ville) && hasField(r.region) &&
                   hasField(r.contact_urgence_nom) && hasField(r.contact_urgence_telephone)
    const antExp = r.antecedents_date_expiration && new Date(r.antecedents_date_expiration) < new Date()
    const antOk = r.antecedents_statut === 'verifie' && !antExp

    const row = [
      csvField(r.benevole_id), csvField(r.prenom), csvField(r.nom),
      csvField(r.email), csvField(r.telephone),
      csvField(r.groupe), csvField(r.statut),
      r.camp_qualif_complete, csvField(r.antecedents_statut),
      csvField(r.antecedents_date_verification), csvField(r.antecedents_date_expiration),
      csvField(r.remboursement_bottes_date),
      hasField(r.date_naissance), hasField(r.adresse),
      hasField(r.ville), hasField(r.region),
      hasField(r.contact_urgence_nom), hasField(r.contact_urgence_telephone),
      f.total, f.init_reussi, f.camp_reussi,
      f.cert_avec_fichier, f.cert_requis_sans_fichier, f.en_attente,
      profil, f.init_reussi > 0, (r.camp_qualif_complete === true || f.camp_reussi > 0),
      hasField(r.remboursement_bottes_date), antOk
    ]
    lines.push(row.join(','))
  }

  fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf-8')
  console.log(`Snapshot ecrit: ${outFile}`)
  console.log(`${reservistes.length} reservistes, ${Object.keys(formMap).length} avec formations`)
}

main().catch(e => {
  console.error('ERREUR:', e)
  process.exit(1)
})
