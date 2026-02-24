/**
 * Script pour remplir la table documents_officiels depuis Supabase Storage
 * 
 * Ce script lit tous les fichiers du bucket documents-officiels
 * et crée les entrées correspondantes dans la table documents_officiels
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes!')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function syncStorageToTable() {
  console.log('🔍 Lecture du bucket documents-officiels...\n')

  // Lister tous les fichiers du bucket
  const { data: files, error: listError } = await supabase
    .storage
    .from('documents-officiels')
    .list('', {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (listError) {
    console.error('❌ Erreur lecture bucket:', listError)
    return
  }

  console.log(`📁 ${files.length} dossiers trouvés\n`)

  let totalInserted = 0
  let totalErrors = 0

  // Pour chaque dossier (benevole_id)
  for (const folder of files) {
    if (!folder.name || folder.name === '.emptyFolderPlaceholder') continue

    const benevoleId = folder.name
    console.log(`\n📂 Traitement du dossier: ${benevoleId}`)

    // Lister les fichiers dans ce dossier
    const { data: pdfs, error: pdfError } = await supabase
      .storage
      .from('documents-officiels')
      .list(benevoleId, {
        limit: 100,
        offset: 0
      })

    if (pdfError) {
      console.error(`   ❌ Erreur lecture dossier ${benevoleId}:`, pdfError)
      totalErrors++
      continue
    }

    console.log(`   📄 ${pdfs.length} fichiers trouvés`)

    // Pour chaque PDF
    for (const pdf of pdfs) {
      if (!pdf.name || !pdf.name.endsWith('.pdf')) continue

      // Déterminer le type et le titre
      const fileName = pdf.name
      let typeDocument = 'certificat'
      let titre = 'Certificat de camp de qualification'

      if (fileName.includes('lettre') || fileName.includes('attestation')) {
        typeDocument = 'lettre'
        titre = 'Lettre de confirmation de participation'
      }

      // Chemin dans Storage
      const cheminStorage = `${benevoleId}/${fileName}`

      // Vérifier si l'entrée existe déjà
      const { data: existing } = await supabase
        .from('documents_officiels')
        .select('id')
        .eq('benevole_id', benevoleId)
        .eq('nom_fichier', fileName)
        .single()

      if (existing) {
        console.log(`   ⏭️  Déjà existant: ${fileName}`)
        continue
      }

      // Créer l'entrée
      const { error: insertError } = await supabase
        .from('documents_officiels')
        .insert({
          benevole_id: benevoleId,
          type_document: typeDocument,
          titre: titre,
          nom_fichier: fileName,
          chemin_storage: cheminStorage
        })

      if (insertError) {
        console.error(`   ❌ Erreur insertion ${fileName}:`, insertError.message)
        totalErrors++
      } else {
        console.log(`   ✅ Ajouté: ${fileName}`)
        totalInserted++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 RÉSUMÉ')
  console.log('='.repeat(60))
  console.log(`✅ Documents ajoutés: ${totalInserted}`)
  console.log(`❌ Erreurs: ${totalErrors}`)
  console.log('='.repeat(60))

  // Afficher le total dans la table
  const { count } = await supabase
    .from('documents_officiels')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📋 Total dans la table: ${count} documents\n`)
}

// Exécuter
syncStorageToTable()
  .then(() => {
    console.log('✅ Synchronisation terminée!')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
