// Migration des certificats Monday Repertoire_RIUSC → formations_benevoles + Storage.
//
// Sans flag          : dry-run détaillé (aucune écriture)
// Avec --execute     : écriture réelle
// Avec --limit=N     : limite à N entrées pour test
//
// Exemples :
//   node scripts/migration_monday_pdfs/03_execute.mjs --limit=3            # test 3 entrées dry-run
//   node scripts/migration_monday_pdfs/03_execute.mjs --limit=3 --execute  # test 3 entrées réel
//   node scripts/migration_monday_pdfs/03_execute.mjs --execute            # full migration

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const LIMIT = (() => {
  const a = args.find(a => a.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : 0
})()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const ROOT = path.resolve('.')
const MONDAY_JSON = path.join(ROOT, 'scripts/migration_monday_pdfs/monday_raw.json')
const CSV_REPERTOIRE = path.join(ROOT, 'scripts/monday_cible_2026-04-13_1251/Repertoire_RIUSC/items.csv')
const FILES_REPERTOIRE = path.join(ROOT, 'scripts/monday_cible_2026-04-13_1251/Repertoire_RIUSC/files')
const FILES_FORMATIONS = path.join(ROOT, 'scripts/monday_cible_2026-04-13_1251/Formations_des_benevoles/files')
const OUT_LOG = path.join(ROOT, `scripts/migration_monday_pdfs/rapport_execute_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`)

console.log(`\n=== Migration Monday → formations_benevoles ===`)
console.log(`Mode : ${EXECUTE ? 'EXECUTE (écriture)' : 'DRY-RUN (aucune écriture)'}${LIMIT ? ` | limit=${LIMIT}` : ''}\n`)

// --- Parser CSV minimal ---
function parseCsv(text) {
  const rows = []
  let cur = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (c === '\r') {}
      else field += c
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  return rows
}

function detectFormationFromFile(filename, url) {
  const text = (filename + ' ' + (url || '')).toLowerCase()
  if (/initier|msp|s-initier|sinitier|securite.civile|s%c3%a9curit|ssc/.test(text)) return "S'initier à la sécurité civile (MSP)"
  if (/incendie/.test(text)) return 'Prévention incendie'
  if (/radio.amateur/.test(text)) return 'Radio amateur'
  if (/premiers.soins|rcr|secourisme/.test(text)) return 'Premiers soins / RCR'
  if (/ics.?100|sci.?100/.test(text)) return 'Cours ICS/SCI 100'
  if (/ics.?200|sci.?200/.test(text)) return 'Cours ICS/SCI 200'
  if (/riusc/.test(text)) return 'Formation RIUSC'
  return "S'initier à la sécurité civile (MSP)"
}

function isInitiation(formation) {
  const f = formation.toLowerCase()
  return f.includes('initier') || f.includes('sécurité civile') || f.includes('securite civile')
}

// Même logique que formationsMatch() dans app/admin/certificats/page.tsx
function formationsMatch(a, b) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (norm(a) === norm(b)) return true
  const initierKeys = ['sinitier', 'initierlasecuritecivile', 'securitecivile', 'msp']
  const aIsInitier = initierKeys.some(k => norm(a).includes(k))
  const bIsInitier = initierKeys.some(k => norm(b).includes(k))
  if (aIsInitier && bIsInitier) return true
  return false
}

function csvEscape(s) {
  if (s == null) return ''
  const v = String(s)
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

// --- Load data ---
const mondayRaw = JSON.parse(fs.readFileSync(MONDAY_JSON, 'utf-8'))
const repText = fs.readFileSync(CSV_REPERTOIRE, 'utf-8')
const repRows = parseCsv(repText)
const repHeader = repRows[0]
const rColId = repHeader.indexOf('id')
const rColCreated = repHeader.indexOf('created_at')
const rColUpdated = repHeader.indexOf('updated_at')
const repByMondayId = new Map()
for (let r = 1; r < repRows.length; r++) {
  const row = repRows[r]
  if (!row[rColId]) continue
  repByMondayId.set(row[rColId].trim(), {
    created_at: row[rColCreated] || '',
    updated_at: row[rColUpdated] || '',
  })
}

// Index fichiers locaux (Repertoire + Formations)
const localByMondayId = new Map()
for (const dir of [FILES_REPERTOIRE, FILES_FORMATIONS]) {
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(\d+)_(.+)$/)
    if (m) {
      const id = m[1]
      const original = m[2]
      if (!localByMondayId.has(id)) localByMondayId.set(id, [])
      localByMondayId.get(id).push({ filename: f, original, fullPath: path.join(dir, f) })
    }
  }
}

// Reservistes par email
const emails = [...new Set(mondayRaw.map(m => m.email.toLowerCase().trim()))]
const reservistesByEmail = new Map()
for (let i = 0; i < emails.length; i += 500) {
  const { data } = await sb.from('reservistes').select('benevole_id, email, prenom, nom, deleted_at').in('email', emails.slice(i, i + 500))
  for (const r of data || []) reservistesByEmail.set(r.email.toLowerCase().trim(), r)
}
for (const m of mondayRaw) {
  const e = m.email.toLowerCase().trim()
  if (!reservistesByEmail.has(e)) {
    const { data } = await sb.from('reservistes').select('benevole_id, email, prenom, nom, deleted_at').ilike('email', e).maybeSingle()
    if (data) reservistesByEmail.set(e, data)
  }
}

// Doublons par monday_item_id
const existingIds = new Set()
for (let i = 0; i < mondayRaw.length; i += 500) {
  const { data } = await sb.from('formations_benevoles').select('monday_item_id').in('monday_item_id', mondayRaw.slice(i, i + 500).map(m => m.monday_item_id))
  for (const f of data || []) existingIds.add(f.monday_item_id)
}

// Formations existantes par benevole_id (pour dedup par nom de formation)
const existingByBenevole = new Map() // benevole_id → [{ nom_formation, resultat }]
const benevoleIds = [...new Set([...reservistesByEmail.values()].map(r => r.benevole_id))]
for (let i = 0; i < benevoleIds.length; i += 500) {
  const { data } = await sb.from('formations_benevoles').select('benevole_id, nom_formation, resultat').in('benevole_id', benevoleIds.slice(i, i + 500))
  for (const f of data || []) {
    if (!existingByBenevole.has(f.benevole_id)) existingByBenevole.set(f.benevole_id, [])
    existingByBenevole.get(f.benevole_id).push(f)
  }
}

console.log(`Entrées: ${mondayRaw.length} | Réservistes matchés: ${reservistesByEmail.size} | Déjà migrés (ID): ${existingIds.size} | Formations existantes chargées: ${existingByBenevole.size} benevoles`)

// --- Traitement ---
const logRows = [['monday_item_id','benevole_id','nom_complet','formation','date_reussite','file_source','storage_path','status','detail'].join(',')]
const stats = { inserted: 0, skipped_duplicate: 0, skipped_duplicate_formation: 0, skipped_orphan: 0, skipped_deleted: 0, skipped_no_file: 0, error: 0, dry_run_ok: 0 }

let processed = 0
for (const m of mondayRaw) {
  if (LIMIT && processed >= LIMIT) break
  processed++

  const email = m.email.toLowerCase().trim()
  const reserv = reservistesByEmail.get(email)
  const rep = repByMondayId.get(String(m.monday_item_id))
  const locals = localByMondayId.get(String(m.monday_item_id)) || []
  const alreadyDb = existingIds.has(m.monday_item_id)

  if (!reserv) { stats.skipped_orphan++; logRows.push([m.monday_item_id,'',csvEscape(m.nom),'','','','', 'skipped_orphan','email absent'].join(',')); continue }
  if (reserv.deleted_at) { stats.skipped_deleted++; logRows.push([m.monday_item_id,reserv.benevole_id,csvEscape(m.nom),'','','','', 'skipped_deleted','reserviste soft-deleted'].join(',')); continue }
  if (alreadyDb) { stats.skipped_duplicate++; logRows.push([m.monday_item_id,reserv.benevole_id,csvEscape(m.nom),'','','','', 'skipped_duplicate','monday_item_id déjà migré'].join(',')); continue }
  if (!locals.length) { stats.skipped_no_file++; logRows.push([m.monday_item_id,reserv.benevole_id,csvEscape(m.nom),'','','','', 'skipped_no_file','aucun fichier local'].join(',')); continue }

  const dateReussite = rep?.updated_at?.slice(0, 10) || rep?.created_at?.slice(0, 10) || ''
  if (!dateReussite) { stats.error++; logRows.push([m.monday_item_id,reserv.benevole_id,csvEscape(m.nom),'','','','', 'error','date introuvable'].join(',')); continue }

  const nomComplet = `${reserv.prenom || ''} ${reserv.nom || ''}`.trim() || m.nom

  // Traiter un fichier par ligne (max 1 avec monday_item_id, les autres avec NULL)
  const existingFormations = existingByBenevole.get(reserv.benevole_id) || []
  for (let fIdx = 0; fIdx < locals.length; fIdx++) {
    const f = locals[fIdx]
    const ext = f.original.split('.').pop()?.toLowerCase() || 'pdf'
    const formation = detectFormationFromFile(f.original, m.files?.[fIdx]?.url || '')
    const slug = formation.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const storagePath = `${reserv.benevole_id}/${slug}_${m.monday_item_id}${fIdx > 0 ? `_${fIdx}` : ''}.${ext}`

    // Dedup par nom de formation équivalent + résultat Réussi
    const duplicateFormation = existingFormations.find(ef =>
      (ef.resultat || '').toLowerCase() === 'réussi' && formationsMatch(ef.nom_formation, formation)
    )
    if (duplicateFormation) {
      stats.skipped_duplicate_formation++
      logRows.push([m.monday_item_id, reserv.benevole_id, csvEscape(nomComplet), csvEscape(formation), dateReussite, csvEscape(f.original), '', 'skipped_duplicate_formation', csvEscape(`existe déjà comme "${duplicateFormation.nom_formation}"`)].join(','))
      continue
    }

    if (!EXECUTE) {
      stats.dry_run_ok++
      logRows.push([m.monday_item_id, reserv.benevole_id, csvEscape(nomComplet), csvEscape(formation), dateReussite, csvEscape(f.original), csvEscape(storagePath), 'dry_run_ok', ''].join(','))
      continue
    }

    // 1) Upload Storage
    const fileBuf = fs.readFileSync(f.fullPath)
    const contentType = ext === 'pdf' ? 'application/pdf' : (ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream'))
    const { error: upErr } = await sb.storage.from('certificats').upload(storagePath, fileBuf, { upsert: true, contentType })
    if (upErr) { stats.error++; logRows.push([m.monday_item_id, reserv.benevole_id, csvEscape(nomComplet), csvEscape(formation), dateReussite, csvEscape(f.original), csvEscape(storagePath), 'error', csvEscape(`upload: ${upErr.message}`)].join(',')); continue }

    // 2) INSERT formations_benevoles
    const insertRow = {
      benevole_id: reserv.benevole_id,
      nom_complet: nomComplet,
      nom_formation: formation,
      date_reussite: dateReussite,
      date_expiration: null,
      certificat_url: `storage:${storagePath}`,
      initiation_sc_completee: isInitiation(formation),
      resultat: 'Réussi',
      etat_validite: 'À jour',
      source: 'migration_monday_2026-04',
      monday_item_id: fIdx === 0 ? m.monday_item_id : null,
    }
    const { error: insErr } = await sb.from('formations_benevoles').insert(insertRow)
    if (insErr) {
      stats.error++
      logRows.push([m.monday_item_id, reserv.benevole_id, csvEscape(nomComplet), csvEscape(formation), dateReussite, csvEscape(f.original), csvEscape(storagePath), 'error', csvEscape(`insert: ${insErr.message}`)].join(','))
      // Nettoyage : supprimer le fichier uploadé pour garder l'état cohérent
      await sb.storage.from('certificats').remove([storagePath]).catch(() => {})
      continue
    }

    stats.inserted++
    logRows.push([m.monday_item_id, reserv.benevole_id, csvEscape(nomComplet), csvEscape(formation), dateReussite, csvEscape(f.original), csvEscape(storagePath), 'inserted', ''].join(','))
    process.stdout.write('.')
  }
}
if (EXECUTE) console.log('')

fs.writeFileSync(OUT_LOG, logRows.join('\n'))
console.log(`\nRapport : ${OUT_LOG}`)
console.log('Stats :')
for (const [k, v] of Object.entries(stats)) if (v) console.log(`  ${k.padEnd(20)} : ${v}`)
if (!EXECUTE) console.log('\n⚠ Aucune écriture faite. Ajoute --execute pour rouler pour de vrai.')
