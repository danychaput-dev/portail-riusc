async function fetchDeploiementsActifs() {
  // Pas besoin de filtre sur date, le workflow gère déjà ça !
  const { data, error } = await supabase
    .from('deploiements_actifs')
    .select('*')
    .order('date_debut', { ascending: true });
  
  if (error) {
    console.error('Erreur fetch déploiements:', error);
  }
  
  if (data) {
    setDeploiementsActifs(data);
  }
}