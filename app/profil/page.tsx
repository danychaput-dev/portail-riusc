import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Charger les données du réserviste depuis la table
  const { data: reserviste } = await supabase
    .from('reservistes')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>👤 Mon Profil</h1>
      
      {reserviste ? (
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h2>Informations personnelles</h2>
          <p><strong>Nom :</strong> {reserviste.prenom} {reserviste.nom}</p>
          <p><strong>Email :</strong> {reserviste.email}</p>
          <p><strong>Téléphone :</strong> {reserviste.telephone}</p>
          <p><strong>Ville :</strong> {reserviste.ville}</p>
          <p><strong>Région :</strong> {reserviste.region}</p>
          <p><strong>Statut :</strong> <span style={{ 
            padding: '3px 8px', 
            backgroundColor: reserviste.statut === 'Actif' ? '#d4edda' : '#f8d7da',
            borderRadius: '4px',
            fontSize: '14px'
          }}>{reserviste.statut}</span></p>
          <p><strong>ID Bénévole :</strong> {reserviste.benevole_id}</p>
        </div>
      ) : (
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
          <p>⚠️ Aucun profil trouvé. Contactez l'administrateur.</p>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Retour à l'accueil
        </a>
      </div>
    </div>
  )
}