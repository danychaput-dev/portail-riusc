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
import CampInfoBlocs from './components/CampInfoBlocs'
import { n8nUrl } from '@/utils/n8n'
import { getCampsSessionsActifs } from './_data/camps-sessions'
import type {
  Reserviste, DeploiementActif, CampStatus,
  SessionCamp, SelectionStatus, MobilisationVague, CertificatFile,
} from '@/types'
import {
  DEMO_RESERVISTE_INTERET, DEMO_RESERVISTE_APPROUVE, DEMO_DEPLOIEMENTS,
  DEMO_CAMP_STATUS, DEMO_CAMP_STATUS_INSCRIT, DEMO_CERTIFICATS,
  DEMO_SELECTION_APPROUVE, DEMO_SESSIONS, DEMO_SESSION_CAPACITIES,
} from './demo-data'

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
  const [hasSinitier, setHasSinitier] = useState(true) // true par défaut pour ne pas flasher
  const [uploadingCertificat, setUploadingCertificat] = useState(false)
  const [certificatMessage, setCertificatMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const certificatInputRef = useRef<HTMLInputElement>(null)
  
  const [mobilisationActuelle, setMobilisationActuelle] = useState<MobilisationVague | null>(null)
  const [confirmingMobilisation, setConfirmingMobilisation] = useState(false)
  const [mobilisationConfirmee, setMobilisationConfirmee] = useState(false)
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
  const [sessionCapacities, setSessionCapacities] = useState<Record<string, { inscrits: number; capacite: number; attente: number; attente_max: number; places_restantes: number; statut: string }>>({})
  
  const [showTour, setShowTour] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [showFormationBanner, setShowFormationBanner] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('formation_banner_dismissed') !== '1'
  })
  const [demoGroupe, setDemoGroupe] = useState<'Intérêt' | 'Approuvé'>('Intérêt')
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('tour=1')) {
      window.history.replaceState({}, '', '/')
      setTimeout(() => window.dispatchEvent(new Event('restart-guided-tour')), 800)
    }
  }, [])
  const supabase = createClient()
  
  const { user: authUser, loading: authLoading } = useAuth()

  const isApproved = reserviste?.groupe === 'Approuvé'

  // Fonction pour appliquer le mode démo selon le groupe
  const applyDemoData = (groupe: 'Intérêt' | 'Approuvé') => {
    const isApprouveDemo = groupe === 'Approuvé'
    const demoRes = isApprouveDemo ? DEMO_RESERVISTE_APPROUVE : DEMO_RESERVISTE_INTERET
    
    setUser({ id: 'demo_user', email: demoRes.email })
    setReserviste(demoRes)
    
    if (isApprouveDemo) {
      setHasSinitier(true)
      setCertificats(DEMO_CERTIFICATS)
      setDeploiementsActifs(DEMO_DEPLOIEMENTS)
      setCiblages(['demo-dep-1'])
      setCampStatus(DEMO_CAMP_STATUS_INSCRIT)
      setSelectionStatus(DEMO_SELECTION_APPROUVE)
    } else {
      setHasSinitier(false)
      setCertificats([])
      setDeploiementsActifs([])
      setCiblages([])
      setCampStatus(DEMO_CAMP_STATUS)
      setSelectionStatus(null)
    }
    
    setLoadingCamp(false)
    setLoadingSelection(false)
    setLoadingCertificats(false)
    setUnreadCount(isApprouveDemo ? 3 : 0)
    setLoading(false)
  }

  // Toggle du mode démo
  const handleDemoToggle = () => {
    const newGroupe = demoGroupe === 'Intérêt' ? 'Approuvé' : 'Intérêt'
    setDemoGroupe(newGroupe)
    localStorage.setItem('demo_groupe', newGroupe)
    applyDemoData(newGroupe)
    // Forcer la visite guidée au changement de mode
    localStorage.removeItem('riusc-tour-new')
    localStorage.removeItem('riusc-tour-approved')
    setTimeout(() => setShowTour(true), 600)
  }

  const [demoToast, setDemoToast] = useState<string | null>(null)
  
  // Intercepter la navigation en mode démo (seulement mode Intérêt)
  const handleDemoNavClick = (e: React.MouseEvent, pageName: string) => {
    if (isDemoMode && demoGroupe === 'Intérêt') {
      e.preventDefault()
      setDemoToast(`📌 La page « ${pageName} » est disponible en mode Approuvé. Basculez avec le bouton en bas à droite.`)
      setTimeout(() => setDemoToast(null), 4000)
    }
    // En mode Approuvé → navigation normale
  }

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
      // Lecture certificats S'initier depuis formations_benevoles + Storage
      const { data: formations } = await supabase
        .from('formations_benevoles')
        .select('id, nom_formation, certificat_url, date_reussite')
        .eq('benevole_id', benevoleId)
        .not('certificat_url', 'is', null)
        .ilike('nom_formation', "%s'initier%")
        .is('deleted_at', null)

      if (formations && formations.length > 0) {
        const filesWithUrls = await Promise.all(
          formations.map(async (f: any) => {
            const { data: urlData } = await supabase.storage
              .from('certificats')
              .createSignedUrl(f.certificat_url, 3600) // URL valide 1h
            return {
              id: f.id,
              name: f.nom_formation || f.certificat_url.split('/').pop() || 'Certificat',
              url: urlData?.signedUrl || undefined,
            }
          })
        )
        setCertificats(filesWithUrls.filter((f: any) => f.url))
      } else {
        setCertificats([])
      }
    } catch (error) {
      console.error('Erreur fetch certificats:', error)
      setCertificats([])
    }
    setLoadingCertificats(false)
  }

  const checkSinitier = async (benevoleId: string) => {
    try {
      const { data } = await supabase
        .rpc('get_formations_by_benevole_id', { target_benevole_id: benevoleId })
      setHasSinitier(!!data && data.some((f: any) => f.nom_formation === "S'initier à la sécurité civile"))
    } catch (error) {
      console.error('Erreur check S\'initier:', error)
    }
  }

  const handleCertificatUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !reserviste) return

    // 🎯 Mode démo : simuler l'upload
    if (isDemoMode) {
      setCertificatMessage({ type: 'success', text: '✅ Mode démo — Certificat simulé avec succès !' })
      setTimeout(() => {
        setHasSinitier(true)
        setCertificats([{ id: 'demo-cert-1', name: file.name, url: '#' }])
        setCertificatMessage(null)
      }, 2000)
      return
    }

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
      // 1. Upload direct vers Supabase Storage (évite la limite 4.5MB de Vercel)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
      const uuid = crypto.randomUUID()
      const storagePath = `${reserviste.benevole_id}/${uuid}.${ext}`
      const { error: storageError } = await supabase.storage.from('certificats').upload(storagePath, file, { upsert: false })

      if (storageError) {
        setCertificatMessage({ type: 'error', text: "Erreur lors de l'envoi du fichier : " + storageError.message })
      } else {
        // 2. Appeler l'API route (service_role) pour mettre à jour la DB (contourne le RLS)
        const response = await fetch('/api/certificat/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            nom_complet: `${reserviste.nom} ${reserviste.prenom}`,
            storage_path: storagePath,
          })
        })

        const data = await response.json()

        if (data.success) {
          setCertificatMessage({ type: 'success', text: 'Certificat ajouté avec succès !' })
          await loadCertificats(reserviste.benevole_id)
          setHasSinitier(true)
        } else {
          setCertificatMessage({ type: 'error', text: data.error || "Erreur lors de la sauvegarde" })
        }
      }
    } catch (error: any) {
      console.error('Erreur upload certificat:', error)
      setCertificatMessage({ type: 'error', text: "Erreur lors de l'envoi : " + (error.message || 'Erreur inconnue') })
    }

    setUploadingCertificat(false)
    if (certificatInputRef.current) {
      certificatInputRef.current.value = ''
    }
  }


  // ─── Mobilisation — remplace le webhook n8n/Monday ──────────────────────────
  // Requête directe Supabase : ciblages → vagues → deployments
  const loadMobilisationStatus = async (benevole_id: string): Promise<MobilisationVague | null> => {
    try {
      // Étape 1 : ciblage actif (notifie ou mobilise) au niveau rotation
      const { data: ciblage } = await supabase
        .from('ciblages')
        .select('id, statut, reference_id')
        .eq('benevole_id', benevole_id)
        .eq('niveau', 'rotation')
        .in('statut', ['notifie', 'mobilise'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!ciblage?.reference_id) return null

      // Étape 2 : détails de la vague
      const { data: vague } = await supabase
        .from('vagues')
        .select('id, identifiant, date_debut, date_fin, deployment_id')
        .eq('id', ciblage.reference_id)
        .maybeSingle()

      if (!vague) return null

      // Étape 3 : détails du déploiement
      const { data: deployment } = await supabase
        .from('deployments')
        .select('id, nom, lieu')
        .eq('id', vague.deployment_id)
        .maybeSingle()

      return {
        mobilisation_item_id: ciblage.id,
        vague_id: vague.identifiant || '',
        deploiement_nom: deployment?.nom || '',
        tache: deployment?.nom || '',
        ville: deployment?.lieu || '',
        date_debut: vague.date_debut,
        date_fin: vague.date_fin,
        horaire: null,
        statut_confirmation: ciblage.statut === 'mobilise' ? 'Confirmé' : 'En attente',
      }
    } catch (e) {
      console.log('Erreur loadMobilisationStatus:', e)
      return null
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
            const [campFormResult, selectionResult, certResult, ciblagesResult, sinitierResult, mobilisationResult, campInscResult] = await Promise.allSettled([
              supabase.rpc('get_formations_by_benevole_id', { target_benevole_id: bid }),
              fetch(n8nUrl(`/webhook/selection-status?benevole_id=${bid}`)).then(r => r.ok ? r.json() : null),
              loadCertificats(bid),
              supabase.rpc('get_ciblages_by_benevole_id', { target_benevole_id: bid }),
              checkSinitier(bid),
              loadMobilisationStatus(bid),
              supabase.from('inscriptions_camps').select('session_id, camp_nom, camp_dates, camp_lieu').eq('benevole_id', bid).neq('presence', 'annule').order('created_at', { ascending: false }).limit(1).maybeSingle()
            ])

            // Camp status — détecté à partir des formations RPC (bypass RLS)
            const campForms = campFormResult.status === 'fulfilled' ? campFormResult.value?.data : null
            const hasCampQualif = (campForms || []).some((f: any) =>
              (f.nom_formation || '').toLowerCase().includes('camp de qualification') && f.resultat === 'Réussi'
            )
            const campInsc = campInscResult.status === 'fulfilled' ? campInscResult.value?.data : null
            if (campInsc) {
              setCampStatus({ is_certified: hasCampQualif, has_inscription: true, session_id: campInsc.session_id, camp: { nom: campInsc.camp_nom || '', dates: campInsc.camp_dates || '', site: campInsc.camp_lieu || '', location: campInsc.camp_lieu || '' }, lien_inscription: null })
            } else {
              setCampStatus({ is_certified: hasCampQualif, has_inscription: false, session_id: null, camp: null, lien_inscription: null })
            }
            setLoadingCamp(false)

            // Selection status
            if (selectionResult.status === 'fulfilled' && selectionResult.value?.statut) {
              setSelectionStatus(selectionResult.value)
            } else {
              setSelectionStatus(null)
            }
            setLoadingSelection(false)

            // Ciblages + deploiements (nouveau système portail)
            if (ciblagesResult.status === 'fulfilled') {
              const ciblagesData = ciblagesResult.value?.data
              if (ciblagesData && ciblagesData.length > 0) {
                const deployIds = ciblagesData.map((c: any) => c.deploiement_id).filter(Boolean)
                setCiblages(deployIds)
                const { data: deploiements } = await supabase
                  .from('deployments')
                  .select('id, identifiant, nom, lieu, date_debut, date_fin, statut')
                  .in('id', deployIds)
                if (deploiements) {
                  setDeploiementsActifs(deploiements.map((d: any) => ({
                    id: d.id,
                    deploiement_id: d.id,
                    nom_deploiement: d.nom,
                    nom_sinistre: undefined,
                    lieu: d.lieu,
                    date_debut: d.date_debut,
                    date_fin: d.date_fin,
                    statut: d.statut,
                  })))
                }
              }
            }

            // Mobilisation
            if (mobilisationResult.status === 'fulfilled' && (mobilisationResult.value as unknown as MobilisationVague)?.vague_id) {
              const mob = mobilisationResult.value as unknown as MobilisationVague
              setMobilisationActuelle(mob)
              setMobilisationConfirmee(mob.statut_confirmation === 'Confirmé')
            }
            
            logPageVisit('/')
            
            setLoading(false)
            return
          }
        }

        // 🎯 MODE DÉMO
        const demoMode = localStorage.getItem('demo_mode')
        if (demoMode === 'true') {
          console.log('🎯 Mode démo actif')
          setIsDemoMode(true)
          const savedGroupe = (localStorage.getItem('demo_groupe') || 'Intérêt') as 'Intérêt' | 'Approuvé'
          setDemoGroupe(savedGroupe)
          applyDemoData(savedGroupe)
          // Forcer la visite guidée en mode démo
          localStorage.removeItem('riusc-tour-new')
          localStorage.removeItem('riusc-tour-approved')
          setTimeout(() => setShowTour(true), 600)
          logPageVisit('/')
          return
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
            .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, role, consent_photos, allergies_alimentaires, allergies_autres')
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
           .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, role, consent_photos, allergies_alimentaires, allergies_autres')
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
            .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, role, consent_photos, allergies_alimentaires, allergies_autres')
            .eq('telephone', phoneDigits)
            .single()
          
          if (!data && phoneDigits.startsWith('1')) {
            const phoneWithout1 = phoneDigits.slice(1)
            const { data: data2 } = await supabase
              .from('reservistes')
              .select('benevole_id, prenom, nom, email, telephone, photo_url, groupe, role, consent_photos, allergies_alimentaires, allergies_autres')
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
        // Verification fiable du role via RPC dediee (contourne le cache PostgREST sur get_reserviste_by_benevole_id)
        const { data: roleFromDb } = await supabase.rpc('get_reserviste_role', { target_benevole_id: reservisteData.benevole_id })
        const actualRole = roleFromDb || reservisteData.role

        // Redirections par role — AVANT setReserviste pour eviter le flash
        if (['superadmin', 'admin', 'coordonnateur', 'adjoint'].includes(actualRole)) {
          router.push('/admin/reservistes')
          return
        }
        if (actualRole === 'partenaire' || actualRole === 'partenaire_lect') {
          router.push('/partenaire')
          return
        }

        setReserviste(reservisteData)
        
        // Charger tout en parallèle
        const bid = reservisteData.benevole_id
        const [campFormResult, selectionResult, certResult, ciblagesResult, sinitierResult, mobilisationResult, campInscResult] = await Promise.allSettled([
          supabase.rpc('get_formations_by_benevole_id', { target_benevole_id: bid }),
          fetch(n8nUrl(`/webhook/selection-status?benevole_id=${bid}`)).then(r => r.ok ? r.json() : null),
          loadCertificats(bid),
          supabase.rpc('get_ciblages_by_benevole_id', { target_benevole_id: bid }),
          checkSinitier(bid),
          loadMobilisationStatus(bid),
          supabase.from('inscriptions_camps').select('session_id, camp_nom, camp_dates, camp_lieu').eq('benevole_id', bid).neq('presence', 'annule').order('created_at', { ascending: false }).limit(1).maybeSingle()
        ])

        // Camp status — détecté à partir des formations RPC (bypass RLS)
        const campForms = campFormResult.status === 'fulfilled' ? campFormResult.value?.data : null
        const hasCampQualif = (campForms || []).some((f: any) =>
          (f.nom_formation || '').toLowerCase().includes('camp de qualification') && f.resultat === 'Réussi'
        )
        const campInsc = campInscResult.status === 'fulfilled' ? campInscResult.value?.data : null
        if (campInsc) {
          setCampStatus({ is_certified: hasCampQualif, has_inscription: true, session_id: campInsc.session_id, camp: { nom: campInsc.camp_nom || '', dates: campInsc.camp_dates || '', site: campInsc.camp_lieu || '', location: campInsc.camp_lieu || '' }, lien_inscription: null })
        } else {
          setCampStatus({ is_certified: hasCampQualif, has_inscription: false, session_id: null, camp: null, lien_inscription: null })
        }
        setLoadingCamp(false)

        // Selection status
        if (selectionResult.status === 'fulfilled' && selectionResult.value?.statut) {
          setSelectionStatus(selectionResult.value)
        } else {
          setSelectionStatus(null)
        }
        setLoadingSelection(false)

        // Ciblages + deploiements (nouveau système portail)
        if (ciblagesResult.status === 'fulfilled') {
          const ciblagesData = ciblagesResult.value?.data
          if (ciblagesData && ciblagesData.length > 0) {
            const deployIds = ciblagesData.map((c: any) => c.deploiement_id).filter(Boolean)
            setCiblages(deployIds)
            const { data: deploiements } = await supabase
              .from('deployments')
              .select('id, identifiant, nom, lieu, date_debut, date_fin, statut')
              .in('id', deployIds)
            if (deploiements) {
              setDeploiementsActifs(deploiements.map((d: any) => ({
                id: d.id,
                deploiement_id: d.id,
                nom_deploiement: d.nom,
                nom_sinistre: undefined,
                lieu: d.lieu,
                date_debut: d.date_debut,
                date_fin: d.date_fin,
                statut: d.statut,
              })))
            }
          }
        }

        // Mobilisation
        if (mobilisationResult.status === 'fulfilled' && (mobilisationResult.value as unknown as MobilisationVague)?.vague_id) {
          const mob = mobilisationResult.value as unknown as MobilisationVague
          setMobilisationActuelle(mob)
          setMobilisationConfirmee(mob.statut_confirmation === 'Confirmé')
        }
      }
      
      // Vérifier les messages non lus (seulement pour auth normale, pas pour emprunt)
      if ('id' in user && user.id) {
        const { data: lastSeen } = await supabase
          .from('community_last_seen')
          .select('last_seen_at')
          .eq('user_id', user.id)
          .maybeSingle()

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
      // 🎯 Nettoyer mode démo
      localStorage.removeItem('demo_mode')
      localStorage.removeItem('demo_groupe')
    }
    
    await supabase.auth.signOut()
    router.push('/login')
  }

  const openCampModal = async () => {
    setShowCampModal(true)
    setLoadingSessions(true)
    setInscriptionError(null)
    setInscriptionSuccess(false)
    setSelectedSessionId(campStatus?.session_id || '')

    // 🎯 Mode démo : données fictives pour les sessions
    if (isDemoMode) {
      setAllergiesAlimentaires('')
      setAutresAllergies('')
      setConditionsMedicales('')
      setConsentementPhoto(false)
      setLoadingDossier(false)
      setSessionsDisponibles(DEMO_SESSIONS)
      setSessionCapacities(DEMO_SESSION_CAPACITIES)
      setLoadingSessions(false)
      return
    }
    
    // Charger les données du dossier depuis Supabase (réserviste déjà en mémoire ou requête directe)
    if (reserviste?.benevole_id) {
      setLoadingDossier(true)
      try {
        const { data: dossierData } = await supabase
          .from('reservistes')
          .select('allergies_alimentaires, allergies_autres, problemes_sante')
          .eq('benevole_id', reserviste.benevole_id)
          .single()
        if (dossierData) {
          setAllergiesAlimentaires(dossierData.allergies_alimentaires || '')
          setAutresAllergies(dossierData.allergies_autres || '')
          setConditionsMedicales(dossierData.problemes_sante || '')
        }
      } catch (error) {
        console.error('Erreur chargement dossier:', error)
      }
      setLoadingDossier(false)
    }

    setConsentementPhoto(reserviste?.consent_photos || false)

    // Charger les sessions depuis la liste statique partagée (source de vérité)
    try {
      setSessionsDisponibles(getCampsSessionsActifs())

      // Charger les capacités via notre API server-side (bypass RLS + CORS)
      // Retourne { session_id: count } — on le transforme vers la structure attendue par l'UI
      const capacityResp = await fetch('/api/camp/capacity').catch(() => null)
      if (capacityResp && capacityResp.ok) {
        const counts: Record<string, number> = await capacityResp.json()
        const CAPACITE_MAX = 80
        const ATTENTE_MAX = 10
        const capacities: Record<string, { inscrits: number; capacite: number; attente: number; attente_max: number; places_restantes: number; statut: string }> = {}
        for (const [session_id, count] of Object.entries(counts)) {
          const inscrits = Math.min(count, CAPACITE_MAX)
          const attente = Math.max(0, count - CAPACITE_MAX)
          const places_restantes = Math.max(0, CAPACITE_MAX - count)
          let statut: string
          if (attente >= ATTENTE_MAX) statut = 'complet'
          else if (places_restantes === 0) statut = 'liste_attente'
          else statut = 'ouvert'
          capacities[session_id] = {
            inscrits,
            capacite: CAPACITE_MAX,
            attente,
            attente_max: ATTENTE_MAX,
            places_restantes,
            statut,
          }
        }
        setSessionCapacities(capacities)
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

    // 🎯 Mode démo : simuler l'inscription
    if (isDemoMode) {
      setInscriptionLoading(true)
      setTimeout(() => {
        setInscriptionSuccess(true)
        setInscriptionLoading(false)
        const selectedSession = sessionsDisponibles.find(s => s.session_id === selectedSessionId)
        setTimeout(() => {
          closeCampModal()
          if (selectedSession) {
            setCampStatus({
              is_certified: false,
              has_inscription: true,
              session_id: selectedSessionId,
              camp: { nom: selectedSession.nom, dates: selectedSession.dates, site: selectedSession.site, location: selectedSession.location },
              lien_inscription: null,
            })
          }
        }, 2000)
      }, 1000)
      return
    }
    
    setInscriptionLoading(true)
    setInscriptionError(null)
    
    try {
      // Sauvegarder les allergies dans Supabase en parallèle (fire-and-forget)
      supabase.from('reservistes').update({
        allergies_alimentaires: allergiesAlimentaires || null,
        allergies_autres: autresAllergies || null,
        problemes_sante: conditionsMedicales || null,
      }).eq('benevole_id', reserviste.benevole_id)

      const capInfo = sessionCapacities[selectedSessionId]
      const inscriptionStatut = capInfo?.statut === 'liste_attente' ? 'Liste d\'attente' : 'Inscrit'
      
      const response = await fetch('/api/camp/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          session_id: selectedSessionId,
          presence: 'confirme',
          statut: inscriptionStatut,
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

    // 🎯 Mode démo : simuler l'annulation
    if (isDemoMode) {
      setCampStatus(DEMO_CAMP_STATUS)
      return
    }
    
    setCancellingInscription(true)
    
    try {
      const response = await fetch(
        n8nUrl(`/webhook/camp-status?benevole_id=${reserviste.benevole_id}&action=cancel`),
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', paddingTop: isDemoMode ? '36px' : 0 }}>
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

                <CampInfoBlocs />

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
                      {sessionsDisponibles.filter(session => session.session_id !== campStatus?.session_id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr-CA', { numeric: true })).map((session) => {
                        const cap = sessionCapacities[session.session_id]
                        const isComplet = cap?.statut === 'complet'
                        const isAttente = cap?.statut === 'liste_attente'
                        const isDisabled = isComplet
                        
                        return (
                        <label key={session.session_id} style={{ display: 'block', padding: '16px', border: isDisabled ? '1px solid #e5e7eb' : selectedSessionId === session.session_id ? '2px solid #1e3a5f' : '1px solid #e5e7eb', borderRadius: '8px', cursor: isDisabled ? 'not-allowed' : 'pointer', backgroundColor: isDisabled ? '#f9fafb' : selectedSessionId === session.session_id ? '#f0f4f8' : 'white', opacity: isDisabled ? 0.6 : 1, transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <input type="radio" name="session" value={session.session_id} checked={selectedSessionId === session.session_id} onChange={(e) => !isDisabled && setSelectedSessionId(e.target.value)} disabled={isDisabled} style={{ marginTop: '4px' }} />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                <span style={{ fontWeight: '600', color: isDisabled ? '#9ca3af' : '#111827' }}>{session.nom}</span>
                                {isComplet && (
                                  <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Complet</span>
                                )}
                                {isAttente && (
                                  <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Liste d&apos;attente</span>
                                )}
                                {cap && !isComplet && !isAttente && cap.places_restantes <= 20 && (
                                  <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Places limitées - {cap.places_restantes} restante{cap.places_restantes > 1 ? 's' : ''}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                                {session.dates && <div>{session.dates}</div>}
                                {session.site && <div>{session.site}</div>}
                                {session.location && <div style={{ color: '#9ca3af' }}>{session.location}</div>}
                              </div>
                            </div>
                          </div>
                        </label>
                        )
                      })}
                    </div>
                  )}
                </div>
                {inscriptionError && <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{inscriptionError}</div>}

                {/* Avertissement liste d'attente */}
                {selectedSessionId && sessionCapacities[selectedSessionId]?.statut === 'liste_attente' && (
                  <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>⏳</span>
                    <div style={{ fontSize: '14px', color: '#92400e', lineHeight: '1.5' }}>
                      <strong>Ce camp est complet.</strong> Votre inscription sera placée sur la liste d&apos;attente. Vous serez contacté si une place se libère.
                    </div>
                  </div>
                )}

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
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {campStatus?.has_inscription && (
                    <button onClick={() => { closeCampModal(); handleCancelInscription() }} disabled={inscriptionLoading || cancellingInscription} style={{ padding: '12px 24px', backgroundColor: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '14px', cursor: (inscriptionLoading || cancellingInscription) ? 'not-allowed' : 'pointer', fontWeight: '500', marginRight: 'auto' }}>
                      {cancellingInscription ? 'Annulation...' : 'Je ne suis plus disponible'}
                    </button>
                  )}
                  <button onClick={closeCampModal} disabled={inscriptionLoading} style={{ padding: '12px 24px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: inscriptionLoading ? 'not-allowed' : 'pointer', fontWeight: '500' }}>Annuler</button>
                  <button onClick={handleSubmitInscription} disabled={inscriptionLoading || !selectedSessionId || loadingSessions} style={{ padding: '12px 24px', backgroundColor: (inscriptionLoading || !selectedSessionId) ? '#9ca3af' : sessionCapacities[selectedSessionId]?.statut === 'liste_attente' ? '#d97706' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: (inscriptionLoading || !selectedSessionId) ? 'not-allowed' : 'pointer' }}>
                    {inscriptionLoading ? 'Traitement...' : sessionCapacities[selectedSessionId]?.statut === 'liste_attente' ? "S'inscrire sur la liste d'attente" : campStatus?.has_inscription ? 'Confirmer la modification' : "Confirmer mon inscription"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <PortailHeader subtitle="Réserve d'Intervention d'Urgence" />

      {showFormationBanner && (
        <div style={{ backgroundColor: '#1e3a5f', borderBottom: '3px solid #ffd166', padding: '12px 24px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>🎓</span>
              <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: '500' }}>
                <strong style={{ color: '#ffd166' }}>Nouveau !</strong> Les formations en ligne sont maintenant disponibles sur le portail.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <a href="/formations-en-ligne" style={{ backgroundColor: '#ffd166', color: '#1e3a5f', textDecoration: 'none', fontSize: '13px', fontWeight: '700', padding: '7px 16px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                Découvrir →
              </a>
              <button onClick={() => { setShowFormationBanner(false); localStorage.setItem('formation_banner_dismissed', '1') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '20px', lineHeight: '1', padding: '0 4px' }}>
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <div data-tour="welcome" style={{ backgroundColor: '#1e3a5f', padding: '28px 32px', borderRadius: '12px', marginBottom: '28px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '100%', background: 'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.05) 100%)', pointerEvents: 'none' }} />
          <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: '700' }}>
            Bienvenue sur la plateforme du réserviste{reserviste ? `, ${reserviste.prenom}` : ''} !
          </h2>
          <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', opacity: 0.9 }}>
            Votre espace unique où vous trouverez toutes les informations pertinentes pour votre rôle
            au sein de la Réserve d&apos;intervention d&apos;urgence en sécurité civile. Consultez vos documents,
            gérez vos inscriptions et restez informé des prochains événements.
          </p>
        </div>

        {!hasSinitier && !loadingCertificats && (
          <div style={{ backgroundColor: 'white', border: '2px solid #f59e0b', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
              Formation et certificats
            </h3>
            
            <div data-tour="certificats" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
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
                    <a href="https://campusnotredamedefoy.centrerisc.com/Web/MyCatalog/ViewP?pid=94b7f%2bJXTOIEwqbEfBzzBw%3d%3d&id=fkpM7dqJ0YA0hLjtTwfqvg%3d%3d" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
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
        <div data-tour="deploiements" style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: mobilisationActuelle ? '2px solid #059669' : deploiementsActifs.length > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ color: '#1e3a5f', margin: 0, fontSize: '18px', fontWeight: '600' }}>
              {mobilisationActuelle ? 'Mobilisation en cours' : deploiementsActifs.length > 0 ? 'Sollicitation de déploiement' : 'Déploiements'}
            </h3>
            {mobilisationActuelle && (
              <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                🚨 Mobilisé
              </span>
            )}
            {!mobilisationActuelle && deploiementsActifs.length > 0 && (
              <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                {deploiementsActifs.length} actif{deploiementsActifs.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {mobilisationActuelle ? (
            // === ÉTAT MOBILISÉ ===
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '24px' }}>🚨</span>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#065f46' }}>
                      {mobilisationActuelle.vague_id} — {mobilisationActuelle.tache}
                    </div>
                    <div style={{ fontSize: '13px', color: '#047857' }}>📍 {mobilisationActuelle.ville}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: '#047857' }}>
                  <div>
                    <strong>📅 Départ :</strong>{' '}
                    {mobilisationActuelle.date_debut}
                    {mobilisationActuelle.date_fin ? ` au ${mobilisationActuelle.date_fin}` : ''}
                  </div>
                  {mobilisationActuelle.horaire && (
                    <div><strong>🕐 Horaire :</strong> {mobilisationActuelle.horaire}</div>
                  )}
                </div>
              </div>

              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#92400e', fontSize: '14px' }}>⚠️ Action requise</p>
                <p style={{ margin: 0, color: '#78350f', fontSize: '13px', lineHeight: '1.6' }}>
                  Veuillez prendre connaissance de votre assignation et confirmer que vous avez bien lu et compris les directives.
                  Si vous avez des questions, utilisez le chat communautaire.
                </p>
              </div>

              {mobilisationConfirmee ? (
                <div style={{ backgroundColor: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '20px' }}>✅</span>
                  <p style={{ margin: '8px 0 0 0', fontWeight: '600', color: '#065f46', fontSize: '14px' }}>
                    Assignation confirmée — merci !
                  </p>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setConfirmingMobilisation(true)
                    try {
                      await fetch(n8nUrl('/webhook/confirmer-mobilisation'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          mobilisation_item_id: mobilisationActuelle.mobilisation_item_id,
                          benevole_id: reserviste?.benevole_id
                        })
                      })
                      setMobilisationConfirmee(true)
                    } catch (e) {
                      console.error('Erreur confirmation:', e)
                    }
                    setConfirmingMobilisation(false)
                  }}
                  disabled={confirmingMobilisation}
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: confirmingMobilisation ? '#9ca3af' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: confirmingMobilisation ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => { if (!confirmingMobilisation) e.currentTarget.style.backgroundColor = '#047857' }}
                  onMouseOut={(e) => { if (!confirmingMobilisation) e.currentTarget.style.backgroundColor = '#059669' }}
                >
                  {confirmingMobilisation ? 'Confirmation en cours...' : '✅ J\'ai lu et compris mes directives de déploiement'}
                </button>
              )}
            </div>
          ) : deploiementsActifs.length > 0 ? (
            // === ÉTAT CIBLAGE (disponibilités) ===
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
                    <a href={genererLienDisponibilite(deps[0].deploiement_id)} onClick={(e) => handleDemoNavClick(e, 'Soumettre mes disponibilités')} style={{ padding: '12px 24px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '600', transition: 'background-color 0.2s', display: 'inline-block' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d4a6f'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e3a5f'}>
                      Soumettre mes disponibilités
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // === AUCUN APPEL ===
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
          <a href="/disponibilites" data-tour="disponibilites" style={{ textDecoration: 'none' }} onClick={(e) => handleDemoNavClick(e, 'Mes Disponibilités')}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📅</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Mes Disponibilités</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Gérez vos disponibilités pour les déploiements</p>
            </div>
          </a>
          )}

          <a href="/formation" data-tour="formation" style={{ textDecoration: 'none' }} onClick={(e) => handleDemoNavClick(e, 'Formation et parcours')}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎓</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Formation et parcours</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Formation, certificats et camp de qualification</p>
            </div>
          </a>

          <a href="/informations" data-tour="informations" style={{ textDecoration: 'none' }} onClick={(e) => handleDemoNavClick(e, 'Informations pratiques')}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid transparent' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#1e3a5f' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'transparent' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📚</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>Informations pratiques</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Documents, ressources et références utiles</p>
            </div>
          </a>

          <a href="/communaute" data-tour="communaute" style={{ textDecoration: 'none', position: 'relative' }} onClick={(e) => handleDemoNavClick(e, 'Communauté')}>
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

      {/* 🎯 DEMO MODE - Bandeau informatif */}
      {isDemoMode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#7c3aed',
          color: 'white',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: '500',
          textAlign: 'center',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}>
          <span>🎯 Mode démonstration — Données fictives</span>
          <span style={{ opacity: 0.7 }}>|</span>
          <span>Profil actuel : <strong>{demoGroupe === 'Intérêt' ? 'Nouveau réserviste (Intérêt)' : 'Réserviste approuvé'}</strong></span>
        </div>
      )}

      {/* 🎯 DEMO MODE - Bouton flottant pour basculer */}
      {isDemoMode && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '10px',
        }}>
          <button
            onClick={handleDemoToggle}
            style={{
              padding: '14px 24px',
              backgroundColor: demoGroupe === 'Intérêt' ? '#059669' : '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {demoGroupe === 'Intérêt' ? (
              <>🔄 Voir en mode Approuvé</>
            ) : (
              <>🔄 Voir en mode Intérêt</>
            )}
          </button>
          <button
            onClick={handleSignOut}
            style={{
              padding: '10px 18px',
              backgroundColor: 'white',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '50px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            Quitter la démo
          </button>
        </div>
      )}

      {/* 🎯 DEMO Toast */}
      {demoToast && (
        <div style={{
          position: 'fixed',
          top: isDemoMode ? '48px' : '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1e3a5f',
          color: 'white',
          padding: '14px 24px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 10000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          maxWidth: '500px',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {demoToast}
        </div>
      )}

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
