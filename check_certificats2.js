const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  'https://jtzwkmcfarxptpcoaxxl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0endrbWNmYXJ4cHRwY29heHhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQ3MjIyMywiZXhwIjoyMDg1MDQ4MjIzfQ.jG28BvbLke_gg6egI3jvUi0fmOc-Of-w4orI1viHgg4'
)

const personnes = [
  { nom: 'Thierry Gaudron', email: 'formation@sauvetage02.org', cert: "S'initier securite civile + autres" },
  { nom: 'Olivier Theriault', email: 'olithe@gmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Pascal Savard', email: 'savard_pascal@hotmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Jean Huot', email: 'jeanhuotjh@gmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Christian Mireault', email: 'christianmireault@hotmail.ca', cert: "S'initier a la securite civile" },
  { nom: 'Catherine Renetane', email: 'renetane@hotmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Jean-Francois Canciani', email: 'jf_canciani@hotmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Olivier Jolicoeur', email: 'oligym.jolicoeur@gmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Vendelin Clicques', email: 'vendelin.clicques@outlook.com', cert: "S'initier a la securite civile" },
  { nom: 'M. Cormier', email: 'mcormier1@bell.net', cert: "S'initier a la securite civile" },
  { nom: 'Nelson Eddingfield', email: 'eddingfield@gmx.com', cert: "Certificat non specifie" },
  { nom: 'Anessa Kimball', email: 'anessa.kimball@gmail.com', cert: "Formation (ne pouvait telecharger)" },
  { nom: 'Marie-Eve Brousseau', email: 'brousseau.marieve@gmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Rehan Mian', email: 'mian_r@hotmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Martin Sanfacon', email: 'martinsanfacon@outlook.com', cert: "S'initier a la securite civile" },
  { nom: 'Vi-Hoan Wuong', email: 'vihoanwuong@gmail.com', cert: "Certificat de formation" },
  { nom: 'Jean-Guy Paris', email: 'parisjeanguy@gmail.com', cert: "S'initier a la securite civile" },
  { nom: 'Pierre Dubois', email: 'pierredubois57@hotmail.com', cert: "Certification Croix-Rouge" },
  { nom: 'Jerry Drouin', email: 'jerrydrouin58@gmail.com', cert: "RIUSC + Scie a chaine + Premiers soins" },
  { nom: 'Mathieu Laporte', email: 'mlaporte@promutech.ca', cert: "AMU" },
  { nom: 'Victor Bonet', email: 'vct.bonet@gmail.com', cert: "Certificat non specifie" },
  { nom: 'Manel Djemel', email: 'm.djemel@laval.ca', cert: "Formation (Ville de Laval)" },
]

async function main() {
  const results = []
  for (const p of personnes) {
    // Chercher par email d'abord
    let { data: res } = await supabase
      .from('reservistes')
      .select('benevole_id, prenom, nom, email, groupe, statut')
      .ilike('email', p.email)
      .limit(1)
    
    let match_method = 'email'
    let reserviste = res?.[0] || null
    
    // Si pas trouve, chercher par nom (split prenom/nom)
    if (!reserviste) {
      const parts = p.nom.split(' ')
      if (parts.length >= 2) {
        const prenom = parts[0]
        const nom = parts.slice(1).join(' ')
        // Essayer prenom + nom
        const { data: r1 } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, groupe, statut')
          .ilike('prenom', `%${prenom}%`)
          .ilike('nom', `%${nom}%`)
          .limit(3)
        if (r1?.length === 1) { reserviste = r1[0]; match_method = 'nom exact' }
        else if (r1?.length > 1) { reserviste = r1[0]; match_method = `nom (${r1.length} resultats)` }
        
        // Si toujours pas, essayer inverser nom/prenom (ex: "Messier Stephane" = nom prenom)
        if (!reserviste) {
          const { data: r2 } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, groupe, statut')
            .ilike('prenom', `%${nom}%`)
            .ilike('nom', `%${prenom}%`)
            .limit(3)
          if (r2?.length === 1) { reserviste = r2[0]; match_method = 'nom inverse' }
          else if (r2?.length > 1) { reserviste = r2[0]; match_method = `nom inverse (${r2.length} resultats)` }
        }
        
        // Dernier essai: juste le nom de famille
        if (!reserviste) {
          const { data: r3 } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, groupe, statut')
            .ilike('nom', `%${nom}%`)
            .limit(5)
          if (r3?.length === 1) { reserviste = r3[0]; match_method = 'nom famille seul' }
          else if (r3?.length > 1) { 
            // Trop d'homonymes, pas fiable
            reserviste = null
            match_method = `${r3.length} homonymes`
          }
        }
      }
    }
    
    let formations = []
    if (reserviste) {
      const { data: f } = await supabase
        .from('formations_benevoles')
        .select('id, nom_formation, resultat, certificat_url, date_reussite')
        .eq('benevole_id', reserviste.benevole_id)
      formations = f || []
    }

    const hasSSC = formations.some(f => 
      f.nom_formation && (
        f.nom_formation.toLowerCase().includes('initier') || 
        f.nom_formation.toLowerCase().includes('securite civile') ||
        f.nom_formation.toLowerCase().includes('sécurité civile') ||
        f.nom_formation.toLowerCase().includes('msp')
      )
    )
    const hasCertFile = formations.some(f => 
      f.certificat_url && f.certificat_url.length > 5 &&
      f.nom_formation && (
        f.nom_formation.toLowerCase().includes('initier') || 
        f.nom_formation.toLowerCase().includes('securite civile') ||
        f.nom_formation.toLowerCase().includes('sécurité civile') ||
        f.nom_formation.toLowerCase().includes('msp')
      )
    )

    let action
    if (!reserviste) action = 'PAS DANS LE PORTAIL'
    else if (hasSSC && hasCertFile) action = 'DEJA OK'
    else if (hasSSC && !hasCertFile) action = 'FICHIER MANQUANT'
    else if (!hasSSC) action = 'FORMATION ABSENTE'

    results.push({
      nom_courriel: p.nom,
      email_courriel: p.email,
      cert_courriel: p.cert,
      match: match_method,
      dans_portail: reserviste ? 'OUI' : 'NON',
      nom_portail: reserviste ? `${reserviste.prenom} ${reserviste.nom}` : '',
      email_portail: reserviste?.email || '',
      groupe: reserviste?.groupe || '',
      statut: reserviste?.statut || '',
      nb_formations: formations.length,
      formations: formations.map(f => `${f.nom_formation} [${f.resultat}]${f.certificat_url ? ' +PDF' : ''}`).join(' | ') || '(aucune)',
      a_ssc: hasSSC ? 'OUI' : 'NON',
      a_fichier: hasCertFile ? 'OUI' : 'NON',
      action
    })
  }

  console.log(JSON.stringify(results))
}
main().catch(e => { console.error(e); process.exit(1) })
