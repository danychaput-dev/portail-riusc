import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function FormulairesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>📝 Formulaires</h1>
      
      <div style={{ marginTop: '30px' }}>
        <h2>Formulaires disponibles</h2>
        
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3>📋 Mettre à jour mes disponibilités</h3>
            <p>Indiquez vos disponibilités pour les prochains déploiements</p>
            <a 
              href="https://form.jotform.com/votre-form-id" 
              target="_blank"
              style={{ color: '#0070f3', textDecoration: 'none' }}
            >
              → Ouvrir le formulaire
            </a>
          </div>

          <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3>📄 Mettre à jour mes informations</h3>
            <p>Modifiez vos coordonnées et informations personnelles</p>
            <a 
              href="https://form.jotform.com/votre-form-id" 
              target="_blank"
              style={{ color: '#0070f3', textDecoration: 'none' }}
            >
              → Ouvrir le formulaire
            </a>
          </div>

          <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3>✅ Confirmer ma participation</h3>
            <p>Confirmez votre présence pour le prochain camp de qualification</p>
            <a 
              href="https://form.jotform.com/votre-form-id" 
              target="_blank"
              style={{ color: '#0070f3', textDecoration: 'none' }}
            >
              → Ouvrir le formulaire
            </a>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Retour à l'accueil
        </a>
      </div>
    </div>
  )
}