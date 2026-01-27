'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        setLoading(false)
      }
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div style={{ padding: '50px' }}>Chargement...</div>
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>Portail RIUSC</h1>
      <p>Bienvenue, <strong>{user?.email}</strong> !</p>
      
      <div style={{ marginTop: '30px' }}>
        <h2>Menu</h2>
        <ul>
          <li><a href="/profil">👤 Mon Profil</a></li>
          <li><a href="/disponibilites">📅 Mes Disponibilités</a></li>
          <li><a href="/missions">🚨 Missions Actives</a></li>
          <li><a href="/formulaires">📝 Formulaires</a></li>
        </ul>
      </div>

      <div style={{ marginTop: '30px' }}>
        <button 
          onClick={handleSignOut}
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
      </div>
    </div>
  )
}