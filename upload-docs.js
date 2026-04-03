require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service_role, pas anon
)

const docsDir = path.join(__dirname, 'documents-a-uploader')

async function upload() {
  const folders = fs.readdirSync(docsDir).filter(f => 
    fs.statSync(path.join(docsDir, f)).isDirectory()
  )
  
  console.log(`📁 ${folders.length} dossiers trouvés`)
  let success = 0, errors = 0

  for (const folder of folders) {
    const folderPath = path.join(docsDir, folder)
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.pdf'))
    
    for (const file of files) {
      const filePath = path.join(folderPath, file)
      const storagePath = `${folder}/${file}`
      const fileBuffer = fs.readFileSync(filePath)
      
      const { error } = await supabase.storage
        .from('documents-officiels')
        .upload(storagePath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        })
      
      if (error) {
        console.error(`❌ ${storagePath}:`, error.message)
        errors++
      } else {
        success++
      }
    }
  }
  
  console.log(`\n✅ ${success} fichiers uploadés, ❌ ${errors} erreurs`)
}

upload()