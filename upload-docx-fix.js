require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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