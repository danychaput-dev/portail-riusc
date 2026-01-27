'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'

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
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#1e3a5f'
      }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '20px 0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          <Image
            src="/logo.png"
            alt="Logo RIUSC"
            width={80}
            height={80}
            style={{ borderRadius: '50%' }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '28px' }}>Portail RIUSC</h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
              Réserve d'Intervention d'Urgence - Sécurité Civile du Québec
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Welcome Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <h2 style={{ color: '#1e3a5f', margin: '0 0 10px 0' }}>
            Bienvenue, {user?.email} !
          </h2>
          <p style={{ color: '#666', margin: 0 }}>
            Accédez à vos informations et gérez votre profil de réserviste
          </p>
        </div>

        {/* Menu Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {/* Profil Card */}
          <a href="/profil" style={{ textDecoration: 'none' }}>
            <div style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
              border: '2px solid transparent'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
              e.currentTarget.style.borderColor = '#4a90e2'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = 'transparent'
            }}
            >
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>👤</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 10px 0' }}>Mon Profil</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
                Consultez et mettez à jour vos informations personnelles
              </p>
            </div>
          </a>

          {/* Disponibilités Card */}
          <a href="/disponibilites" style={{ textDecoration: 'none' }}>
            <div style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
              border: '2px solid transparent'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
              e.currentTarget.style.borderColor = '#4a90e2'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = 'transparent'
            }}
            >
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📅</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 10px 0' }}>Mes Disponibilités</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
                Gérez vos disponibilités pour les déploiements
              </p>
            </div>
          </a>

          {/* Missions Card */}
          <a href="/missions" style={{ textDecoration: 'none' }}>
            <div style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
              border: '2px solid transparent'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
              e.currentTarget.style.borderColor = '#ff8c42'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = 'transparent'
            }}
            >
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🚨</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 10px 0' }}>Missions Actives</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
                Consultez les déploiements et missions en cours
              </p>
            </div>
          </a>

          {/* Formulaires Card */}
          <a href="/formulaires" style={{ textDecoration: 'none' }}>
            <div style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
              border: '2px solid transparent'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
              e.currentTarget.style.borderColor = '#4a90e2'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
              e.currentTarget.style.borderColor = 'transparent'
            }}
            >
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📝</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 10px 0' }}>Formulaires</h3>
              <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
                Accédez aux formulaires et documents importants
              </p>
            </div>
          </a>
        </div>

        {/* Sign Out Button */}
        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={handleSignOut}
            style={{
              padding: '12px 30px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          >
            🚪 Déconnexion
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '20px',
        textAlign: 'center',
        marginTop: '60px'
      }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
          © 2026 AQBRS - Tous droits réservés
        </p>
      </footer>
    </div>
  )
}