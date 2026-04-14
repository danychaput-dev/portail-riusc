#!/usr/bin/env node
/**
 * Extraction des courriels avec certificats depuis Gmail Esther.
 *
 * Phase 1: recherche Gmail + match Supabase + CSV
 * Phase 2: téléchargement des pièces jointes (avec --execute)
 *
 * Usage:
 *   node extract.mjs                  # dry run (pas de download)
 *   node extract.mjs --execute        # download + CSV
 *   node extract.mjs --limit=10       # limite N threads
 *   node extract.mjs --query="..."    # surcharge requête
 */

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { URL } from 'node:url'
import { exec } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
dotenv.config({ path: resolve(ROOT, '.env.local') })

// ============================================================
// Config
// ============================================================
const CREDENTIALS_PATH = resolve(__dirname, 'credentials.json')
const TOKEN_PATH = resolve(__dirname, 'token.json')
const FILES_DIR = resolve(__dirname, 'files')
const CSV_PATH = resolve(__dirname, 'rapport.csv')
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

const DEFAULT_QUERY = [
  'has:attachment',
  '(certificat OR certification OR attestation OR "s\'initier" OR "sécurité civile" OR "securite civile" OR formation OR MSP OR RCR OR initiation OR RIUSC OR RISC)',
  '-from:aqbrs.ca',
  '-from:sopfeu.qc.ca',
  '-from:croixrouge.ca',
  '-from:gouv.qc.ca',
  '-from:no-reply',
  '-from:noreply',
  '-from:notification',
  '-from:centredusablon.com',
  '-from:hyvi.com',
  '-from:chaputdany@gmail.com',
  '-from:vdsc.ca',
  '-from:annie.lacroix@rsestrie.org',
  '-subject:virement',
  '-subject:polo',
  '-subject:facture',
].join(' ')

// Extensions considérées comme certificats potentiels
const CERT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.heic', '.webp', '.tif', '.tiff']
// Extensions ignorées (signatures email, icônes)
const IGNORE_FILENAME_PATTERNS = [
  /^image\d*\.(png|jpg|jpeg|gif|webp)$/i,
  /^outlook-/i,
  /^signature/i,
  /logo/i,
  /^banniere/i,
  /^bandeau/i,
]

// ============================================================
// CLI args
// ============================================================
const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10)
const CUSTOM_QUERY = args.find(a => a.startsWith('--query='))?.split('=')[1]
const QUERY = CUSTOM_QUERY || DEFAULT_QUERY

console.log(`Mode: ${EXECUTE ? 'EXECUTE (téléchargement)' : 'DRY RUN (pas de téléchargement)'}`)
if (LIMIT) console.log(`Limite: ${LIMIT} threads`)
console.log(`Query: ${QUERY}\n`)

// ============================================================
// OAuth
// ============================================================
async function authorize() {
  const creds = JSON.parse(await readFile(CREDENTIALS_PATH, 'utf-8'))
  const { client_id, client_secret } = creds.installed || creds.web

  // Si on a déjà un token, on le réutilise (redirect_uri n'importe plus)
  if (existsSync(TOKEN_PATH)) {
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'http://localhost')
    const token = JSON.parse(await readFile(TOKEN_PATH, 'utf-8'))
    oauth2.setCredentials(token)
    return oauth2
  }

  // Flow OAuth via serveur loopback sur port fixe pour que redirect_uri soit stable
  return new Promise((resolveAuth, rejectAuth) => {
    const server = createServer()
    server.listen(0, () => {
      const port = server.address().port
      const redirectUri = `http://localhost:${port}`
      // IMPORTANT: ce client utilise le MEME redirect_uri pour auth ET token exchange
      const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirectUri)

      server.on('request', async (req, res) => {
        try {
          const params = new URL(req.url, redirectUri).searchParams
          const code = params.get('code')
          if (!code) {
            res.end('No code received.')
            return
          }
          const { tokens } = await oauth2.getToken(code)
          oauth2.setCredentials(tokens)
          await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2))
          res.end('Auth OK. Vous pouvez fermer cet onglet.')
          server.close()
          console.log('Token sauvegardé.\n')
          resolveAuth(oauth2)
        } catch (e) {
          res.end('Erreur: ' + e.message)
          rejectAuth(e)
        }
      })

      const fullUrl = oauth2.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      })
      console.log(`Serveur local OAuth: ${redirectUri}`)
      console.log('Ouverture du navigateur...')
      console.log(`Si ça ne s'ouvre pas, visite: ${fullUrl}\n`)
      const cmd = process.platform === 'win32' ? `start "" "${fullUrl}"` :
                  process.platform === 'darwin' ? `open "${fullUrl}"` :
                  `xdg-open "${fullUrl}"`
      exec(cmd)
    })
  })
}

// ============================================================
// Helpers
// ============================================================
function slugify(str) {
  return (str || 'unknown')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

function extractEmail(fromHeader) {
  if (!fromHeader) return ''
  const m = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/)
  return (m ? m[1] : fromHeader).toLowerCase().trim()
}

function extractName(fromHeader) {
  if (!fromHeader) return ''
  const m = fromHeader.match(/^"?([^"<]+?)"?\s*</)
  return m ? m[1].trim() : ''
}

function shouldIgnoreFilename(name) {
  if (!name) return true
  const ext = '.' + name.split('.').pop().toLowerCase()
  if (!CERT_EXTENSIONS.includes(ext)) return true
  return IGNORE_FILENAME_PATTERNS.some(r => r.test(name))
}

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ============================================================
// Gmail helpers
// ============================================================
async function listAllMessages(gmail, query) {
  const messages = []
  let pageToken
  let page = 0
  do {
    page++
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken,
    })
    if (res.data.messages) messages.push(...res.data.messages)
    pageToken = res.data.nextPageToken
    console.log(`  Page ${page}: ${res.data.messages?.length || 0} messages (total: ${messages.length})`)
  } while (pageToken)
  return messages
}

function findHeader(headers, name) {
  const h = headers?.find(h => h.name.toLowerCase() === name.toLowerCase())
  return h?.value || ''
}

function collectAttachments(payload, out = []) {
  if (!payload) return out
  if (payload.filename && payload.body?.attachmentId) {
    out.push({
      filename: payload.filename,
      mimeType: payload.mimeType,
      size: payload.body.size,
      attachmentId: payload.body.attachmentId,
    })
  }
  if (payload.parts) {
    for (const p of payload.parts) collectAttachments(p, out)
  }
  return out
}

// ============================================================
// Supabase
// ============================================================
async function loadReservistes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('Supabase env manquants; match désactivé.')
    return new Map()
  }
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('reservistes')
    .select('benevole_id, prenom, nom, email')
  if (error) {
    console.warn('Erreur Supabase:', error.message)
    return new Map()
  }
  const map = new Map()
  for (const r of data) {
    if (r.email) map.set(r.email.toLowerCase().trim(), r)
  }
  console.log(`Supabase: ${map.size} réservistes chargés.\n`)
  return map
}

// ============================================================
// Main
// ============================================================
async function main() {
  const auth = await authorize()
  const gmail = google.gmail({ version: 'v1', auth })
  const reservistes = await loadReservistes()

  console.log('Recherche des messages Gmail...')
  let messages = await listAllMessages(gmail, QUERY)
  if (LIMIT) messages = messages.slice(0, LIMIT)
  console.log(`\nTotal: ${messages.length} messages à analyser.\n`)

  if (EXECUTE && !existsSync(FILES_DIR)) {
    await mkdir(FILES_DIR, { recursive: true })
  }

  const rows = []
  let i = 0
  for (const { id: msgId } of messages) {
    i++
    try {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: msgId,
        format: 'full',
      })
      const msg = res.data
      const headers = msg.payload?.headers || []
      const from = findHeader(headers, 'From')
      const senderEmail = extractEmail(from)
      const senderName = extractName(from)
      const subject = findHeader(headers, 'Subject')
      const dateHeader = findHeader(headers, 'Date')
      const date = new Date(parseInt(msg.internalDate)).toISOString()

      // Filtre: on veut des courriels ENTRANTS (de réservistes vers Esther/riusc).
      // On exclut ceux envoyés PAR aqbrs.ca (les Sent de Esther y apparaissent si thread)
      if (senderEmail.endsWith('@aqbrs.ca')) continue

      const atts = collectAttachments(msg.payload).filter(a => !shouldIgnoreFilename(a.filename))
      if (atts.length === 0) continue

      const match = reservistes.get(senderEmail)
      const slug = slugify(senderName || senderEmail.split('@')[0])

      for (let aIdx = 0; aIdx < atts.length; aIdx++) {
        const a = atts[aIdx]
        const safeName = a.filename.replace(/[^\w.\-]/g, '_')
        const localName = `${slug}_${msgId}_${aIdx}_${safeName}`
        const localPath = resolve(FILES_DIR, localName)

        if (EXECUTE) {
          const att = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: msgId,
            id: a.attachmentId,
          })
          const buf = Buffer.from(att.data.data, 'base64url')
          await writeFile(localPath, buf)
        }

        rows.push({
          thread_id: msg.threadId,
          message_id: msgId,
          date,
          sender_email: senderEmail,
          sender_name: senderName,
          benevole_id: match?.benevole_id || '',
          match_prenom: match?.prenom || '',
          match_nom: match?.nom || '',
          match_status: match ? 'MATCH' : 'NO_MATCH',
          subject,
          filename: a.filename,
          mime_type: a.mimeType,
          size_bytes: a.size,
          local_path: EXECUTE ? localPath : '',
        })
      }

      if (i % 10 === 0 || i === messages.length) {
        console.log(`  [${i}/${messages.length}] ${senderEmail} — ${atts.length} PJ`)
      }
    } catch (e) {
      console.warn(`  [${i}/${messages.length}] erreur msg ${msgId}: ${e.message}`)
    }
  }

  // CSV
  const headers = [
    'thread_id','message_id','date','sender_email','sender_name',
    'benevole_id','match_prenom','match_nom','match_status',
    'subject','filename','mime_type','size_bytes','local_path',
  ]
  const csv = [headers.join(',')]
  for (const r of rows) {
    csv.push(headers.map(h => csvEscape(r[h])).join(','))
  }
  await writeFile(CSV_PATH, csv.join('\n'), 'utf-8')

  // Résumé
  const matched = rows.filter(r => r.match_status === 'MATCH').length
  const unmatched = rows.length - matched
  const uniqueSenders = new Set(rows.map(r => r.sender_email)).size
  console.log('\n=== RÉSUMÉ ===')
  console.log(`Lignes CSV (PJ): ${rows.length}`)
  console.log(`Expéditeurs uniques: ${uniqueSenders}`)
  console.log(`Match Supabase: ${matched}`)
  console.log(`Sans match: ${unmatched}`)
  console.log(`CSV: ${CSV_PATH}`)
  if (EXECUTE) console.log(`PJ téléchargées dans: ${FILES_DIR}`)
  else console.log(`(DRY RUN — relance avec --execute pour télécharger)`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
