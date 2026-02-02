'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'

interface DeploiementActif {
  id: string;
  deploiement_id: string;
  nom_deploiement: string;
  nom_sinistre?: string;
  nom_demande?: string;
  organisme?: string;
  date_debut: string;
  date_fin: string;
  lieu?: string;
  statut: string;
}

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
}

interface CampInfo {
  nom: string;
  dates: string;
  site: string;
  location: string;
}

interface CampStatus {
  is_certified: boolean;
  has_inscription: boolean;
  session_id: string | null;
  camp: CampInfo | null;
  lien_inscription: string | null;
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [deploiementsActifs, setDeploiementsActifs] = useState<DeploiementActif[]>([])
  const [campStatus, setCampStatus] = useState<CampStatus | null>(null)
  const [loadingCamp, setLoadingCamp] = useState(true)
  const [cancellingInscription, setCancellingInscription] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // États pour le formulaire d'inscription
  const [showInscriptionModal, setShowInscriptionModal] = useState(false)
  const [inscriptionLoading, setInscriptionLoading] = useState(false)
  const [inscriptionError, setInscriptionError] = useState<string | null>(null)
  const [inscriptionSuccess, setInscriptionSuccess] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      
      // Fetch reserviste pour le lien Jotform
      const { data: reservisteData } = await supabase
        .from('reservistes')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (reservisteData) {
        setReserviste(reservisteData)
        
        // Fetch camp status depuis n8n
        try {
          const response = await fetch(
            `https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${reservisteData.benevole_id}`
          )
          if (response.ok) {
            const data = await response.json()
            setCampStatus(data)
          }
        } catch (error) {
          console.error('Erreur fetch camp status:', error)
        }
        setLoadingCamp(false)
      }
      
      // Fetch déploiements actifs
      const { data: deploiements } = await supabase
        .from('deploiements_actifs')
        .select('*')
        .order('date_debut', { ascending: true })
      
      if (deploiements) {
        setDeploiementsActifs(deploiements)
      }
      
      setLoading(false)
    }
    loadData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleCancelInscription = async () => {
    if (!reserviste || !confirm('Êtes-vous sûr de vouloir annuler votre inscription au camp ?')) {
      return
    }
    
    setCancellingInscription(true)
    
    try {
      const response = await fetch(
        `/api/camp/cancel?benevole_id=${reserviste.benevole_id}`,
        { method: 'POST' }
      )
      
      if (response.ok) {
        // Rafraîchir le statut du camp
        const statusResponse = await fetch(
          `https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${reserviste.benevole_id}`
        )
        if (statusResponse.ok) {
          const data = await statusResponse.json()
          setCampStatus(data)
        }
        alert('Votre inscription a été annulée.')
      } else {
        alert('Erreur lors de l\'annulation. Veuillez réessayer.')
      }
    } catch (error) {
      console.error('Erreur annulation:', error)
      alert('Erreur lors de l\'annulation. Veuillez réessayer.')
    }
    
    setCancellingInscription(false)
  }

  // Nouvelle fonction : inscription au camp via n8n
  const handleInscriptionCamp = async () => {
    if (!reserviste || !campStatus?.session_id) {
      setInscriptionError('Données manquantes pour l\'inscription')
      return
    }
    
    setInscriptionLoading(true)
    setInscriptionError(null)
    
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/inscription-camp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          session_id: campStatus.session_id,
          presence: 'confirme',
          courriel: reserviste.email,
          telephone: reserviste.telephone || null,
          prenom_nom: `${reserviste.prenom} ${reserviste.nom}`
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setInscriptionSuccess(true)
        
        // Rafraîchir le statut du camp après 2 secondes
        setTimeout(async () => {
          const statusResponse = await fetch(
            `https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${reserviste.benevole_id}`
          )
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            setCampStatus(statusData)
          }
          setShowInscriptionModal(false)
          setInscriptionSuccess(false)
        }, 2000)
      } else {
        setInscriptionError(data.error || 'Erreur lors de l\'inscription')
      }
    } catch (error) {
      console.error('Erreur inscription:', error)
      setInscriptionError('Erreur de connexion. Veuillez réessayer.')
    }
    
    setInscriptionLoading(false)
  }

  // Extraire session_id du lien Fillout si non fourni directement
  const getSessionIdFromLink = (link: string | null): string | null => {
    if (!link) return null
    try {
      const url = new URL(link)
      return url.searchParams.get('SessionID')
    } catch {
      return null
    }
  }

  // Session ID effectif (soit direct, soit extrait du lien)
  const effectiveSessionId = campStatus?.session_id || getSessionIdFromLink(campStatus?.lien_inscription)

  function genererLienJotform(deploiementId: string): string {
    if (!reserviste) return '#';
    return `https://form.jotform.com/253475614808262?BenevoleID=${reserviste.benevole_id}&DeploiementID=${deploiementId}`;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { 
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };
    return date.toLocaleDateString('fr-CA', options);
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
      {/* Modal d'inscription au camp */}
      {showInscriptionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            {inscriptionSuccess ? (
              // Message de succès
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h3 style={{ color: '#065f46', margin: '0 0 10px 0' }}>
                  Inscription confirmée !
                </h3>
                <p style={{ color: '#4b5563', margin: 0 }}>
                  Vous recevrez une confirmation par {reserviste?.telephone ? 'SMS' : 'courriel'}.
                </p>
              </div>
            ) : (
              // Formulaire de confirmation
              <>
                <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0' }}>
                  📝 Confirmer votre inscription
                </h3>
                
                <div style={{
                  backgroundColor: '#f0fdf4',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#111827' }}>
                    {campStatus?.camp?.nom || 'Camp de qualification'}
                  </p>
                  {campStatus?.camp?.dates && (
                    <p style={{ margin: '4px 0', color: '#4b5563', fontSize: '14px' }}>
                      📅 {campStatus.camp.dates}
                    </p>
                  )}
                  {campStatus?.camp?.site && (
                    <p style={{ margin: '4px 0', color: '#4b5563', fontSize: '14px' }}>
                      🏢 {campStatus.camp.site}
                    </p>
                  )}
                  {campStatus?.camp?.location && (
                    <p style={{ margin: '4px 0', color: '#4b5563', fontSize: '14px' }}>
                      📍 {campStatus.camp.location}
                    </p>
                  )}
                </div>
                
                <div style={{
                  backgroundColor: '#f9fafb',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#111827' }}>
                    Vos informations
                  </p>
                  <p style={{ margin: '4px 0', color: '#4b5563', fontSize: '14px' }}>
                    👤 {reserviste?.prenom} {reserviste?.nom}
                  </p>
                  <p style={{ margin: '4px 0', color: '#4b5563', fontSize: '14px' }}>
                    ✉️ {reserviste?.email}
                  </p>
                  {reserviste?.telephone && (
                    <p style={{ margin: '4px 0', color: '#4b5563', fontSize: '14px' }}>
                      📱 {reserviste.telephone}
                    </p>
                  )}
                </div>
                
                {inscriptionError && (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '14px'
                  }}>
                    ❌ {inscriptionError}
                  </div>
                )}
                
                <p style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  margin: '0 0 20px 0',
                  fontStyle: 'italic'
                }}>
                  En confirmant, vous vous engagez à être présent aux deux journées complètes du camp.
                </p>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setShowInscriptionModal(false)
                      setInscriptionError(null)
                    }}
                    disabled={inscriptionLoading}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: inscriptionLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleInscriptionCamp}
                    disabled={inscriptionLoading || !effectiveSessionId}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: inscriptionLoading ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: inscriptionLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {inscriptionLoading ? '⏳ Inscription...' : '✅ Confirmer mon inscription'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
            Bienvenue, {reserviste ? `${reserviste.prenom} ${reserviste.nom}` : user?.email} !
          </h2>
          <p style={{ color: '#666', margin: 0 }}>
            Accédez à vos informations et gérez votre profil de réserviste
          </p>
        </div>

        {/* Section Camp de Qualification */}
        {!loadingCamp && campStatus && !campStatus.is_certified && (
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '30px',
            border: campStatus.has_inscription ? '2px solid #10b981' : '2px solid #3b82f6'
          }}>
            <h3 style={{ 
              color: '#1e3a5f', 
              margin: '0 0 20px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '24px' }}>🎓</span>
              Camp de Qualification
              {campStatus.has_inscription && (
                <span style={{
                  backgroundColor: '#d1fae5',
                  color: '#065f46',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  Inscrit
                </span>
              )}
            </h3>
            
            {campStatus.has_inscription && campStatus.camp ? (
              /* Affichage des infos du camp si inscrit */
              <div style={{
                backgroundColor: '#f0fdf4',
                padding: '20px',
                borderRadius: '10px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                    {campStatus.camp.nom}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '8px', fontSize: '15px', color: '#4b5563' }}>
                  {campStatus.camp.dates && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📅</span>
                      <span><strong>Dates :</strong> {campStatus.camp.dates}</span>
                    </div>
                  )}
                  {campStatus.camp.site && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🏢</span>
                      <span><strong>Site :</strong> {campStatus.camp.site}</span>
                    </div>
                  )}
                  {campStatus.camp.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📍</span>
                      <span><strong>Lieu :</strong> {campStatus.camp.location}</span>
                    </div>
                  )}
                </div>
                
                {/* Boutons d'action */}
                <div style={{ 
                  marginTop: '20px', 
                  display: 'flex', 
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={handleCancelInscription}
                    disabled={cancellingInscription}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: cancellingInscription ? 'not-allowed' : 'pointer',
                      opacity: cancellingInscription ? 0.7 : 1,
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => { if (!cancellingInscription) e.currentTarget.style.backgroundColor = '#b91c1c' }}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                  >
                    {cancellingInscription ? '⏳ Annulation...' : '❌ Je ne suis plus disponible'}
                  </button>
                </div>
              </div>
            ) : (
              /* Bouton d'inscription si pas inscrit */
              <div style={{
                backgroundColor: '#eff6ff',
                padding: '20px',
                borderRadius: '10px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#1e40af', marginBottom: '16px', fontSize: '15px' }}>
                  Pour devenir réserviste certifié, vous devez compléter un camp de qualification.
                </p>
                {effectiveSessionId ? (
                  <button
                    onClick={() => setShowInscriptionModal(true)}
                    style={{
                      display: 'inline-block',
                      padding: '14px 28px',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                  >
                    📝 S'inscrire à un camp de qualification
                  </button>
                ) : (
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    Aucun camp disponible pour le moment. Vous serez contacté prochainement.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section Missions Actives */}
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '30px',
          border: deploiementsActifs.length > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb'
        }}>
          <h3 style={{ 
            color: '#1e3a5f', 
            margin: '0 0 20px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '24px' }}>🚨</span>
            Déploiements en recherche de réservistes
            {deploiementsActifs.length > 0 && (
              <span style={{
                backgroundColor: '#fef3c7',
                color: '#92400e',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {deploiementsActifs.length} actif{deploiementsActifs.length > 1 ? 's' : ''}
              </span>
            )}
          </h3>
          
          {deploiementsActifs.length === 0 ? (
            <div style={{
              padding: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#6b7280', margin: 0 }}>
                Aucun déploiement actif pour le moment.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {deploiementsActifs.map((dep) => (
                <div
                  key={dep.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '20px',
                    backgroundColor: '#fffbeb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}
                >
                  <div style={{ flex: '1', minWidth: '250px' }}>
                    {dep.nom_sinistre && (
                      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                        🔥 {dep.nom_sinistre}
                      </div>
                    )}
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#111827',
                      marginBottom: '8px'
                    }}>
                      {dep.nom_deploiement}
                    </div>
                    <div style={{ fontSize: '14px', color: '#4b5563' }}>
                      📅 {dep.date_debut && formatDate(dep.date_debut)}
                      {dep.date_fin && ` → ${formatDate(dep.date_fin)}`}
                    </div>
                    {dep.lieu && (
                      <div style={{ fontSize: '14px', color: '#4b5563', marginTop: '4px' }}>
                        📍 {dep.lieu}
                      </div>
                    )}
                  </div>
                  
                  <a
                    href={genererLienJotform(dep.deploiement_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '12px 20px',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                  >
                    Soumettre ma disponibilité
                  </a>
                </div>
              ))}
            </div>
          )}
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
