#!/usr/bin/env node
/**
 * Upload du rapport_final.csv vers la file d'attente Supabase:
 *  1. Upload chaque fichier dans le bucket privé "certificats-a-trier"
 *  2. INSERT une ligne dans la table certificats_a_trier
 *
 * Usage:
 *   node upload_to_queue.mjs           # dry run
 *   node upload_to_queue.mjs --execute # upload + insert pour vrai
 *   node upload_to_queue.mjs --execute --limit=3 # tester sur 3 lignes
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
dotenv.config({ path: resolve(ROOT, '.env.local') })

const CSV_IN = resolve(__dirname, 'rapport_final.csv')
const FILES_DIR = resolve(__dirname, 'files')
const BUCKET = 'certificats-a-trier'
const SOURCE = 'gmail_extract_2026-04'

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase env manquants')
const sb = createClient(url, key)

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
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
  })
}

function safeFilename(name) {
  return (name || 'fichier').replace(/[^\w.\-]/g, '_').slice(0, 120)
}

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`)
  if (LIMIT) console.log(`Limite: ${LIMIT} lignes\n`)

  // Vérifier qu'on ne re-upload pas du déjà uploadé
  const { count } = await sb
    .from('certificats_a_trier')
    .select('*', { count: 'exact', head: true })
    .eq('source', SOURCE)
  if (count && count > 0 && EXECUTE) {
    console.error(`ERREUR: ${count} lignes existent déjà pour source=${SOURCE}.`)
    console.error(`Pour réinitialiser, lance d'abord: delete from certificats_a_trier where source='${SOURCE}';`)
    process.exit(1)
  }

  const csvText = await readFile(CSV_IN, 'utf-8')
  let rows = parseCSV(csvText)
  if (LIMIT) rows = rows.slice(0, LIMIT)

  let ok = 0, errors = 0, skipped = 0
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const localPath = r.local_path
    if (!localPath) {
      console.warn(`  [${i+1}/${rows.length}] SKIP (pas de local_path): ${r.filename}`)
      skipped++
      continue
    }

    const id = randomUUID()
    const folder = r.benevole_id || 'non_associe'
    const storagePath = `${folder}/${id}_${safeFilename(r.filename)}`

    try {
      if (EXECUTE) {
        const fileBuf = await readFile(localPath)
        const { error: upErr } = await sb.storage
          .from(BUCKET)
          .upload(storagePath, fileBuf, {
            contentType: r.mime_type || 'application/octet-stream',
            upsert: false,
          })
        if (upErr) throw new Error(`Upload: ${upErr.message}`)

        const { error: dbErr } = await sb.from('certificats_a_trier').insert({
          id,
          benevole_id: r.benevole_id || null,
          sender_email: r.sender_email,
          sender_name: r.sender_name,
          subject: r.subject,
          date_courriel: r.date,
          filename_original: r.filename,
          storage_path: storagePath,
          thread_id: r.thread_id,
          message_id: r.message_id,
          match_status: r.match_status,
          source: SOURCE,
        }).select()
        if (dbErr) throw new Error(`DB: ${dbErr.message}`)
      }

      ok++
      if ((i+1) % 10 === 0 || i+1 === rows.length) {
        console.log(`  [${i+1}/${rows.length}] ok (${r.match_prenom || r.sender_name})`)
      }
    } catch (e) {
      errors++
      console.warn(`  [${i+1}/${rows.length}] ERREUR: ${e.message} -- ${r.filename}`)
    }
  }

  console.log(`\n=== RÉSUMÉ ===`)
  console.log(`OK: ${ok}`)
  console.log(`Skipped (pas de local_path): ${skipped}`)
  console.log(`Erreurs: ${errors}`)
  if (!EXECUTE) console.log(`(DRY RUN -- relance avec --execute pour uploader)`)
}

main().catch(e => { console.error(e); process.exit(1) })
