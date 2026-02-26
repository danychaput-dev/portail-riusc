const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  'https://jtzwkmcfarxptpcoaxxl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4'
)

async function retry() {
  const filePath = path.join(__dirname, 'documents-a-uploader', '10563333252', 'certificat.pdf')
  const fileBuffer = fs.readFileSync(filePath)
  
  const { error } = await supabase.storage
    .from('documents-officiels')
    .upload('10563333252/certificat.pdf', fileBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })
  
  console.log(error ? `❌ ${error.message}` : '✅ OK')
}

retry()