const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  'https://jtzwkmcfarxptpcoaxxl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4' // service_role, pas anon
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