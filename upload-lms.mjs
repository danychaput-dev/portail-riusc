import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, resolve } from 'path'

// ⚠️ Remplace par ta vraie clé (Supabase → Settings → API → service_role)
const SUPABASE_URL = 'https://jtzwkmcfarxptpcoaxxl.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4'

// 📁 Chemin vers le dossier content du ZIP (avec / et pas \)
const LOCAL_CONTENT_PATH = 'C:/Users/dany_/Downloads/Import/content'

const BUCKET = 'lms-modules'
const TARGET_FOLDER = 'portail-riusc-premiers-pas'

const MIME_TYPES = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.ico':  'image/x-icon',
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = readdirSync(dirPath)
  for (const file of files) {
    const fullPath = join(dirPath, file)
    if (statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles)
    } else {
      arrayOfFiles.push(fullPath)
    }
  }
  return arrayOfFiles
}

async function upload() {
  // Résoudre le chemin absolu du dossier content
  const baseDir = resolve(LOCAL_CONTENT_PATH)
  const allFiles = getAllFiles(baseDir)
  console.log(`\n📦 ${allFiles.length} fichiers à uploader...\n`)

  let success = 0
  let errors = 0

  for (const filePath of allFiles) {
    // Chemin relatif depuis la racine du dossier content (sans le chemin local)
    const relativePath = filePath
      .replace(baseDir, '')
      .replace(/\\/g, '/')
      .replace(/^\//, '')

    const storagePath = `${TARGET_FOLDER}/${relativePath}`
    const ext = extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    const fileBuffer = readFileSync(filePath)

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error(`❌ ${storagePath} — ${error.message}`)
      errors++
    } else {
      console.log(`✅ ${storagePath}`)
      success++
    }
  }

  console.log(`\n✨ Terminé : ${success} succès, ${errors} erreurs`)
}

upload()
