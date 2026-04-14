#!/usr/bin/env node
/**
 * 2e passage: tente un match par nom pour les NO_MATCH du rapport.csv
 * Produit rapport_no_match_propositions.csv avec candidats potentiels.
 */

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
dotenv.config({ path: resolve(ROOT, '.env.local') })

const CSV_IN = resolve(__dirname, 'rapport.csv')
const CSV_OUT = resolve(__dirname, 'rapport_no_match_propositions.csv')

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    // CSV naïf avec gestion des guillemets
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

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function extractNameTokens(senderName) {
  // "Serge Pelletier" -> ["serge", "pelletier"]
  // "jonathan dupuis" -> ["jonathan", "dupuis"]
  // "Eve T. Morel" -> ["eve", "morel"] (skip initiales)
  const norm = normalize(senderName)
  return norm.split(' ').filter(t => t.length > 1)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env manquants')
  const sb = createClient(url, key)

  const { data: reservistes, error } = await sb
    .from('reservistes')
    .select('benevole_id, prenom, nom, email, statut, groupe')
  if (error) throw error
  console.log(`Supabase: ${reservistes.length} réservistes chargés.`)

  // Index par tokens normalisés de (prenom nom)
  const index = reservistes.map(r => ({
    ...r,
    tokens: normalize(`${r.prenom || ''} ${r.nom || ''}`).split(' ').filter(Boolean),
  }))

  const csvText = await readFile(CSV_IN, 'utf-8')
  const rows = parseCSV(csvText)
  const noMatch = rows.filter(r => r.match_status === 'NO_MATCH')
  console.log(`NO_MATCH dans rapport.csv: ${noMatch.length}`)

  // Dédoubloner par sender_email
  const uniqueBySender = new Map()
  for (const r of noMatch) {
    if (!uniqueBySender.has(r.sender_email)) {
      uniqueBySender.set(r.sender_email, r)
    }
  }
  console.log(`Expéditeurs uniques NO_MATCH: ${uniqueBySender.size}`)

  const results = []
  for (const r of uniqueBySender.values()) {
    const tokens = extractNameTokens(r.sender_name)
    if (tokens.length < 2) {
      results.push({ ...r, candidats: '', confidence: 'nom_insuffisant' })
      continue
    }
    // Match: au moins 2 tokens en commun (prenom + nom typique)
    const matches = index.filter(res => {
      const matched = tokens.filter(t => res.tokens.includes(t))
      return matched.length >= 2
    })
    if (matches.length === 0) {
      results.push({ ...r, candidats: '', confidence: 'aucun_match' })
    } else if (matches.length === 1) {
      const m = matches[0]
      results.push({
        ...r,
        candidats: `${m.benevole_id} | ${m.prenom} ${m.nom} | ${m.email} | ${m.statut}/${m.groupe}`,
        confidence: 'un_match',
      })
    } else {
      results.push({
        ...r,
        candidats: matches.slice(0, 3).map(m =>
          `${m.benevole_id} | ${m.prenom} ${m.nom} | ${m.email}`
        ).join(' ||| '),
        confidence: `plusieurs_match(${matches.length})`,
      })
    }
  }

  // Output
  const headers = ['sender_email','sender_name','date','subject','filename','confidence','candidats']
  const lines = [headers.join(',')]
  for (const r of results) {
    lines.push(headers.map(h => csvEscape(r[h] || '')).join(','))
  }
  await writeFile(CSV_OUT, lines.join('\n'), 'utf-8')

  const un = results.filter(r => r.confidence === 'un_match').length
  const plus = results.filter(r => r.confidence.startsWith('plusieurs')).length
  const aucun = results.filter(r => r.confidence === 'aucun_match').length
  const insuf = results.filter(r => r.confidence === 'nom_insuffisant').length

  console.log(`\n=== RÉSUMÉ ===`)
  console.log(`Un match confiant: ${un}`)
  console.log(`Plusieurs candidats (homonymes): ${plus}`)
  console.log(`Aucun match: ${aucun}`)
  console.log(`Nom insuffisant: ${insuf}`)
  console.log(`\nCSV: ${CSV_OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
