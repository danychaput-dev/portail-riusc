const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION - À MODIFIER
// ============================================

const SUPABASE_URL = 'https://jtzwkmcfarxptpcoaxxl.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4';
const BUCKET_NAME = 'documents-officiels';
const SOURCE_FOLDER = './pdfs-bruts'; // Tes PDFs désorganisés
const DEST_FOLDER = './documents-a-uploader'; // Dossier organisé pour l'upload

// ============================================
// PATTERNS DE NOMMAGE DE TES FICHIERS
// ============================================
// Exemples:
// - certificat-dany-chaput.pdf
// - lettre-attestation-dany-chaput.pdf
// - certificat-jean-tremblay.pdf
// - attestation-marie-louise-gagnon.pdf

const PATTERNS = {
  certificat: /certificat.*?([a-zéèêàâôùûç]+(?:-[a-zéèêàâôùûç]+)+)\.pdf$/i,
  lettre: /lettre.*?([a-zéèêàâôùûç]+(?:-[a-zéèêàâôùûç]+)+)\.pdf$/i,
  attestation: /attestation.*?([a-zéèêàâôùûç]+(?:-[a-zéèêàâôùûç]+)+)\.pdf$/i,
};

// ============================================
// SCRIPT PRINCIPAL
// ============================================
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fonction pour normaliser les noms
function normaliserNom(nom) {
  return nom
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Retirer accents
    .replace(/[^a-z-]/g, '');
}

async function organiserDocuments() {
  console.log('🚀 Organisation automatique des documents\n');

  // 1. Charger tous les réservistes depuis Supabase
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

  // 2. Créer un mapping nom-complet → benevole_id
  const nomVersBenevolId = {};
  reservistes.forEach(r => {
    const nomComplet = normaliserNom(`${r.prenom}-${r.nom}`);
    nomVersBenevolId[nomComplet] = r.benevole_id;
  });

  // 3. Créer le dossier de destination
  if (!fs.existsSync(DEST_FOLDER)) {
    fs.mkdirSync(DEST_FOLDER, { recursive: true });
  }

  // 4. Lire tous les PDFs du dossier source
  if (!fs.existsSync(SOURCE_FOLDER)) {
    console.error(`❌ Le dossier "${SOURCE_FOLDER}" n'existe pas`);
    console.log('\n💡 Crée ce dossier et mets-y tous tes PDFs désorganisés');
    return;
  }

  const fichiers = fs.readdirSync(SOURCE_FOLDER).filter(f => f.endsWith('.pdf'));
  console.log(`📂 ${fichiers.length} fichiers PDF trouvés dans ${SOURCE_FOLDER}\n`);

  let traites = 0;
  let ignores = 0;

  // 5. Traiter chaque fichier
  for (const fichier of fichiers) {
    const sourcePath = path.join(SOURCE_FOLDER, fichier);
    let nomExtrait = null;
    let typeFichier = null;

    // Essayer d'extraire le nom avec chaque pattern
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

    // Trouver le benevole_id correspondant
    const benevoleId = nomVersBenevolId[nomExtrait];
    if (!benevoleId) {
      console.log(`⚠️  Ignoré: ${fichier} (réserviste "${nomExtrait}" non trouvé)`);
      ignores++;
      continue;
    }

    // Créer le dossier du réserviste
    const reservistFolder = path.join(DEST_FOLDER, benevoleId);
    if (!fs.existsSync(reservistFolder)) {
      fs.mkdirSync(reservistFolder, { recursive: true });
    }

    // Déterminer le nom final
    const nomFinal = typeFichier === 'certificat' ? 'certificat.pdf' : 'lettre-attestation.pdf';
    const destPath = path.join(reservistFolder, nomFinal);

    // Copier le fichier
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

// Lancer le script
organiserDocuments().catch(error => {
  console.error('\n❌ ERREUR FATALE:', error);
  process.exit(1);
});
