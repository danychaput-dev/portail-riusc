'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  photo_url?: string;
}

export default function InformationsPage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [ciblages, setCiblages] = useState<string[]>([])

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      let reservisteData = null

      if (user.email) {
        const { data } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, photo_url')
          .ilike('email', user.email)
          .single()
        reservisteData = data
      }

      if (!reservisteData && user.phone && !user.email) {
        const phoneDigits = user.phone.replace(/\D/g, '')
        const { data } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, photo_url')
          .eq('telephone', phoneDigits)
          .single()
        if (!data) {
          const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits
          const { data: data2 } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, photo_url')
            .eq('telephone', phoneWithout1)
            .single()
          reservisteData = data2
        } else {
          reservisteData = data
        }
      }

      if (reservisteData) {
        setReserviste(reservisteData)

        const { data: ciblagesData } = await supabase
          .from('ciblages')
          .select('deploiement_id')
          .eq('benevole_id', reservisteData.benevole_id)

        if (ciblagesData) {
          setCiblages(ciblagesData.map(c => c.deploiement_id))
        }
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function getInitials(): string {
    if (reserviste) {
      return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase()
    }
    return user?.email?.charAt(0).toUpperCase() || 'U'
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image
              src="/logo.png"
              alt="Logo RIUSC"
              width={48}
              height={48}
              style={{ borderRadius: '8px' }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>
                Portail RIUSC
              </h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                Réserve d&apos;Intervention d&apos;Urgence
              </p>
            </div>
          </a>

          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = showUserMenu ? '#f3f4f6' : 'transparent'}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                  {reserviste ? `${reserviste.prenom} ${reserviste.nom}` : user?.email}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Réserviste</div>
              </div>
              {reserviste?.photo_url ? (
                <img
                  src={reserviste.photo_url}
                  alt="Photo de profil"
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#1e3a5f',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  {getInitials()}
                </div>
              )}
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                border: '1px solid #e5e7eb',
                minWidth: '200px',
                overflow: 'hidden'
              }}>
                <a href="/" style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6'
                }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Accueil
                </a>
                <a href="/profil" style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6'
                }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Mon profil
                </a>
                {ciblages.length > 0 && (
                <a href="/disponibilites" style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6'
                }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Mes disponibilités
                </a>
                )}
                <button
                  onClick={handleSignOut}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                    color: '#dc2626', backgroundColor: 'white', border: 'none', width: '100%',
                    textAlign: 'left', fontSize: '14px', cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Breadcrumb */}
        <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', display: 'block', marginBottom: '24px' }}>
          ← Retour à l&apos;accueil
        </a>

        <h2 style={{
          color: '#1e3a5f',
          margin: '0 0 32px 0',
          fontSize: '28px',
          fontWeight: '700'
        }}>
          Informations pratiques
        </h2>

        {/* Documents et ressources */}
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '24px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            color: '#1e3a5f',
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            Documents et ressources
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a
              href="https://www.legisquebec.gouv.qc.ca/fr/document/lc/S-2.4"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 18px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                textDecoration: 'none',
                color: '#374151',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#1e3a5f'
                e.currentTarget.style.backgroundColor = '#f0f4f8'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
            >
              <span style={{ fontSize: '22px', flexShrink: 0 }}>⚖️</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e3a5f', marginBottom: '2px' }}>
                  Protection légale des réservistes RIUSC lors d&apos;un déploiement
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  LSCRS – art. 88
                </div>
              </div>
              <svg width="18" height="18" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
            D&apos;autres documents seront ajoutés prochainement.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '24px',
        textAlign: 'center',
        marginTop: '60px'
      }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          © 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage
        </p>
      </footer>
    </div>
  )
}
