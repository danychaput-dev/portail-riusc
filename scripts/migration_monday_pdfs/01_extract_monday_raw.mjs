// Extrait MONDAY_RAW du fichier TSX vers un JSON pur.
// Usage: node scripts/migration_monday_pdfs/01_extract_monday_raw.mjs
import fs from 'node:fs'
import path from 'node:path'

const TSX = path.resolve('app/admin/certificats/page.tsx')
const OUT = path.resolve('scripts/migration_monday_pdfs/monday_raw.json')

const src = fs.readFileSync(TSX, 'utf-8')
const startMarker = 'const MONDAY_RAW: Omit<MondayItem, \'mState\'>[] = ['
const i = src.indexOf(startMarker)
if (i < 0) { console.error('MONDAY_RAW introuvable'); process.exit(1) }
const arrStart = i + startMarker.length - 1 // pointe sur '['
// Trouver le ']' de fin au niveau de bracket 0
let depth = 0, j = arrStart
for (; j < src.length; j++) {
  const c = src[j]
  if (c === '[') depth++
  else if (c === ']') { depth--; if (depth === 0) break }
}
const raw = src.slice(arrStart, j + 1)

// Le contenu est déjà du JS valide (objets avec clés non-quotées).
// On convertit en JSON en quotant les clés avec une regex.
// Les clés sont: monday_item_id, nom, email, files, name, url
// Les valeurs strings utilisent des single quotes — on les convertit en double quotes.
// On fait ça prudemment en évaluant le JS.
const asJs = `export default ${raw}`
fs.writeFileSync('/tmp/_monday_raw.mjs', asJs)
const mod = await import('/tmp/_monday_raw.mjs')
const data = mod.default
fs.writeFileSync(OUT, JSON.stringify(data, null, 2))
console.log(`OK: ${data.length} entrées extraites vers ${OUT}`)
