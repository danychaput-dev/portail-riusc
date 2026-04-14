// Dry-run de la migration des certificats Monday vers formations_benevoles.
// Ne fait AUCUNE écriture. Produit un rapport CSV détaillé.
// Usage: node scripts/migration_monday_pdfs/02_dryrun.mjs

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const ROOT = path.resolve('.')
const MONDAY_JSON = path.join(ROOT, 'scripts/migration_monday_pdfs/monday_raw.json')
const CSV_PATH = path.join(ROOT, 'scripts/monday_cible_2026-04-13_1251/Formations_des_benevoles/items.csv')
const CSV_REPERTOIRE = path.join(ROOT, 'scripts/monday_cible_2026-04-13_1251/Repertoire_RIUSC/items.csv')
const FILES_DIR = path.join(ROOT, 'scripts/monday_cible_2026-04-13_1251/Formations_des_benevoles/files')
const FILES_REPERTOIRE = path.join(ROOT, 'scripts/monday_cible_2026-04-13_1251/Repertoire_RIUSC/files')
const OUT_CSV = path.join(ROOT, 'scripts/migration_monday_pdfs/rapport_dryrun.csv')

// --- Parser CSV minimal (gère guillemets et virgules dans valeurs) ---
function parseCsv(text) {
  const rows = []
  let cur = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += c
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

// --- Détection formation (mêmes règles que le TSX) ---
function detectFormation(files) {
  const text = files.map(f => f.name + ' ' + f.url).join(' ').toLowerCase()
  if (/initier|msp|s-initier|sinitier|securite.civile|s%c3%a9curit|ssc/.test(text)) return "S'initier à la sécurité civile (MSP)"
  if (/incendie/.test(text)) return 'Prévention incendie'
  if (/radio.amateur/.test(text)) return 'Radio amateur'
  if (/premiers.soins|rcr|secourisme/.test(text)) return 'Premiers soins / RCR'
  if (/ics.?100|sci.?100/.test(text)) return 'Cours ICS/SCI 100'
  if (/ics.?200|sci.?200/.test(text)) return 'Cours ICS/SCI 200'
  if (/riusc/.test(text)) return 'Formation RIUSC'
  return "S'initier à la sécurité civile (MSP)"
}

// --- Load data ---
console.log('Chargement MONDAY_RAW...')
const mondayRaw = JSON.parse(fs.readFileSync(MONDAY_JSON, 'utf-8'))
console.log(`  ${mondayRaw.length} entrées`)

console.log('Chargement items.csv...')
const csvText = fs.readFileSync(CSV_PATH, 'utf-8')
const csvRows = parseCsv(csvText)
const header = csvRows[0]
const idx = (name) => header.indexOf(name)
const colId = idx('id')
const colName = idx('name')
const colCatalogue = idx('Catalogue Formations')
const colResultat = idx('Résultat')
const colDateReussite = idx('Date de réussite')
const colDateExp = idx('Date expiration')
const colCertif = idx('Certificat')
const colSCComplete = idx("S'initié à la S.C. Complété")
const csvByMondayId = new Map()
for (let r = 1; r < csvRows.length; r++) {
  const row = csvRows[r]
  if (!row[colId]) continue
  csvByMondayId.set(row[colId].trim(), {
    name: row[colName] || '',
    catalogue: row[colCatalogue] || '',
    resultat: row[colResultat] || '',
    date_reussite: row[colDateReussite] || '',
    date_expiration: row[colDateExp] || '',
    certificat: row[colCertif] || '',
    sc_complete: row[colSCComplete] || '',
  })
}
console.log(`  ${csvByMondayId.size} lignes indexées (Formations_des_benevoles)`)

console.log('Chargement Repertoire_RIUSC/items.csv...')
const repText = fs.readFileSync(CSV_REPERTOIRE, 'utf-8')
const repRows = parseCsv(repText)
const repHeader = repRows[0]
const repIdx = (name) => repHeader.indexOf(name)
const rColId = repIdx('id')
const rColCreated = repIdx('created_at')
const rColUpdated = repIdx('updated_at')
const rColCertif = repIdx('Certificat')
const rColSC = repIdx("S'Initier à la S.C.")
const rColEmail = repIdx('Courriel/E-mail')
const rColPrenom = repIdx('Prénom / First name')
const rColNom = repIdx('Nom de famille / Last-name')
const repByMondayId = new Map()
for (let r = 1; r < repRows.length; r++) {
  const row = repRows[r]
  if (!row[rColId]) continue
  repByMondayId.set(row[rColId].trim(), {
    created_at: row[rColCreated] || '',
    updated_at: row[rColUpdated] || '',
    certificat: row[rColCertif] || '',
    sc: row[rColSC] || '',
    email: row[rColEmail] || '',
    prenom: row[rColPrenom] || '',
    nom: row[rColNom] || '',
  })
}
console.log(`  ${repByMondayId.size} lignes indexées (Repertoire_RIUSC)`)

console.log('Liste des fichiers locaux...')
const localFiles = fs.existsSync(FILES_DIR) ? fs.readdirSync(FILES_DIR) : []
const repFiles = fs.existsSync(FILES_REPERTOIRE) ? fs.readdirSync(FILES_REPERTOIRE) : []
const localByMondayId = new Map()
for (const f of [...localFiles, ...repFiles]) {
  const m = f.match(/^(\d+)_/)
  if (m) {
    if (!localByMondayId.has(m[1])) localByMondayId.set(m[1], [])
    localByMondayId.get(m[1]).push(f)
  }
}
console.log(`  ${localFiles.length + repFiles.length} fichiers (F:${localFiles.length} + R:${repFiles.length}), ${localByMondayId.size} monday_ids couverts`)

console.log('Query reservistes...')
const emails = [...new Set(mondayRaw.map(m => m.email.toLowerCase().trim()))]
const reservistesByEmail = new Map()
// Batch de 500 pour ne pas dépasser la limite
for (let i = 0; i < emails.length; i += 500) {
  const batch = emails.slice(i, i + 500)
  const { data, error } = await sb
    .from('reservistes')
    .select('benevole_id, email, prenom, nom, deleted_at')
    .in('email', batch)
  if (error) { console.error('Erreur reservistes:', error.message); process.exit(1) }
  for (const r of data || []) reservistesByEmail.set(r.email.toLowerCase().trim(), r)
}
// Fallback ilike (casse)
for (const m of mondayRaw) {
  const e = m.email.toLowerCase().trim()
  if (!reservistesByEmail.has(e)) {
    const { data } = await sb.from('reservistes').select('benevole_id, email, prenom, nom, deleted_at').ilike('email', e).maybeSingle()
    if (data) reservistesByEmail.set(e, data)
  }
}
console.log(`  ${reservistesByEmail.size}/${emails.length} emails matchés`)

console.log('Query formations_benevoles (doublons)...')
const mondayIds = mondayRaw.map(m => m.monday_item_id)
const existing = new Set()
for (let i = 0; i < mondayIds.length; i += 500) {
  const batch = mondayIds.slice(i, i + 500)
  const { data, error } = await sb
    .from('formations_benevoles')
    .select('monday_item_id')
    .in('monday_item_id', batch)
  if (error) { console.error('Erreur formations:', error.message); process.exit(1) }
  for (const f of data || []) existing.add(f.monday_item_id)
}
console.log(`  ${existing.size} déjà migrées`)

// --- Génération rapport ---
function csvEscape(s) {
  if (s == null) return ''
  const v = String(s)
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

const out = []
out.push(['monday_item_id','nom','email','benevole_id','deleted','source_date','formation_csv','formation_detectee','date_reussite','date_expiration','nb_files','files_local','files_monday_url','already_in_db','status','notes'].join(','))

const stats = { ready: 0, orphan_email: 0, duplicate: 0, deleted: 0, no_file: 0, invalid_csv: 0 }

for (const m of mondayRaw) {
  const email = m.email.toLowerCase().trim()
  const reserv = reservistesByEmail.get(email)
  const csv = csvByMondayId.get(String(m.monday_item_id))
  const rep = repByMondayId.get(String(m.monday_item_id))
  const localList = localByMondayId.get(String(m.monday_item_id)) || []
  const alreadyDb = existing.has(m.monday_item_id)
  const formationDet = detectFormation(m.files || [])

  // date_reussite: priorité CSV Formations > Repertoire updated_at > Repertoire created_at
  let dateReussite = csv?.date_reussite || ''
  if (!dateReussite && rep?.updated_at) dateReussite = rep.updated_at.slice(0, 10)
  else if (!dateReussite && rep?.created_at) dateReussite = rep.created_at.slice(0, 10)
  const dateExpiration = csv?.date_expiration || ''
  const source = csv ? 'formations_csv' : (rep ? 'repertoire_csv' : 'aucune')

  let status = 'ready'
  const notes = []
  if (!reserv) { status = 'orphan_email'; notes.push('email introuvable dans reservistes') }
  else if (reserv.deleted_at) { status = 'deleted'; notes.push('reserviste soft-deleted') }
  else if (alreadyDb) { status = 'duplicate'; notes.push('monday_item_id déjà dans formations_benevoles') }
  else if (!localList.length && !(m.files || []).length) { status = 'no_file'; notes.push('aucun fichier disponible') }
  else if (!dateReussite) { status = 'no_date'; notes.push('date de réussite introuvable') }

  if (!csv && !rep) notes.push('absent des 2 CSV backup')
  else if (csv?.resultat && csv.resultat.toLowerCase() !== 'réussi') notes.push(`résultat CSV = ${csv.resultat}`)

  if (status === 'ready') stats.ready++
  else stats[status] = (stats[status] || 0) + 1

  out.push([
    m.monday_item_id,
    csvEscape(m.nom),
    csvEscape(m.email),
    reserv?.benevole_id || '',
    reserv?.deleted_at ? 'yes' : '',
    source,
    csvEscape(csv?.catalogue || ''),
    csvEscape(formationDet),
    dateReussite,
    dateExpiration,
    (m.files || []).length,
    localList.length,
    (m.files || []).length,
    alreadyDb ? 'yes' : '',
    status,
    csvEscape(notes.join(' | ')),
  ].join(','))
}

fs.writeFileSync(OUT_CSV, out.join('\n'))
console.log(`\nRapport : ${OUT_CSV}`)
console.log('Stats :')
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(15)} : ${v}`)
console.log(`  TOTAL           : ${mondayRaw.length}`)
