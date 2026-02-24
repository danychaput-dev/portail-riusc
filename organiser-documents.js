const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION - À MODIFIER
// ============================================
const SUPABASE_URL = 'https://jtzwkmcfarxptpcoaxxl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NzIyMjMsImV4cCI6MjA4NTA0ODIyM30.oh5lppjYMRp7Am5_zgn2yHA316NLO1Bv8VDfEEbzqhU'; 

const SOURCE_FOLDER = './pdfs-bruts';
const DEST_FOLDER = './documents-a-uploader';

// ============================================
// PATTERNS DE NOMMAGE
// ============================================
const PATTERNS = {
  certificat: /certificat.*?([a-zéèêàâôùûç]+(?:-[a-zéèêàâôùûç]+)+)\.pdf$/i,
  lettre: /lettre-attestation-([a-zéèêàâôùûç]+(?:-[a-zéèêàâôùûç]+)+)\.pdf$/i,
  attestation: /attestation-([a-zéèêàâôùûç]+(?:-[a-zéèêàâôùûç]+)+)\.pdf$/i,
};

// ============================================
// SCRIPT PRINCIPAL
// ============================================
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normaliserNom(nom) {
  return nom
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z-]/g, '');
}

async function organiserDocuments() {
  console.log('🚀 Organisation automatique des documents\n');

  console.log('📥 Chargement des réservistes depuis Supabase...');
  const { data: reservistes, error } = await supabase
    .from('reservistes')
    .select('benevole_id, prenom, nom')
    .eq('groupe', 'Approuvé');

  if (error) {
    console.error('❌ Erreur Supabase:', error.message);
    return;
  }

  console.log(`✅ ${reservistes.length} réservistes approuvés chargés\n`);

  const nomVersBenevolId = {};
  reservistes.forEach(r => {
    const nomComplet = normaliserNom(`${r.prenom}-${r.nom}`);
    nomVersBenevolId[nomComplet] = r.benevole_id;
  });

  if (!fs.existsSync(DEST_FOLDER)) {
    fs.mkdirSync(DEST_FOLDER, { recursive: true });
  }

  if (!fs.existsSync(SOURCE_FOLDER)) {
    console.error(`❌ Le dossier "${SOURCE_FOLDER}" n'existe pas`);
    console.log('\n💡 Crée ce dossier et mets-y tous tes PDFs désorganisés');
    return;
  }

  const fichiers = fs.readdirSync(SOURCE_FOLDER).filter(f => f.endsWith('.pdf'));
  console.log(`📂 ${fichiers.length} fichiers PDF trouvés dans ${SOURCE_FOLDER}\n`);

  let traites = 0;
  let ignores = 0;

  for (const fichier of fichiers) {
    const sourcePath = path.join(SOURCE_FOLDER, fichier);
    let nomExtrait = null;
    let typeFichier = null;

    for (const [type, pattern] of Object.entries(PATTERNS)) {
      const match = fichier.match(pattern);
      if (match) {
        nomExtrait = normaliserNom(match[1]);
        typeFichier = type === 'attestation' ? 'certificat' : type;
        break;
      }
    }

    if (!nomExtrait) {
      console.log(`⚠️  Ignoré: ${fichier} (pattern non reconnu)`);
      ignores++;
      continue;
    }

    const benevoleId = nomVersBenevolId[nomExtrait];
    if (!benevoleId) {
      console.log(`⚠️  Ignoré: ${fichier} (réserviste "${nomExtrait}" non trouvé)`);
      ignores++;
      continue;
    }

    const reservistFolder = path.join(DEST_FOLDER, benevoleId);
    if (!fs.existsSync(reservistFolder)) {
      fs.mkdirSync(reservistFolder, { recursive: true });
    }

    const nomFinal = typeFichier === 'certificat' ? 'certificat.pdf' : 'lettre-attestation.pdf';
    const destPath = path.join(reservistFolder, nomFinal);

    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ ${fichier} → ${benevoleId}/${nomFinal}`);
    traites++;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RÉSUMÉ DE L\'ORGANISATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Fichiers organisés: ${traites}`);
  console.log(`⚠️  Fichiers ignorés: ${ignores}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (traites > 0) {
    console.log('🎉 Organisation terminée !');
    console.log(`📁 Les fichiers sont maintenant dans: ${DEST_FOLDER}/`);
    console.log('\n💡 Prochaine étape: Lance le script d\'upload');
    console.log('   node upload-documents-supabase.js');
  }
}

organiserDocuments().catch(error => {
  console.error('\n❌ ERREUR FATALE:', error);
  process.exit(1);
});