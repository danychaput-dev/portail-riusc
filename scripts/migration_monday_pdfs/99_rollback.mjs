// Rollback complet de la migration : supprime toutes les formations
// avec source='migration_monday_2026-04' + leurs fichiers Storage.
// Usage: node scripts/migration_monday_pdfs/99_rollback.mjs --confirm

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

if (!process.argv.includes('--confirm')) {
  console.error('⚠ Ajoute --confirm pour exécuter le rollback pour de vrai.')
  process.exit(1)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }})

const { data: rows, error } = await sb
  .from('formations_benevoles')
  .select('id, certificat_url, benevole_id, nom_complet, nom_formation')
  .eq('source', 'migration_monday_2026-04')

if (error) { console.error(error); process.exit(1) }
console.log(`Trouvé ${rows?.length || 0} entrées à supprimer`)

for (const r of rows || []) {
  if (r.certificat_url?.startsWith('storage:')) {
    const p = r.certificat_url.replace('storage:', '')
    const { error: rmErr } = await sb.storage.from('certificats').remove([p])
    if (rmErr) console.warn(`  Storage ${p}: ${rmErr.message}`)
  }
  const { error: delErr } = await sb.from('formations_benevoles').delete().eq('id', r.id)
  if (delErr) console.warn(`  DB ${r.id}: ${delErr.message}`)
  else console.log(`  ✓ ${r.nom_complet} — ${r.nom_formation}`)
}
console.log('Rollback terminé.')
