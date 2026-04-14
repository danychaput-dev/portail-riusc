#!/usr/bin/env node
/**
 * Applique les matches par nom validés au rapport.csv.
 *
 * - Met à jour benevole_id, match_prenom, match_nom pour les senders listés
 * - Change NO_MATCH → MATCH_BY_NAME
 * - Laisse les PJ non-certificats (ex: Anessa Kimball) en NO_MATCH
 * - Sauvegarde dans rapport_final.csv (ne touche pas rapport.csv original)
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_IN = resolve(__dirname, 'rapport.csv')
const CSV_OUT = resolve(__dirname, 'rapport_final.csv')

// Matches validés manuellement par Dany (2026-04-14)
// Format: sender_email -> { benevole_id, prenom, nom }
const VALIDATED_MATCHES = {
  'liettebechard@gmail.com':        { benevole_id: '11365798389', prenom: 'Liette',           nom: 'Béchard' },
  'sophie.seguin@positifrp.com':    { benevole_id: '10715248339', prenom: 'Sophie',           nom: 'Seguin-Lamarche' },
  'guillaume.louis@umontreal.ca':   { benevole_id: '10900538763', prenom: 'Guillaume Raphaël', nom: 'Louis' },
  'joey.courcelles@mda.space':      { benevole_id: '8733555892',  prenom: 'Joey',             nom: 'Courcelles' },
  'jonathandupuis_61@hotmail.fr':   { benevole_id: '8733520698',  prenom: 'Jonathan',         nom: 'Dupuis' },
  'eunicemucyo@gmail.com':          { benevole_id: '18164961008', prenom: 'Eunice',           nom: 'Mucyo' },
  'marcelethier@me.com':            { benevole_id: '18269588314', prenom: 'Marcel',           nom: 'Ethier' },
  'felixmilot@icloud.com':          { benevole_id: '8734058699',  prenom: 'Félix',            nom: 'Milot' },
  // Ajouter Marie-Claude Gosselin ici après validation:
  // 'mcgosselin@videotron.ca':     { benevole_id: '...', prenom: 'Marie-Claude', nom: 'Gosselin' },
}

// PJ à exclure explicitement (match légit mais PJ n'est pas un certificat)
const EXCLUDED_FILENAMES_BY_SENDER = {
  'anessa.kimball@pol.ulaval.ca': ['*'], // tout exclure pour ce sender
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split(',')
  return { headers, rows: lines.slice(1).map(line => {
    const cells = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQ) {
        if (c === '"' && line[i+1] === '"') { cur += '"'; i++ }
        else if (c === '"') inQ = false
        else cur += c
      } else {
        if (c === '"') inQ = true
        else if (c === ',') { cells.push(cur); cur = '' }
        else cur += c
      }
    }
    cells.push(cur)
    const row = {}
    headers.forEach((h, i) => row[h] = cells[i] || '')
    return row
  })}
}

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function main() {
  const { headers, rows } = parseCSV(await readFile(CSV_IN, 'utf-8'))

  let updated = 0
  let excluded = 0
  const out = []

  for (const r of rows) {
    const excluded_patterns = EXCLUDED_FILENAMES_BY_SENDER[r.sender_email]
    if (excluded_patterns) {
      if (excluded_patterns.includes('*') || excluded_patterns.some(p => r.filename.includes(p))) {
        excluded++
        continue // on retire complètement ces lignes
      }
    }

    if (r.match_status === 'NO_MATCH' && VALIDATED_MATCHES[r.sender_email]) {
      const m = VALIDATED_MATCHES[r.sender_email]
      r.benevole_id = m.benevole_id
      r.match_prenom = m.prenom
      r.match_nom = m.nom
      r.match_status = 'MATCH_BY_NAME'
      updated++
    }
    out.push(r)
  }

  const lines = [headers.join(',')]
  for (const r of out) {
    lines.push(headers.map(h => csvEscape(r[h] || '')).join(','))
  }
  await writeFile(CSV_OUT, lines.join('\n'), 'utf-8')

  const totalMatch = out.filter(r => r.match_status === 'MATCH' || r.match_status === 'MATCH_BY_NAME').length
  const totalNoMatch = out.filter(r => r.match_status === 'NO_MATCH').length

  console.log(`=== RÉSUMÉ ===`)
  console.log(`Lignes d'origine: ${rows.length}`)
  console.log(`Lignes exclues (non-certificats): ${excluded}`)
  console.log(`Lignes finales: ${out.length}`)
  console.log(`  MATCH (email): ${out.filter(r => r.match_status === 'MATCH').length}`)
  console.log(`  MATCH_BY_NAME (mise à jour): ${updated}`)
  console.log(`  NO_MATCH restants: ${totalNoMatch}`)
  console.log(`  Total matched: ${totalMatch}`)
  console.log(`\nCSV: ${CSV_OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
