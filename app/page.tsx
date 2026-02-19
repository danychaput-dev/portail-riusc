'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import GuidedTour from './components/GuidedTour'

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
  type_incident?: string;
}
interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  photo_url?: string;
  groupe?: string;
  consent_photos?: boolean;
  allergies_alimentaires?: string;
  allergies_autres?: string;
  problemes_sante?: string;
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

interface SessionCamp {
  session_id: string;
  nom: string;
  dates: string;
  site: string;
  location: string;
}

interface CertificatFile {
  id: string;
  name: string;
  url?: string;
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [deploiementsActifs, setDeploiementsActifs] = useState<DeploiementActif[]>([])
  const [ciblages, setCiblages] = useState<string[]>([])
  const [campStatus, setCampStatus] = useState<CampStatus | null>(null)
  const [loadingCamp, setLoadingCamp] = useState(true)
  const [cancellingInscription, setCancellingInscription] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [certificats, setCertificats] = useState<CertificatFile[]>([])
  const [loadingCertificats, setLoadingCertificats] = useState(true)
  const [uploadingCertificat, setUploadingCertificat] = useState(false)
  const [certificatMessage, setCertificatMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const certificatInputRef = useRef<HTMLInputElement>(null)
  
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  
  const [showCampModal, setShowCampModal] = useState(false)
  const [sessionsDisponibles, setSessionsDisponibles] = useState<SessionCamp[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [allergiesAlimentaires, setAllergiesAlimentaires] = useState<string>('')
  const [autresAllergies, setAutresAllergies] = useState<string>('')
  const [conditionsMedicales, setConditionsMedicales] = useState<string>('')
  const [consentementPhoto, setConsentementPhoto] = useState<boolean>(false)
  const [loadingDossier, setLoadingDossier] = useState<boolean>(false)
  const [inscriptionLoading, setInscriptionLoading] = useState(false)
  const [inscriptionError, setInscriptionError] = useState<string | null>(null)
  const [inscriptionSuccess, setInscriptionSuccess] = useState(false)
  
  const [showTour, setShowTour] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
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

  const loadCertificats = async (benevoleId: string) => {
    setLoadingCertificats(true)
    try {
      const response = await fetch(
        `https://n8n.aqbrs.ca/webhook/riusc-get-certificats?benevole_id=${benevoleId}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.files) {
          setCertificats(data.files)
        }
      }
    } catch (error) {
      console.error('Erreur fetch certificats:', error)
    }
    setLoadingCertificats(false)
  }

  const handleCertificatUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !reserviste) return

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      setCertificatMessage({ type: 'error', text: 'Format accepté : PDF, JPG ou PNG' })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setCertificatMessage({ type: 'error', text: 'Le fichier ne doit pas dépasser 10 Mo' })
      return
    }

    setUploadingCertificat(true)
    setCertificatMessage(null)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-upload-certificat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          file_name: file.name,
          file_base64: base64
        })
      })

      const data = await response.json()

      if (data.success) {
        setCertificatMessage({ type: 'success', text: 'Certificat ajouté avec succès !' })
        await loadCertificats(reserviste.benevole_id)
      } else {
        setCertificatMessage({ type: 'error', text: data.error || "Erreur lors de l'envoi" })
      }
    } catch (error) {
      console.error('Erreur upload certificat:', error)
      setCertificatMessage({ type: 'error', text: "Erreur lors de l'envoi" })
    }

    setUploadingCertificat(false)
    if (certificatInputRef.current) {
      certificatInputRef.current.value = ''
    }
  }

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      
      let reservisteData = null
      
      // 1. D'abord chercher par user_id (le plus fiable)
      const { data: dataByUserId } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, consent_photos, allergies_alimentaires, allergies_autres, conditions_medicales')
        .single()
      
      if (dataByUserId) {
        reservisteData = dataByUserId
      }
      
      // 2. Sinon chercher par email
      if (!reservisteData && user.email) {
        const { data } = await supabase
          .from('reservistes')
         .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, consent_photos, allergies_alimentaires, allergies_autres, conditions_medicales')
          .ilike('email', user.email)
          .single()
        
        // Si trouvé, mettre à jour le user_id pour la prochaine fois
        if (data) {
          await supabase
            .from('reservistes')
            .update({ user_id: user.id })
            .eq('benevole_id', data.benevole_id)
          reservisteData = data
        }
      }
      
      // 3. Sinon chercher par téléphone
      if (!reservisteData && user.phone) {
        const phoneDigits = user.phone.replace(/\D/g, '')
        const { data } = await supabase
          .from('reservistes')
          .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, consent_photos, allergies_alimentaires, allergies_autres, problemes_sante')
          .eq('telephone', phoneDigits)
          .single()
        
        if (!data && phoneDigits.startsWith('1')) {
          const phoneWithout1 = phoneDigits.slice(1)
          const { data: data2 } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, consent_photos, allergies_alimentaires, allergies_autres, problemes_sante')
            .eq('telephone', phoneWithout1)
            .single()
          
          if (data2) {
            await supabase
              .from('reservistes')
              .update({ user_id: user.id })
              .eq('benevole_id', data2.benevole_id)
            reservisteData = data2
          }
        } else if (data) {
          await supabase
            .from('reservistes')
            .update({ user_id: user.id })
            .eq('benevole_id', data.benevole_id)
          reservisteData = data
        }
      }
      
      if (reservisteData) {
        setReserviste(reservisteData)
        
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
        
        await loadCertificats(reservisteData.benevole_id)

        const { data: ciblagesData } = await supabase
          .from('ciblages')
          .select('deploiement_id')
          .eq('benevole_id', reservisteData.benevole_id)

        if (ciblagesData && ciblagesData.length > 0) {
          const deployIds = ciblagesData.map(c => c.deploiement_id)
          setCiblages(deployIds)
          
          const { data: deploiements } = await supabase
            .from('deploiements_actifs')
            .select('*')
            .in('deploiement_id', deployIds)
            .order('date_debut', { ascending: true })
          
          if (deploiements) {
            setDeploiementsActifs(deploiements)
          }
        }
      }
      
      const { data: lastSeen } = await supabase
        .from('community_last_seen')
        .select('last_seen_at')
        .eq('user_id', user.id)
        .single()

      const since = lastSeen?.last_seen_at || '2000-01-01'
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', since)

      if (count) setUnreadCount(count)

      setLoading(false)
    }
    loadData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const openCampModal = async () => {
    setShowCampModal(true)
    setLoadingSessions(true)
    setInscriptionError(null)
    setInscriptionSuccess(false)
    setSelectedSessionId('')
    // Pré-remplir depuis reserviste déjà chargé au démarrage
    setConsentementPhoto(reserviste?.consent_photos || false)
    setAllergiesAlimentaires(reserviste?.allergies_alimentaires || '')
    setAutresAllergies(reserviste?.allergies_autres || '')
    setConditionsMedicales(reserviste?.problemes_sante || '')

    // Charger les sessions
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/sessions-camps')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.sessions) setSessionsDisponibles(data.sessions)
      }
    } catch (error) {
      console.error('Erreur fetch sessions:', error)
      setInscriptionError('Impossible de charger les camps disponibles')
    }

    setLoadingSessions(false)
  }

  const closeCampModal = () => {
    setShowCampModal(false)
    setSelectedSessionId('')
    setInscriptionError(null)
    setInscriptionSuccess(false)
  }

  const handleSubmitInscription = async () => {
    if (!reserviste || !selectedSessionId) {
      setInscriptionError('Veuillez sélectionner un camp')
      return
    }
    
    setInscriptionLoading(true)
    setInscriptionError(null)
    
    try {
      // Sauvegarder les allergies dans le dossier en parallèle
      fetch('https://n8n.aqbrs.ca/webhook/riusc-update-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          dossier: {
            allergies_alimentaires: allergiesAlimentaires || '',
            allergies_autres: autresAllergies || '',
            problemes_sante: conditionsMedicales || ''
          }
        })
      }).catch(e => console.error('Erreur update dossier allergies:', e))

      const response = await fetch('https://n8n.aqbrs.ca/webhook/inscription-camp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          session_id: selectedSessionId,
          presence: 'confirme',
          courriel: reserviste.email,
          telephone: reserviste.telephone || null,
          prenom_nom: `${reserviste.prenom} ${reserviste.nom}`,
          allergies_alimentaires: allergiesAlimentaires || null,
          autres_allergies: autresAllergies || null,
          conditions_medicales: conditionsMedicales || null,
          consentement_photo: consentementPhoto
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setInscriptionSuccess(true)
        // Persister dans Supabase ET mettre à jour le state local (pour cancel + reopen)
        const updates = {
          consent_photos: consentementPhoto,
          allergies_alimentaires: allergiesAlimentaires || undefined,
          allergies_autres: autresAllergies || undefined,
          problemes_sante: conditionsMedicales || undefined
        }
        supabase.from('reservistes').update(updates).eq('benevole_id', reserviste.benevole_id)
          .then(() => { setReserviste(prev => prev ? { ...prev, ...updates } : prev) })
        setTimeout(() => {
          closeCampModal()
          window.location.reload()
        }, 2000)
      } else {
        setInscriptionError(data.error || "Erreur lors de l'inscription")
      }
    } catch (error) {
      console.error('Erreur inscription:', error)
      setInscriptionError('Erreur de connexion. Veuillez réessayer.')
    }
    
    setInscriptionLoading(false)
  }

  const handleCancelInscription = async () => {
    if (!reserviste || !confirm("Êtes-vous sûr de vouloir annuler votre inscription au camp ?")) {
      return
    }
    
    setCancellingInscription(true)
    
    try {
      const response = await fetch(
        `https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${reserviste.benevole_id}&action=cancel`,
        { method: 'POST' }
      )
      
      if (response.ok) {
        window.location.reload()
      } else {
        alert("Erreur lors de l'annulation. Veuillez réessayer.")
      }
    } catch (error) {
      console.error('Erreur annulation:', error)
      alert("Erreur lors de l'annulation. Veuillez réessayer.")
    }
    
    setCancellingInscription(false)
  }

  function genererLienDisponibilite(deploiementId: string): string {
    if (!reserviste) return '#';
    return `/disponibilites/soumettre?deploiement=${deploiementId}`;
  }

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('fr-CA', options);
  }

  function getInitials(): string {
    if (reserviste) {
      return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase()
    }
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
      <style>{`@media (max-width: 640px) { .hide-mobile { display: none !important; } }`}</style>
      {showCampModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {inscriptionSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '64px', height: '64px', backgroundColor: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="32" height="32" fill="none" stroke="#059669" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 style={{ color: '#065f46', margin: '0 0 10px 0', fontSize: '20px' }}>{campStatus?.has_inscription ? 'Modification confirmée' : 'Inscription confirmée'}</h3>
                <p style={{ color: '#4b5563', margin: 0 }}>Vous recevrez une confirmation par {reserviste?.telephone ? 'SMS' : 'courriel'}.</p>
              </div>
            ) : (
              <>
                <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '22px', fontWeight: '600' }}>{campStatus?.has_inscription ? 'Modifier mon inscription' : 'Inscription au camp de qualification'}</h3>
                <p style={{ color: '#6b7280', margin: '0 0 24px 0', fontSize: '14px' }}>{campStatus?.has_inscription ? 'Sélectionnez un autre camp si vous souhaitez modifier votre inscription.' : 'Sélectionnez le camp auquel vous souhaitez participer.'}</p>
                <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #1e3a5f' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vos informations</p>
                  <p style={{ margin: '4px 0', color: '#374151', fontSize: '14px' }}>{reserviste?.prenom} {reserviste?.nom}</p>
                  <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '14px' }}>{reserviste?.email}</p>
                  {reserviste?.telephone && <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '14px' }}>{reserviste.telephone}</p>}
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Sélectionnez un camp de qualification</label>
                  {loadingSessions ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', backgroundColor: '#f9fafb', borderRadius: '8px' }}>Chargement des camps disponibles...</div>
                  ) : sessionsDisponibles.filter(s => s.session_id !== campStatus?.session_id).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#92400e', backgroundColor: '#fef3c7', borderRadius: '8px' }}>Aucun autre camp disponible pour le moment.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sessionsDisponibles.filter(session => session.session_id !== campStatus?.session_id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr-CA', { numeric: true })).map((session) => (
                        <label key={session.session_id} style={{ display: 'block', padding: '16px', border: selectedSessionId === session.session_id ? '2px solid #1e3a5f' : '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', backgroundColor: selectedSessionId === session.session_id ? '#f0f4f8' : 'white', transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <input type="radio" name="session" value={session.session_id} checked={selectedSessionId === session.session_id} onChange={(e) => setSelectedSessionId(e.target.value)} style={{ marginTop: '4px' }} />
                            <div>
                              <div style={{ fontWeight: '600', color: '#111827', marginBottom: '6px' }}>{session.nom}</div>
                              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                                {session.dates && <div>{session.dates}</div>}
                                {session.site && <div>{session.site}</div>}
                                {session.location && <div style={{ color: '#9ca3af' }}>{session.location}</div>}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {inscriptionError && <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{inscriptionError}</div>}

                {/* Allergies alimentaires */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Allergies alimentaires</label>
                  <textarea
                    value={allergiesAlimentaires}
                    onChange={(e) => setAllergiesAlimentaires(e.target.value)}
                    placeholder="Ex: Noix, arachides, fruits de mer..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#374151', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Autres allergies */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Autres allergies</label>
                  <textarea
                    value={autresAllergies}
                    onChange={(e) => setAutresAllergies(e.target.value)}
                    placeholder="Ex: Latex, pollen, médicaments..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#374151', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Conditions médicales */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Problèmes de santé ou conditions médicales</label>
                  <textarea
                    value={conditionsMedicales}
                    onChange={(e) => setConditionsMedicales(e.target.value)}
                    placeholder="Conditions dont l'équipe devrait être informée lors d'un déploiement..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', color: '#374151', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Consentement photo */}
                <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={consentementPhoto}
                      onChange={(e) => setConsentementPhoto(e.target.checked)}
                      style={{ marginTop: '3px', width: '16px', height: '16px', flexShrink: 0, accentColor: '#1e3a5f' }}
                    />
                    <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                      Je comprends que des photos ou vidéos peuvent être prises lors des activités de formation,
                      d&apos;entraînement ou de déploiement et j&apos;autorise l&apos;AQBRS / RIUSC à utiliser les images captées par leurs
                      représentants à des fins de communication. <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                  </label>
                </div>

                <p style={{ color: '#92400e', fontSize: '13px', margin: '0 0 24px 0', backgroundColor: '#fffbeb', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>En confirmant, vous vous engagez à être présent aux deux journées complètes du camp.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={closeCampModal} disabled={inscriptionLoading} style={{ padding: '12px 24px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: inscriptionLoading ? 'not-allowed' : 'pointer', fontWeight: '500' }}>Annuler</button>
                  <button onClick={handleSubmitInscription} disabled={inscriptionLoading || !selectedSessionId || loadingSessions} style={{ padding: '12px 24px', backgroundColor: (inscriptionLoading || !selectedSessionId) ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: (inscriptionLoading || !selectedSessionId) ? 'not-allowed' : 'pointer' }}>
                    {inscriptionLoading ? 'Traitement...' : campStatus?.has_inscription ? 'Confirmer la modification' : "Confirmer mon inscription"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Réserve d&apos;Intervention d&apos;Urgence</p>
            </div>
          </div>
          
          <div ref={userMenuRef} data-tour="menu" style={{ position: 'relative' }}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = showUserMenu ? '#f3f4f6' : 'transparent'}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{reserviste ? `${reserviste.prenom} ${reserviste.nom}` : user?.email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '12px' }}>
                  {loadingCamp ? (
                    <span style={{ color: '#6b7280' }}>Réserviste</span>
                  ) : isApproved && campStatus?.is_certified ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span className="hide-mobile" style={{ color: '#059669', fontWeight: '600' }}>Déployable</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      <span className="hide-mobile" style={{ color: '#dc2626', fontWeight: '600' }}>Non déployable</span>
                    </>
                  )}
                </div>
              </div>
              {reserviste?.photo_url ? (
                <img src={reserviste.photo_url} alt="Photo de profil" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{getInitials()}</div>
              )}
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {showUserMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', minWidth: '200px', overflow: 'hidden' }}>
                <a href="/profil" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Mon profil
                </a>
                {isApproved && (
                <a href="/dossier" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Mon dossier réserviste
                </a>
                )}
                {isApproved && ciblages.length > 0 && (
                <a href="/disponibilites" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Mes disponibilités
                </a>
                )}
                <a href="/tournee-camps" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Tournée des camps
                </a>
                <a href="/informations" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Informations pratiques
                </a>
                <button onClick={() => { setShowUserMenu(false); setShowTour(true); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  Visite guidée
                </button>
                <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#dc2626', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <div data-tour="welcome" style={{ backgroundColor: '#1e3a5f', padding: '28px 32px', borderRadius: '12px', marginBottom: '28px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '100%', background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.05) 100%)', pointerEvents: 'none' }} />
          <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: '700' }}>
            Bienvenue sur la plateforme du réserviste{reserviste ? `, ${reserviste.prenom}` : ''} !
          </h2>
          <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', opacity: 0.9 }}>
            Votre espace unique où vous trouverez toutes les informations pertinentes pour votre rôle
            au sein de la Réserve d&apos;intervenants d&apos;urgence en sécurité civile. Consultez vos documents,
            gérez vos inscriptions et restez informé des prochains événements.
          </p>
        </div>

        {/* Section Formation obligatoire - visible si aucun certificat */}
        {!loadingCertificats && certificats.length === 0 && (
          <div data-tour="formation-obligatoire" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <div>
                <p style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#92400e', fontSize: '15px' }}>
                  Formation obligatoire requise
                </p>
                <p style={{ margin: '0 0 16px 0', color: '#78350f', fontSize: '14px', lineHeight: '1.6' }}>
                  Pour compléter votre inscription à la RIUSC, vous devez suivre la formation
                  <strong> « S&apos;initier à la sécurité civile »</strong> sur la plateforme du Centre RISC,
                  puis nous soumettre votre certificat de réussite.
                </p>
                <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}><strong>Durée :</strong> environ 1 h 45</p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}><strong>Contenu :</strong> 5 modules à suivre à votre rythme</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}><strong>Délai :</strong> 30 jours après votre inscription</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  <a href="https://formation.centrerisc.com/go/formation/cours/AKA1E0D36C322A9E75AAKA/inscription" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                    🎓 Accéder à la formation
                  </a>
                  <a href="https://rsestrie-my.sharepoint.com/:v:/g/personal/dany_chaput_rsestrie_org/EcWyUX-i-DNPnQI7RmYgdiIBkORhzpF_1NimfhVb5kQyHw" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                    📺 Tutoriel vidéo
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loadingCertificats && certificats.length === 0 && (
          <div style={{ marginBottom: '20px' }}>
            <input ref={certificatInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleCertificatUpload} style={{ display: 'none' }} />
            <button onClick={() => certificatInputRef.current?.click()} disabled={uploadingCertificat} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: uploadingCertificat ? 'not-allowed' : 'pointer', opacity: uploadingCertificat ? 0.7 : 1 }}>
              {uploadingCertificat ? '⏳ Envoi en cours...' : '📤 Soumettre mon certificat'}
            </button>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>Formats acceptés : PDF, JPG, PNG (max 10 Mo)</p>
            {certificatMessage && (
              <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '8px', backgroundColor: certificatMessage.type === 'success' ? '#d1fae5' : '#fef2f2', color: certificatMessage.type === 'success' ? '#065f46' : '#dc2626', fontSize: '14px' }}>
                {certificatMessage.text}
              </div>
            )}
          </div>
        )}

        {!loadingCertificats && certificats.length > 0 && (
        <div data-tour="deploiements" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: deploiementsActifs.length > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>
              {deploiementsActifs.length > 0 ? 'Sollicitation de déploiement' : 'Déploiements'}
            </h3>
            {deploiementsActifs.length > 0 && (
              <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                {deploiementsActifs.length} actif{deploiementsActifs.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {deploiementsActifs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(
                deploiementsActifs.reduce((groups: Record<string, DeploiementActif[]>, dep) => {
                  const key = dep.nom_sinistre || dep.nom_deploiement;
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(dep);
                  return groups;
                }, {})
              ).map(([sinistre, deps]) => (
                <div key={sinistre} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fafafa' }}>
                  <div style={{ padding: '16px 20px', backgroundColor: '#f0f4f8', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>🔥</span>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f' }}>{sinistre}</div>
                        {deps[0].type_incident && <div style={{ fontSize: '13px', color: '#6b7280' }}>{deps[0].type_incident}</div>}
                      </div>
                    </div>
                  </div>
                  {deps[0].date_debut && (
                    <div style={{ padding: '10px 20px', fontSize: '13px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                      📅 {formatDate(deps[0].date_debut)}{deps[0].date_fin && ` — ${formatDate(deps[0].date_fin)}`}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {deps.map((dep, idx) => (
                      <div key={dep.id} style={{ padding: '14px 20px', borderBottom: idx < deps.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '2px' }}>{dep.nom_deploiement}</div>
                          {dep.lieu && <div style={{ fontSize: '13px', color: '#6b7280' }}>📍 {dep.lieu}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', textAlign: 'center' }}>
                    <a href={genererLienDisponibilite(deps[0].deploiement_id)} style={{ padding: '12px 24px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', transition: 'background-color 0.2s', display: 'inline-block' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d4a6f'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e3a5f'}>
                      Soumettre mes disponibilités
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px 20px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              <p style={{ color: '#374151', margin: '0 0 8px 0', fontWeight: '500', fontSize: '15px' }}>Aucun appel en cours pour le moment</p>
              <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>Lorsqu&apos;un déploiement nécessitera votre profil, vous en serez informé ici.</p>
            </div>
          )}
        </div>
        )}

        {!loadingCamp && campStatus && !campStatus.is_certified && (
          <div data-tour="camp" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: campStatus.has_inscription ? '1px solid #10b981' : '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>Camp de qualification</h3>
              {campStatus.has_inscription && <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>Inscrit</span>}
            </div>
            {campStatus.has_inscription && campStatus.camp ? (
              <div>
                <div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>{campStatus.camp.nom}</div>
                  <div style={{ display: 'grid', gap: '6px', fontSize: '14px', color: '#4b5563' }}>
                    {campStatus.camp.dates && <div><strong>Dates :</strong> {campStatus.camp.dates}</div>}
                    {campStatus.camp.site && <div><strong>Site :</strong> {campStatus.camp.site}</div>}
                    {campStatus.camp.location && <div style={{ color: '#6b7280' }}>{campStatus.camp.location}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button onClick={openCampModal} style={{ padding: '10px 20px', backgroundColor: 'white', color: '#1e3a5f', border: '1px solid #1e3a5f', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1e3a5f'; e.currentTarget.style.color = 'white' }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#1e3a5f' }}>
                    Modifier mon inscription
                  </button>
                  <button onClick={handleCancelInscription} disabled={cancellingInscription} style={{ padding: '10px 20px', backgroundColor: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: cancellingInscription ? 'not-allowed' : 'pointer', opacity: cancellingInscription ? 0.7 : 1 }} onMouseOver={(e) => { if (!cancellingInscription) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' } }} onMouseOut={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280' }}>
                    {cancellingInscription ? 'Annulation...' : 'Je ne suis plus disponible'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>Pour devenir réserviste certifié, vous devez compléter un camp de qualification pratique.</p>
                <button onClick={openCampModal} style={{ padding: '12px 24px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d4a6f'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e3a5f'}>
                  S&apos;inscrire à un camp de qualification
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <a href="/profil" data-tour="profil" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>👤</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Mon Profil</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Consultez et mettez à jour vos informations</p>
            </div>
          </a>

          {isApproved && (
          <a href="/dossier" data-tour="dossier" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Mon dossier réserviste</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Compétences et certifications</p>
            </div>
          </a>
          )}

          {isApproved && ciblages.length > 0 && (
          <a href="/disponibilites" data-tour="disponibilites" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📅</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Mes Disponibilités</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Gérez vos disponibilités pour les déploiements</p>
            </div>
          </a>
          )}

          <a href="/tournee-camps" data-tour="tournee" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏕️</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Tournée des camps</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Calendrier des camps de qualification par région</p>
            </div>
          </a>

          <a href="/formation" data-tour="formation" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎓</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Formation et parcours</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Formation, certificats et camp de qualification</p>
            </div>
          </a>

          <a href="/informations" data-tour="informations" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📚</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Informations pratiques</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Documents, ressources et références utiles</p>
            </div>
          </a>

          <a href="/communaute" data-tour="communaute" style={{ textDecoration: 'none', position: 'relative' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', position: 'relative', display: 'inline-block' }}>
                💬
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-12px', backgroundColor: '#dc2626', color: 'white', fontSize: '11px', fontWeight: '700', borderRadius: '10px', padding: '2px 6px', minWidth: '20px', textAlign: 'center' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Communauté</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Échangez avec les réservistes</p>
            </div>
          </a>
        </div>
      </main>

      <GuidedTour
        isApproved={isApproved}
        hasCertificat={certificats.length > 0}
        hasDeploiements={deploiementsActifs.length > 0}
        hasCiblages={ciblages.length > 0}
        forceStart={showTour}
        onTourEnd={() => setShowTour(false)}
      />

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
