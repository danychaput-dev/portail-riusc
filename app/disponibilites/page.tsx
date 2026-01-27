import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DisponibilitesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>📅 Mes Disponibilités</h1>
      
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <p><em>Cette page affichera vos disponibilités depuis Monday.com</em></p>
        <p><em>À venir : Formulaire pour mettre à jour vos disponibilités</em></p>
      </div>

      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Retour à l'accueil
        </a>
      </div>
    </div>
  )
}