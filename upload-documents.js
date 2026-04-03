// upload-documents.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const baseDir = 'C:\\Users\\Dany\\nextjs\\portail-riusc\\documents-a-uploader';

async function upload() {
  const folders = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());
  console.log(`📁 ${folders.length} dossiers trouvés`);

  let uploaded = 0, skipped = 0, errors = 0;

  for (const benevoleId of folders) {
    const folderPath = path.join(baseDir, benevoleId);
    
    for (const fileName of ['certificat.pdf', 'lettre-attestation.pdf']) {
      const filePath = path.join(folderPath, fileName);
      if (!fs.existsSync(filePath)) { skipped++; continue; }

      // Vérifier si déjà uploadé
      const { data: existing } = await supabase.storage
        .from('documents-officiels')
        .list(benevoleId, { search: fileName });
      
      if (existing && existing.length > 0) { skipped++; continue; }

      const fileBuffer = fs.readFileSync(filePath);
      const storagePath = `${benevoleId}/${fileName}`;

      const { error } = await supabase.storage
        .from('documents-officiels')
        .upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: false });

      if (error) {
        console.error(`❌ ${storagePath}: ${error.message}`);
        errors++;
      } else {
        uploaded++;
      }
    }
    
    if (uploaded % 20 === 0 && uploaded > 0) console.log(`✅ ${uploaded} fichiers uploadés...`);
  }

  console.log(`\n🎉 Terminé! Uploadés: ${uploaded}, Skippés: ${skipped}, Erreurs: ${errors}`);
}

upload();