import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>Portail RIUSC</h1>
      <p>Bienvenue, <strong>{user.email}</strong> !</p>
      
      <div style={{ marginTop: '30px' }}>
        <h2>Menu</h2>
        <ul>
          <li><a href="/profil">👤 Mon Profil</a></li>
          <li><a href="/disponibilites">📅 Mes Disponibilités</a></li>
          <li><a href="/missions">🚨 Missions Actives</a></li>
          <li><a href="/formulaires">📝 Formulaires</a></li>
        </ul>
      </div>

      <form action="/auth/signout" method="post" style={{ marginTop: '30px' }}>
        <button 
          type="submit"
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🚪 Déconnexion
        </button>
      </form>
    </div>
  )
}