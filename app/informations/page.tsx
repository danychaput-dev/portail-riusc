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
  groupe?: string;
}

// === PDFs du camp — remplacer les "#" par les vrais liens quand hébergés ===
const PDFS_SAMEDI = [
  { titre: "Structure d'équipe d'intervention", url: "#" },
  { titre: "La synergie de la Réserve d'intervention d'urgence en sécurité civile (RIUSC)", url: "#" },
  { titre: "Introduction RIUSC & Sécurité civile", url: "#" },
  { titre: "Aide-mémoire — Savoir-agir et bonnes pratiques en présence de personnes sinistrées", url: "#" },
];

const PDFS_DIMANCHE = [
  { titre: "Atelier Croix-Rouge — Aide-mémoire lits et dortoirs", url: "#" },
  { titre: "Atelier SOPFEU — Gestion des débris", url: "#" },
  { titre: "Atelier AQBRS — Sac de sable et digue", url: "#" },
];

export default function InformationsPage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const isApproved = reserviste?.groupe === 'Approuvé'

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
      if (!user) { router.push('/login'); return }
      setUser(user)

      let reservisteData = null
      if (user.email) {
        const { data } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, photo_url, groupe')
          .ilike('email', user.email)
          .single()
        reservisteData = data
      }
      if (!reservisteData && user.phone) {
        const phoneDigits = user.phone.replace(/\D/g, '')
        const { data } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, photo_url, groupe')
          .eq('telephone', phoneDigits)
          .single()
        if (!data) {
          const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits
          const { data: data2 } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, photo_url, groupe')
            .eq('telephone', phoneWithout1)
            .single()
          reservisteData = data2
        } else {
          reservisteData = data
        }
      }
      if (reservisteData) setReserviste(reservisteData)
      setLoading(false)
    }
    loadData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getInitials = () => {
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase()
    return user?.email?.charAt(0).toUpperCase() || 'U'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>
        Chargement...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Réserve d&apos;Intervention d&apos;Urgence</p>
            </div>
          </a>
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{reserviste ? `${reserviste.prenom} ${reserviste.nom}` : user?.email}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Réserviste</div>
              </div>
              {reserviste?.photo_url ? (
                <img src={reserviste.photo_url} alt="Photo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{getInitials()}</div>
              )}
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', minWidth: '200px', overflow: 'hidden' }}>
                <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  Accueil
                </a>
                <a href="/profil" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Mon profil
                </a>
                <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#dc2626', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', display: 'inline-block', marginBottom: '20px' }}>
          ← Retour à l&apos;accueil
        </a>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 32px 0', fontSize: '24px', fontWeight: '700' }}>
          Informations pratiques
        </h2>

        {/* ========== SECTION 1 : Ressources générales ========== */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
            Ressources générales
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Volume de référence */}
            <a
              href="https://online.fliphtml5.com/wscbg/xqkj/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.backgroundColor = '#f0f4f8' }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '28px' }}>📖</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Volume de référence — Bénévole en sécurité civile</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Guide complet AQBRS — Consultation en ligne</div>
                </div>
              </div>
              <svg width="20" height="20" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>

            {/* Fiches de tâches */}
            <a
              href="/deploiement/taches"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.backgroundColor = '#f0f4f8' }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '28px' }}>📋</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Fiches de tâches RIUSC</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>11 tâches avec analyses de risques et mesures de prévention</div>
                </div>
              </div>
              <svg width="20" height="20" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </a>
          </div>
        </div>

        {/* ========== SECTION 2 : Documents du camp (Approuvés seulement) ========== */}
        {isApproved && (
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Documents du camp de qualification
              </h3>
              <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                Réservistes approuvés
              </span>
            </div>

            {/* Samedi */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingLeft: '4px' }}>
                Samedi — Formation théorique
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {PDFS_SAMEDI.map((pdf, i) => (
                  <a
                    key={i}
                    href={pdf.url}
                    target={pdf.url !== '#' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={(e) => { if (pdf.url === '#') e.preventDefault() }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px',
                      border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'all 0.2s',
                      opacity: pdf.url === '#' ? 0.5 : 1,
                      cursor: pdf.url === '#' ? 'default' : 'pointer'
                    }}
                    onMouseOver={(e) => { if (pdf.url !== '#') { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.backgroundColor = '#f0f4f8' } }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{pdf.titre}</span>
                    </div>
                    {pdf.url !== '#' ? (
                      <span style={{ padding: '4px 12px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>Consulter</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Bientôt disponible</span>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* Dimanche */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', paddingLeft: '4px' }}>
                Dimanche — Ateliers pratiques
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {PDFS_DIMANCHE.map((pdf, i) => (
                  <a
                    key={i}
                    href={pdf.url}
                    target={pdf.url !== '#' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={(e) => { if (pdf.url === '#') e.preventDefault() }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px',
                      border: '1px solid #e5e7eb', textDecoration: 'none', transition: 'all 0.2s',
                      opacity: pdf.url === '#' ? 0.5 : 1,
                      cursor: pdf.url === '#' ? 'default' : 'pointer'
                    }}
                    onMouseOver={(e) => { if (pdf.url !== '#') { e.currentTarget.style.borderColor = '#1e3a5f'; e.currentTarget.style.backgroundColor = '#f0f4f8' } }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{pdf.titre}</span>
                    </div>
                    {pdf.url !== '#' ? (
                      <span style={{ padding: '4px 12px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>Consulter</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Bientôt disponible</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== SECTION 3 : Documents officiels (Approuvés seulement) ========== */}
        {isApproved && (
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Documents officiels
              </h3>
              <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                Réservistes approuvés
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Attestation de formation */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '28px' }}>🎓</span>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Attestation de formation</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Certificat de réussite du camp de qualification</div>
                  </div>
                </div>
                <span style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Non disponible</span>
              </div>

              {/* Lettre pour employeur */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '28px' }}>✉️</span>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Lettre pour l&apos;employeur</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Lettre officielle confirmant votre rôle de réserviste</div>
                  </div>
                </div>
                <span style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Non disponible</span>
              </div>
            </div>

            <p style={{ margin: '16px 0 0 0', fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
              Ces documents seront générés automatiquement après la complétion de votre camp de qualification.
            </p>
          </div>
        )}

        {/* Section contact */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <h3 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
            Besoin d&apos;aide ?
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>
            Pour toute question concernant votre rôle de réserviste, les déploiements ou les formations,
            n&apos;hésitez pas à nous contacter.
          </p>
          <a href="mailto:riusc@aqbrs.ca" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
            📧 riusc@aqbrs.ca
          </a>
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
