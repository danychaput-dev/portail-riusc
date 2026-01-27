import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function MissionsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>🚨 Missions Actives</h1>
      
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
        <h3>Aucune mission active pour le moment</h3>
        <p><em>Les déploiements et missions actifs apparaîtront ici</em></p>
        <p><em>Synchronisé avec Monday.com</em></p>
      </div>

      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Retour à l'accueil
        </a>
      </div>
    </div>
  )
}