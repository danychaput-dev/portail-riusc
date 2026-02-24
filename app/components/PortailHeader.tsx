'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import ImpersonateBanner from './ImpersonateBanner'
import ImpersonateModal from './ImpersonateModal'

interface Reserviste {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  telephone?: string
  photo_url?: string
  groupe?: string
  date_naissance?: string
  adresse?: string
  ville?: string
  region?: string
  contact_urgence_nom?: string
  contact_urgence_telephone?: string
}

interface CampStatus {
  is_certified: boolean
}

interface PortailHeaderProps {
  subtitle?: string
  // Pour les pages qui ont déjà chargé le réserviste, on peut le passer en prop
  // pour éviter un double fetch — sinon le composant le charge lui-même
  reservisteOverride?: Reserviste | null
}

const DANY_BENEVOLE_ID = '8738174928' // Pour activer le menu d'emprunt

export default function PortailHeader({ subtitle = 'Portail RIUSC', reservisteOverride }: PortailHeaderProps) {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(reservisteOverride ?? null)
  const [campStatus, setCampStatus] = useState<CampStatus | null>(null)
  const [hasCertificats, setHasCertificats] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [isApproved, setIsApproved] = useState(false)
  const [hasCiblages, setHasCiblages] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showImpersonateModal, setShowImpersonateModal] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Champs nécessaires pour vérifier la complétude du profil + header
  const selectFields = 'benevole_id, prenom, nom, email, telephone, photo_url, groupe, date_naissance, adresse, ville, region, contact_urgence_nom, contact_urgence_telephone'

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
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)

      // Charger réserviste seulement si pas passé en prop
      let res = reservisteOverride ?? null
      if (!res) {
        // 1. D'abord chercher par user_id (le plus fiable)
        const { data: dataByUserId } = await supabase
          .from('reservistes')
          .select(selectFields)
          .eq('user_id', user.id)
          .single()
        
        if (dataByUserId) {
          res = dataByUserId
        }
        
        // 2. Sinon chercher par email
        if (!res && user.email) {
          const { data } = await supabase
            .from('reservistes')
            .select(selectFields)
            .ilike('email', user.email)
            .single()
          
          // Si trouvé, mettre à jour le user_id pour la prochaine fois
          if (data) {
            await supabase
              .from('reservistes')
              .update({ user_id: user.id })
              .eq('benevole_id', data.benevole_id)
            res = data
          }
        }
        
        // 3. Sinon chercher par téléphone
        if (!res && user.phone) {
          const phoneDigits = user.phone.replace(/\D/g, '')
          const { data } = await supabase
            .from('reservistes')
            .select(selectFields)
            .eq('telephone', phoneDigits)
            .single()
          
          if (!data && phoneDigits.startsWith('1')) {
            const phoneWithout1 = phoneDigits.slice(1)
            const { data: data2 } = await supabase
              .from('reservistes')
              .select(selectFields)
              .eq('telephone', phoneWithout1)
              .single()
            
            if (data2) {
              await supabase
                .from('reservistes')
                .update({ user_id: user.id })
                .eq('benevole_id', data2.benevole_id)
              res = data2
            }
          } else if (data) {
            await supabase
              .from('reservistes')
              .update({ user_id: user.id })
              .eq('benevole_id', data.benevole_id)
            res = data
          }
        }
        
        if (res) setReserviste(res)
      }

      const approved = res?.groupe === 'Approuvé'
      setIsApproved(approved)

      if (approved && res) {
        // Charger les 2 sources en parallèle : camp-status + certificats
        const [campResult, certResult] = await Promise.allSettled([
          fetch(`https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${res.benevole_id}`).then(r => r.ok ? r.json() : null),
          fetch(`https://n8n.aqbrs.ca/webhook/riusc-get-certificats?benevole_id=${res.benevole_id}`).then(r => r.ok ? r.json() : null)
        ])

        // Camp status
        if (campResult.status === 'fulfilled' && campResult.value) {
          setCampStatus(campResult.value)
        }

        // Certificats — on vérifie juste s'il y en a au moins un
        if (certResult.status === 'fulfilled' && certResult.value?.success && certResult.value.files?.length > 0) {
          setHasCertificats(true)
        }

        // Vérifier s'il y a des ciblages actifs
        const { data: ciblages } = await supabase
          .from('ciblages')
          .select('id')
          .eq('benevole_id', res.benevole_id)
          .limit(1)
        setHasCiblages((ciblages ?? []).length > 0)
      }

      setLoadingStatus(false)
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleImpersonate = async (benevole_id: string) => {
    try {
      const response = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benevole_id }),
        credentials: 'include'
      })

      if (response.ok) {
        setShowImpersonateModal(false)
        window.location.href = '/'
      } else {
        console.error('Erreur emprunt')
      }
    } catch (error) {
      console.error('Erreur emprunt:', error)
    }
  }

  const getInitials = () => {
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase()
    return user?.email?.charAt(0).toUpperCase() || 'U'
  }

  // ========================================================
  // LOGIQUE DÉPLOYABLE — même 3 conditions que page Formation
  // ========================================================
  const isProfilComplet = !!(
    reserviste &&
    reserviste.prenom && reserviste.nom && reserviste.email && reserviste.telephone &&
    reserviste.date_naissance && reserviste.adresse && reserviste.ville && reserviste.region &&
    reserviste.contact_urgence_nom && reserviste.contact_urgence_telephone
  )

  const isDeployable = isApproved && isProfilComplet && hasCertificats && (campStatus?.is_certified === true)

  // Compteur pour le sous-texte (ex: "2/3 étapes complétées")
  const completedSteps = [isProfilComplet, hasCertificats, campStatus?.is_certified === true].filter(Boolean).length

  // Vérifier si c'est Dany (peut emprunter des identités)
  const isDany = 8738174928

  return (
    <>
      <ImpersonateBanner />
      
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo + titre */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{subtitle}</p>
            </div>
          </a>

          {/* Menu utilisateur */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = showUserMenu ? '#f3f4f6' : 'transparent'}
            >
              {/* Nom + statut */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                  {reserviste ? `${reserviste.prenom} ${reserviste.nom}` : user?.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '12px' }}>
                  {loadingStatus ? (
                    <span style={{ color: '#6b7280' }}>Réserviste</span>
                  ) : !isApproved ? (
                    <span style={{ color: '#6b7280' }}>Réserviste</span>
                  ) : isDeployable ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span style={{ color: '#059669', fontWeight: '600' }}>Déployable</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span style={{ color: '#dc2626', fontWeight: '600' }}>Non déployable</span>
                    </>
                  )}
                </div>
              </div>

              {/* Avatar */}
              {reserviste?.photo_url ? (
                <img src={reserviste.photo_url} alt="Photo de profil" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{getInitials()}</div>
              )}

              {/* Chevron */}
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', minWidth: '210px', overflow: 'hidden', zIndex: 200 }}>

                <a href="/profil" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Mon profil
                </a>

                {isApproved && hasCiblages && (
                  <a href="/disponibilites" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Mes disponibilités
                  </a>
                )}

                <a href="/informations" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Informations pratiques
                </a>

                {isDany && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      setShowImpersonateModal(true)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#f59e0b', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fffbeb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <span style={{ fontSize: '18px' }}>🎭</span>
                    Emprunter une identité
                  </button>
                )}

                <button onClick={handleSignOut}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#dc2626', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showImpersonateModal && (
        <ImpersonateModal
          onClose={() => setShowImpersonateModal(false)}
          onImpersonate={handleImpersonate}
        />
      )}
    </>
  )
}
