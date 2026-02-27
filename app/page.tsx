'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import GuidedTour from './components/GuidedTour'
import { useAuth } from '@/utils/useAuth'
import ImpersonateBanner from './components/ImpersonateBanner'
import PortailHeader from './components/PortailHeader'
import { logEvent, logPageVisit } from '@/utils/logEvent'

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

interface SelectionStatus {
  statut: 'Sélectionné' | 'Non sélectionné' | 'En attente' | null;
  deploiement: {
    nom: string;
    lieu: string;
    date_depart: string;
    heure_rassemblement: string;
    point_rassemblement: string;
    duree: string;
    consignes: string[];
  } | null;
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
  const [selectionStatus, setSelectionStatus] = useState<SelectionStatus | null>(null)
  const [loadingSelection, setLoadingSelection] = useState(true)
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
  
  const { user: authUser, loading: authLoading } = useAuth()

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

  // Détecter les paramètres URL pour ouvrir automatiquement la modal d'inscription au camp
  useEffect(() => {
    if (typeof window !== 'undefined' && reserviste) {
      const params = new URLSearchParams(window.location.search)
      const shouldOpenModal = params.get('openCampModal')
      const campParam = params.get('camp')
      
      if (shouldOpenModal === 'true' && campParam) {
        // Attendre un peu que les données soient chargées
        setTimeout(() => {
          openCampModal()
        }, 500)
        
        // Nettoyer l'URL pour éviter de réouvrir la modal à chaque refresh
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [reserviste])

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
      // 🔧 SUPPORT MODE DEBUG
      if (typeof window !== 'undefined') {
        const debugMode = localStorage.getItem('debug_mode')
        if (debugMode === 'true') {
          const debugUser = localStorage.getItem('debug_user')
          if (debugUser) {
            const userData = JSON.parse(debugUser)
            console.log('🔧 Mode debug actif - Utilisateur:', userData.email)
            
            setUser({ id: `debug_${userData.benevole_id}`, email: userData.email })
            
            // Charger le profil complet depuis Supabase (RPC = SECURITY DEFINER, pas besoin de session)
            const { data: rpcData } = await supabase.rpc('get_reserviste_by_benevole_id', { target_benevole_id: userData.benevole_id })
            const fullReserviste = rpcData?.[0] || userData
            setReserviste(fullReserviste)
            
            // Charger tout en parallèle
            const bid = userData.benevole_id
            const [campResult, selectionResult, certResult, ciblagesResult] = await Promise.allSettled([
              fetch(`https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${bid}`).then(r => r.ok ? r.json() : null),
              fetch(`https://n8n.aqbrs.ca/webhook/selection-status?benevole_id=${bid}`).then(r => r.ok ? r.json() : null),
              loadCertificats(bid),
              supabase.from('ciblages').select('deploiement_id').eq('benevole_id', bid)
            ])

            // Camp status
            if (campResult.status === 'fulfilled' && campResult.value) {
              setCampStatus(campResult.value)
            }
            setLoadingCamp(false)

            // Selection status
            if (selectionResult.status === 'fulfilled' && selectionResult.value?.statut) {
              setSelectionStatus(selectionResult.value)
            } else {
              setSelectionStatus(null)
            }
            setLoadingSelection(false)

            // Ciblages + deploiements
            if (ciblagesResult.status === 'fulfilled') {
              const ciblagesData = ciblagesResult.value?.data
              if (ciblagesData && ciblagesData.length > 0) {
                const deployIds = ciblagesData.map((c: any) => c.deploiement_id)
                setCiblages(deployIds)
                const { data: deploiements } = await supabase
                  .from('deploiements_actifs')
                  .select('*')
                  .in('deploiement_id', deployIds)
                  .order('date_debut', { ascending: true })
                if (deploiements) setDeploiementsActifs(deploiements)
              }
            }
            
            logPageVisit('/')
            
            setLoading(false)
            return
          }
        }
      }

  // Attendre le chargement de l'auth
      if (authLoading) {
        return  // Le loading de la page reste true pendant que l'auth charge
      }
      if (!authUser) {
        router.push('/login')
        return
      }

      // Gérer les deux cas : auth normale ou emprunt
      let user = authUser
      let reservisteData = null

      // CAS 1 : Emprunt d'identité actif (via fonction sécurisée)
      if ('isImpersonated' in authUser && authUser.isImpersonated) {
        const { data: rpcData } = await supabase
          .rpc('get_reserviste_by_benevole_id', { target_benevole_id: authUser.benevole_id })
        
        if (rpcData?.[0]) {
          reservisteData = rpcData[0]
        }
      } else {
        // CAS 2 : Auth normale - utiliser la logique existante
        setUser(authUser)
      
        // 1. D'abord chercher par user_id (le plus fiable)
        if ('id' in authUser) {
          const { data: dataByUserId } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, consent_photos, allergies_alimentaires, allergies_autres')
            .eq('user_id', authUser.id)
            .single()
          
          if (dataByUserId) {
            reservisteData = dataByUserId
          }
        }
        
        // 2. Sinon chercher par email
        if (!reservisteData && 'email' in authUser && authUser.email) {
          const { data } = await supabase
            .from('reservistes')
           .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, consent_photos, allergies_alimentaires, allergies_autres')
            .ilike('email', authUser.email)
            .single()
          
          // Si trouvé, mettre à jour le user_id pour la prochaine fois
          if (data && 'id' in authUser) {
            await supabase
              .from('reservistes')
              .update({ user_id: authUser.id })
              .eq('benevole_id', data.benevole_id)
            reservisteData = data
          }
        }
        
        // 3. Sinon chercher par téléphone
        if (!reservisteData && 'phone' in authUser && authUser.phone) {
          const phoneDigits = authUser.phone.replace(/\D/g, '')
          const { data } = await supabase
            .from('reservistes')
            .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, consent_photos, allergies_alimentaires, allergies_autres')
            .eq('telephone', phoneDigits)
            .single()
          
          if (!data && phoneDigits.startsWith('1')) {
            const phoneWithout1 = phoneDigits.slice(1)
            const { data: data2 } = await supabase
              .from('reservistes')
              .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, consent_photos, allergies_alimentaires, allergies_autres')
              .eq('telephone', phoneWithout1)
              .single()
            
            if (data2 && 'id' in authUser) {
              await supabase
                .from('reservistes')
                .update({ user_id: authUser.id })
                .eq('benevole_id', data2.benevole_id)
              reservisteData = data2
            }
          } else if (data && 'id' in authUser) {
            await supabase
              .from('reservistes')
              .update({ user_id: authUser.id })
              .eq('benevole_id', data.benevole_id)
            reservisteData = data
          }
        }
      } // Fin du else (auth normale)
      
      if (reservisteData) {
        setReserviste(reservisteData)
        
        // Charger tout en parallèle
        const bid = reservisteData.benevole_id
        const [campResult, selectionResult, certResult, ciblagesResult] = await Promise.allSettled([
          fetch(`https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${bid}`).then(r => r.ok ? r.json() : null),
          fetch(`https://n8n.aqbrs.ca/webhook/selection-status?benevole_id=${bid}`).then(r => r.ok ? r.json() : null),
          loadCertificats(bid),
          supabase.from('ciblages').select('deploiement_id').eq('benevole_id', bid)
        ])

        // Camp status
        if (campResult.status === 'fulfilled' && campResult.value) {
          setCampStatus(campResult.value)
        }
        setLoadingCamp(false)

        // Selection status
        if (selectionResult.status === 'fulfilled' && selectionResult.value?.statut) {
          setSelectionStatus(selectionResult.value)
        } else {
          setSelectionStatus(null)
        }
        setLoadingSelection(false)

        // Ciblages + deploiements
        if (ciblagesResult.status === 'fulfilled') {
          const ciblagesData = ciblagesResult.value?.data
          if (ciblagesData && ciblagesData.length > 0) {
            const deployIds = ciblagesData.map((c: any) => c.deploiement_id)
            setCiblages(deployIds)
            const { data: deploiements } = await supabase
              .from('deploiements_actifs')
              .select('*')
              .in('deploiement_id', deployIds)
              .order('date_debut', { ascending: true })
            if (deploiements) setDeploiementsActifs(deploiements)
          }
        }
      }
      
      // Vérifier les messages non lus (seulement pour auth normale, pas pour emprunt)
      if ('id' in user && user.id) {
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
      }

      logPageVisit('/')

      setLoading(false)
    }
    loadData()
   }, [authUser, authLoading])

  const handleSignOut = async () => {
    // Logger le logout AVANT de détruire la session
    await logEvent({ eventType: 'logout' })

    // 🔧 Nettoyer mode debug
    if (typeof window !== 'undefined') {
      localStorage.removeItem('debug_mode')
      localStorage.removeItem('debug_user')
      localStorage.removeItem('debug_email')
    }
    
    await supabase.auth.signOut()
    router.push('/login')
  }

  const openCampModal = async () => {
    setShowCampModal(true)
    setLoadingSessions(true)
    setInscriptionError(null)
    setInscriptionSuccess(false)
    setSelectedSessionId('')
    
    // Charger les données du dossier depuis Monday/n8n
    if (reserviste?.benevole_id) {
      setLoadingDossier(true)
      try {
        const dossierResponse = await fetch(`https://n8n.aqbrs.ca/webhook/riusc-get-dossier?benevole_id=${reserviste.benevole_id}`)
        if (dossierResponse.ok) {
          const dossierData = await dossierResponse.json()
          if (dossierData.success && dossierData.dossier) {
            setAllergiesAlimentaires(dossierData.dossier.allergies_alimentaires || '')
            setAutresAllergies(dossierData.dossier.allergies_autres || '')
            setConditionsMedicales(dossierData.dossier.problemes_sante || '')
          }
        }
      } catch (error) {
        console.error('Erreur chargement dossier:', error)
      }
      setLoadingDossier(false)
    }
    
    setConsentementPhoto(reserviste?.consent_photos || false)

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
          allergies_autres: autresAllergies || undefined
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

      <PortailHeader subtitle="Réserve d'Intervention d'Urgence" />

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

        {!isApproved && !loadingCertificats && certificats.length === 0 && (
          <div style={{ backgroundColor: 'white', border: '2px solid #f59e0b', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
              Formation et certificats
            </h3>
            
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

            <div style={{ marginBottom: '0' }}>
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
          </div>
        )}

        {/* Encadré sélection pour vague de déploiement - DÉPLACÉ EN HAUT */}
        {/* Encadré sélection pour vague de déploiement */}
        {!loadingSelection && selectionStatus && selectionStatus.statut && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '12px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            marginBottom: '24px', 
            border: selectionStatus.statut === 'Sélectionné' ? '2px solid #10b981' : selectionStatus.statut === 'En attente' ? '2px solid #f59e0b' : '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Statut de sélection
              </h3>
              <span style={{ 
                backgroundColor: selectionStatus.statut === 'Sélectionné' ? '#d1fae5' : selectionStatus.statut === 'En attente' ? '#fef3c7' : '#fee2e2', 
                color: selectionStatus.statut === 'Sélectionné' ? '#065f46' : selectionStatus.statut === 'En attente' ? '#92400e' : '#991b1b', 
                padding: '6px 14px', 
                borderRadius: '20px', 
                fontSize: '13px', 
                fontWeight: '600' 
              }}>
                {selectionStatus.statut === 'Sélectionné' ? '✅ Sélectionné' : selectionStatus.statut === 'En attente' ? '⏳ En attente' : '❌ Non sélectionné'}
              </span>
            </div>

            {selectionStatus.statut === 'Sélectionné' && selectionStatus.deploiement ? (
              <div>
                <div style={{ backgroundColor: '#ecfdf5', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#065f46', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🚨</span>
                    {selectionStatus.deploiement.nom}
                  </div>
                  <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: '#047857' }}>
                    <div><strong>📍 Lieu :</strong> {selectionStatus.deploiement.lieu}</div>
                    <div><strong>📅 Date de départ :</strong> {selectionStatus.deploiement.date_depart}</div>
                    <div><strong>⏰ Rassemblement :</strong> {selectionStatus.deploiement.heure_rassemblement}</div>
                    <div><strong>📍 Point de rassemblement :</strong> {selectionStatus.deploiement.point_rassemblement}</div>
                    <div><strong>⏱️ Durée estimée :</strong> {selectionStatus.deploiement.duree}</div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#fffbeb', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fcd34d' }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#92400e', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚠️</span>
                    Consignes importantes
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#78350f', fontSize: '14px', lineHeight: '1.7' }}>
                    {selectionStatus.deploiement.consignes.map((consigne, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>{consigne}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                  <a 
                    href="/informations" 
                    style={{ 
                      padding: '12px 24px', 
                      backgroundColor: '#1e3a5f', 
                      color: 'white', 
                      borderRadius: '8px', 
                      textDecoration: 'none', 
                      fontSize: '14px', 
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    🎒 Voir la liste du matériel à apporter
                  </a>
                </div>
              </div>
            ) : selectionStatus.statut === 'En attente' ? (
              <div style={{ padding: '30px 20px', backgroundColor: '#fffbeb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <p style={{ color: '#92400e', margin: '0 0 8px 0', fontWeight: '600', fontSize: '15px' }}>
                  Sélection en cours
                </p>
                <p style={{ color: '#78350f', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                  Ton profil est en cours d&apos;évaluation pour la prochaine vague de déploiement. 
                  Tu seras notifié dès qu&apos;une décision sera prise. Reste disponible !
                </p>
              </div>
            ) : (
              <div style={{ padding: '30px 20px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                <p style={{ color: '#374151', margin: '0 0 8px 0', fontWeight: '600', fontSize: '15px' }}>
                  Vague de déploiement complète
                </p>
                <p style={{ color: '#6b7280', margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.6' }}>
                  La vague de déploiement actuelle est complète. D&apos;autres vagues suivront dans les prochains jours.
                </p>
                <p style={{ color: '#1e3a5f', margin: 0, fontSize: '14px', lineHeight: '1.6', fontWeight: '500' }}>
                  ✅ Assure-toi que tes disponibilités sont à jour pour être considéré dans les prochaines vagues.
                </p>
              </div>
            )}
          </div>
        )}

        {isApproved && !loadingCertificats && (
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
          {isApproved && ciblages.length > 0 && (
          <a href="/disponibilites" data-tour="disponibilites" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📅</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Mes Disponibilités</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Gérez vos disponibilités pour les déploiements</p>
            </div>
          </a>
          )}

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

      <ImpersonateBanner />

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
