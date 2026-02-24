const { createClient } = require('@supabase/supabase-js');

// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://jtzwkmcfarxptpcoaxxl.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4';
const BUCKET_NAME = 'documents-officiels';

// IDs des 19 participants du camp (à remplir)
const PARTICIPANTS_CAMP = [
  // '11281058368',
  // '8738174928',
  // ... ajoute les 19 benevole_id
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifierDocuments() {
  console.log('🔍 Vérification des documents des participants du camp\n');
  console.log(`👥 ${PARTICIPANTS_CAMP.length} participants à vérifier\n`);

  let totalOK = 0;
  let totalManquants = 0;
  const problemes = [];

  for (const benevoleId of PARTICIPANTS_CAMP) {
    // Charger les infos du réserviste
    const { data: reserviste } = await supabase
      .from('reservistes')
      .select('prenom, nom, email')
      .eq('benevole_id', benevoleId)
      .single();

    if (!reserviste) {
      console.log(`❌ ${benevoleId} - Réserviste non trouvé dans la base`);
      problemes.push({ benevoleId, raison: 'Réserviste introuvable' });
      totalManquants++;
      continue;
    }

    const nomComplet = `${reserviste.prenom} ${reserviste.nom}`;

    // Vérifier les fichiers dans Storage
    const { data: files, error } = await supabase
      .storage
      .from(BUCKET_NAME)
      .list(benevoleId, {
        limit: 10,
        offset: 0,
      });

    if (error) {
      console.log(`❌ ${benevoleId} - ${nomComplet} - Erreur: ${error.message}`);
      problemes.push({ benevoleId, nomComplet, raison: error.message });
      totalManquants++;
      continue;
    }

    const hasCertificat = files?.some(f => f.name === 'certificat.pdf');
    const hasLettre = files?.some(f => f.name === 'lettre-attestation.pdf');

    if (hasCertificat && hasLettre) {
      console.log(`✅ ${benevoleId} - ${nomComplet} - 2/2 documents OK`);
      totalOK++;
    } else if (!hasCertificat && !hasLettre) {
      console.log(`❌ ${benevoleId} - ${nomComplet} - 0/2 documents (dossier vide)`);
      problemes.push({ benevoleId, nomComplet, raison: 'Aucun document' });
      totalManquants++;
    } else {
      console.log(`⚠️  ${benevoleId} - ${nomComplet} - ${hasCertificat ? '1' : '0'}/2 documents (certificat: ${hasCertificat ? 'OUI' : 'NON'}, lettre: ${hasLettre ? 'OUI' : 'NON'})`);
      problemes.push({ 
        benevoleId, 
        nomComplet, 
        raison: `Incomplet - ${hasCertificat ? 'Certificat OK' : 'Certificat manquant'}, ${hasLettre ? 'Lettre OK' : 'Lettre manquante'}`
      });
      totalManquants++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RÉSUMÉ DE LA VÉRIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Complets: ${totalOK}/${PARTICIPANTS_CAMP.length}`);
  console.log(`❌ Problèmes: ${totalManquants}/${PARTICIPANTS_CAMP.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (problemes.length > 0) {
    console.log('⚠️  DÉTAILS DES PROBLÈMES:\n');
    problemes.forEach(p => {
      console.log(`   ${p.benevoleId} - ${p.nomComplet || 'N/A'}`);
      console.log(`   → ${p.raison}\n`);
    });
  } else {
    console.log('🎉 Tous les participants ont leurs documents !');
  }
}

// Lancer la vérification
verifierDocuments().catch(error => {
  console.error('\n❌ ERREUR:', error);
  process.exit(1);
});