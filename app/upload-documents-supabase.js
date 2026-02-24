const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION - À MODIFIER
// ============================================
const SUPABASE_URL = 'https://jtzwkmcfarxptpcoaxxl.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4';
const BUCKET_NAME = 'documents-officiels';
const DOCS_FOLDER = './documents-a-uploader'; // Dossier avec tes PDFs organisés

// ============================================
// SCRIPT D'UPLOAD
// ============================================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function uploadDocuments() {
  console.log('🚀 Début de l\'upload des documents vers Supabase Storage\n');
  console.log('📂 Dossier source:', DOCS_FOLDER);
  console.log('🪣 Bucket:', BUCKET_NAME);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Vérifier que le dossier existe
  if (!fs.existsSync(DOCS_FOLDER)) {
    console.error(`❌ Erreur: Le dossier "${DOCS_FOLDER}" n'existe pas`);
    console.log('\n💡 Crée ce dossier et organise tes fichiers comme ceci:');
    console.log('   documents-a-uploader/');
    console.log('   ├── 11281058368/');
    console.log('   │   ├── certificat.pdf');
    console.log('   │   └── lettre-attestation.pdf');
    console.log('   └── [autres-benevole-ids]/');
    return;
  }

  // Lire tous les dossiers (benevole_id)
  const benevoles = fs.readdirSync(DOCS_FOLDER).filter(f => 
    fs.statSync(path.join(DOCS_FOLDER, f)).isDirectory()
  );

  if (benevoles.length === 0) {
    console.error('❌ Aucun dossier de réserviste trouvé dans', DOCS_FOLDER);
    return;
  }

  console.log(`📊 ${benevoles.length} réservistes détectés\n`);

  let totalUploaded = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (const benevoleId of benevoles) {
    const folderPath = path.join(DOCS_FOLDER, benevoleId);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.pdf'));

    if (files.length === 0) {
      console.log(`⚠️  Réserviste ${benevoleId} - Aucun PDF trouvé`);
      totalSkipped++;
      continue;
    }

    console.log(`📁 Traitement réserviste ${benevoleId} (${files.length} fichiers)`);

    for (const fileName of files) {
      const filePath = path.join(folderPath, fileName);
      const fileBuffer = fs.readFileSync(filePath);
      const storagePath = `${benevoleId}/${fileName}`;

      try {
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, fileBuffer, {
            contentType: 'application/pdf',
            upsert: true, // Remplace si existe déjà
          });

        if (error) {
          console.log(`   ❌ Erreur: ${fileName} - ${error.message}`);
          totalErrors++;
        } else {
          console.log(`   ✅ Uploadé: ${fileName}`);
          totalUploaded++;
        }
      } catch (err) {
        console.log(`   ❌ Exception: ${fileName} - ${err.message}`);
        totalErrors++;
      }

      // Petit délai pour ne pas saturer l'API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RÉSUMÉ DE L\'UPLOAD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Succès:  ${totalUploaded} fichiers`);
  console.log(`❌ Erreurs: ${totalErrors} fichiers`);
  console.log(`⏭️  Ignorés: ${totalSkipped} réservistes (aucun PDF)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (totalUploaded > 0) {
    console.log('🎉 Upload terminé avec succès !');
    console.log('💡 Les réservistes peuvent maintenant voir leurs documents dans le portail.');
  }
}

// Lancer le script
uploadDocuments().catch(error => {
  console.error('\n❌ ERREUR FATALE:', error);
  process.exit(1);
});