'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import ImageCropper from '@/app/components/ImageCropper'
import PortailHeader from '@/app/components/PortailHeader'
import { useAuth } from '@/utils/useAuth'
import ImpersonateBanner from '@/app/components/ImpersonateBanner'
import { logPageVisit } from '@/utils/logEvent'
import { isDemoActive, getDemoGroupe, DEMO_RESERVISTE, DEMO_USER } from '@/utils/demoMode'
import { n8nUrl } from '@/utils/n8n'
import type { Reserviste, Organisation, Langue, MapboxFeature, DossierData } from '@/types'
import { Section, TextInput, TextArea, Checkbox, CheckboxGroup } from './components'
import TrajetsTab from '@/app/dossier/TrajetsTab'
import HeuresTab from '@/app/dossier/HeuresTab'
import {
  MAPBOX_TOKEN, AQBRS_ORG_ID, LANGUES_EPINGLEES,
  GROUPES_SANGUIN, GROUPE_SANGUIN_MAP, GROUPE_SANGUIN_REVERSE,
  OPTIONS, CERT_REQUIRED_LABELS, REGIONS_QUEBEC, FSA_TO_REGION,
  detecterRegionParFSA, labelsToIds, idsToLabels,
  formatPhoneDisplay, cleanPhoneForSave, isValidNorthAmericanPhone, isOlderThan18,
} from './constants'

// ─── Wrapper Suspense (pour useSearchParams) ────────────────────────────────

export default function ProfilPageWrapper() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280' }}>Chargement...</div>}>
      <ProfilPage />
    </Suspense>
  )
}

// ─── Composant principal ────────────────────────────────────────────────────

function ProfilPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bidParam = searchParams.get('bid')
  const fromParam = searchParams.get('from')
  const tabParam = searchParams.get('tab')
  const supabase = createClient()

  // Onglet actif (lu depuis ?tab=trajets|heures, défaut 'dossier')
  const [activeTab, setActiveTab] = useState<'dossier' | 'trajets' | 'heures'>(
    tabParam === 'trajets' ? 'trajets' : tabParam === 'heures' ? 'heures' : 'dossier'
  )
  const switchTab = (t: 'dossier' | 'trajets' | 'heures') => {
    setActiveTab(t)
    const url = new URL(window.location.href)
    if (t === 'dossier') url.searchParams.delete('tab')
    else url.searchParams.set('tab', t)
    window.history.replaceState({}, '', url.toString())
  }

  // Hook d'authentification avec support emprunt
  const { user: authUser, loading: authLoading } = useAuth()

  // États généraux
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [isViewingOther, setIsViewingOther] = useState(false)
  const [loading, setLoading] = useState(true)

  // Protection section santé (quand admin consulte un autre réserviste)
  const [santeUnlocked, setSanteUnlocked] = useState(false)
  const [santeMdpInput, setSanteMdpInput] = useState('')
  const [santeMdpError, setSanteMdpError] = useState(false)
  const [santeMdpLoading, setSanteMdpLoading] = useState(false)

  const verifierMdpSante = async () => {
    setSanteMdpLoading(true)
    setSanteMdpError(false)
    try {
      const res = await fetch('/api/admin/verifier-mdp-sante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mot_de_passe: santeMdpInput }),
      })
      const json = await res.json()
      if (json.ok) {
        setSanteUnlocked(true)
      } else {
        setSanteMdpError(true)
      }
    } catch {
      setSanteMdpError(true)
    }
    setSanteMdpLoading(false)
  }
  const [saving, setSaving] = useState(false)
  const [testNotifLoading, setTestNotifLoading] = useState(false)
  const [testNotifResult, setTestNotifResult] = useState<'success' | 'error' | null>(null)
  const [showDemoTestModal, setShowDemoTestModal] = useState(false)
  const [demoTestEmail, setDemoTestEmail] = useState('')
  const [demoTestTel, setDemoTestTel] = useState('')
  const [formationDialog, setFormationDialog] = useState<{ show: boolean; removedLabels: string[]; addedLabels: string[]; pendingSave: (() => Promise<void>) | null }>({ show: false, removedLabels: [], addedLabels: [], pendingSave: null })
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [emailConfirm, setEmailConfirm] = useState('')
  const [emailConfirmError, setEmailConfirmError] = useState('')

  // États pour le dossier
  const [dossier, setDossier] = useState<DossierData>({
    prenom: '',
    nom: '',
    email: '',
    date_naissance: '',
    grandeur_bottes: '',
    profession: '',
    j_ai_18_ans: false,
    allergies_alimentaires: '',
    allergies_autres: '',
    problemes_sante: '',
    groupe_sanguin: '',
    competence_rs: [],
    certificat_premiers_soins: [],
    date_expiration_certificat: '',
    vehicule_tout_terrain: [],
    navire_marin: [],
    permis_conduire: [],
    disponible_covoiturage: [],
    satp_drone: [],
    equipe_canine: [],
    competences_securite: [],
    competences_sauvetage: [],
    certification_csi: [],
    communication: [],
    cartographie_sig: [],
    operation_urgence: [],
    experience_urgence_detail: '',
    autres_competences: '',
    commentaire: '',
    confidentialite: false,
    consentement_antecedents: false,
    preference_tache: 'aucune',
    preference_tache_commentaire: '',
    groupe_recherche: '',
  })
  const [originalDossier, setOriginalDossier] = useState<DossierData>(dossier)
  const [groupesRS, setGroupesRS] = useState<string[]>([])

  // États pour les champs Profil (Supabase)
  const [profilData, setProfilData] = useState({
    telephone: '',
    telephone_secondaire: '',
    adresse: '',
    ville: '',
    code_postal: '',
    region: '',
    latitude: null as number | null,
    longitude: null as number | null,
    contact_urgence_nom: '',
    contact_urgence_telephone: '',
    contact_urgence_lien: '',
    contact_urgence_courriel: '',
    methode_connexion: 'sms' as 'sms' | 'email',
  })
  const [originalProfilData, setOriginalProfilData] = useState(profilData)

  // États pour organisations et langues
  const [allOrgs, setAllOrgs] = useState<Organisation[]>([])
  const [myOrgIds, setMyOrgIds] = useState<string[]>([])
  const [newOrgIds, setNewOrgIds] = useState<string[]>([])
  const [newOrgName, setNewOrgName] = useState('')
  const [showNewOrgInput, setShowNewOrgInput] = useState(false)
  const [removedOrgIds, setRemovedOrgIds] = useState<string[]>([])

  const [allLangues, setAllLangues] = useState<Langue[]>([])
  const [myLangueIds, setMyLangueIds] = useState<string[]>([])
  const [newLangueIds, setNewLangueIds] = useState<string[]>([])
  const [newLangueName, setNewLangueName] = useState('')
  const [showNewLangueInput, setShowNewLangueInput] = useState(false)
  const [removedLangueIds, setRemovedLangueIds] = useState<string[]>([])

  // États pour autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<MapboxFeature[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const addressDropdownRef = useRef<HTMLDivElement>(null)

  const [villeSuggestions, setVilleSuggestions] = useState<Array<{ municipalite: string; region_administrative: string; mrc: string | null }>>([])
  const [showVilleSuggestions, setShowVilleSuggestions] = useState(false)
  const [isLoadingVille, setIsLoadingVille] = useState(false)
  const villeInputRef = useRef<HTMLInputElement>(null)
  const villeDropdownRef = useRef<HTMLDivElement>(null)
  const villeDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // État détection région
  const [regionNonDetectee, setRegionNonDetectee] = useState(false)

  // État pour la photo
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Détecter les changements
  const hasChanges = JSON.stringify(dossier) !== JSON.stringify(originalDossier)
  const profilHasChanges = JSON.stringify(profilData) !== JSON.stringify(originalProfilData)
  const orgHasChanges = newOrgIds.length > 0 || newOrgName.trim() !== '' || removedOrgIds.length > 0
  const langueHasChanges = newLangueIds.length > 0 || newLangueName.trim() !== '' || removedLangueIds.length > 0

  // ─── Chargement initial ──────────────────────────────────────────────────

 useEffect(() => {
    const loadData = async () => {
      // Attendre que l'auth soit chargée
      if (authLoading) return

      // 👁️ MODE ADMIN — consultation du profil d'un autre réserviste via ?bid=
      if (bidParam) {
        try {
          const res = await fetch(`/api/admin/reserviste-detail?bid=${bidParam}`)
          if (res.ok) {
            const json = await res.json()
            if (json.reserviste) {
              const d = json.reserviste
              setUser({ id: `admin_view_${d.benevole_id}`, email: d.email })
              setReserviste(d)
              setIsViewingOther(true)

              setProfilData({
                telephone: formatPhoneDisplay(d.telephone || ''),
                telephone_secondaire: formatPhoneDisplay(d.telephone_secondaire || ''),
                adresse: d.adresse || '',
                ville: d.ville || '',
                code_postal: d.code_postal || '',
                region: d.region || '',
                latitude: d.latitude || null,
                longitude: d.longitude || null,
                contact_urgence_nom: d.contact_urgence_nom || '',
                contact_urgence_telephone: formatPhoneDisplay(d.contact_urgence_telephone || ''),
                contact_urgence_lien: d.contact_urgence_lien || '',
                contact_urgence_courriel: d.contact_urgence_courriel || '',
                methode_connexion: (d.methode_connexion === 'email' ? 'email' : 'sms') as 'sms' | 'email',
              })
              setOriginalProfilData({
                telephone: formatPhoneDisplay(d.telephone || ''),
                telephone_secondaire: formatPhoneDisplay(d.telephone_secondaire || ''),
                adresse: d.adresse || '',
                ville: d.ville || '',
                code_postal: d.code_postal || '',
                region: d.region || '',
                latitude: d.latitude || null,
                longitude: d.longitude || null,
                contact_urgence_nom: d.contact_urgence_nom || '',
                contact_urgence_telephone: formatPhoneDisplay(d.contact_urgence_telephone || ''),
                contact_urgence_lien: d.contact_urgence_lien || '',
                contact_urgence_courriel: d.contact_urgence_courriel || '',
                methode_connexion: (d.methode_connexion === 'email' ? 'email' : 'sms') as 'sms' | 'email',
              })

              const loaded: DossierData = {
                prenom: d.prenom || '', nom: d.nom || '', email: d.email || '',
                date_naissance: d.date_naissance || '', grandeur_bottes: d.grandeur_bottes || '',
                profession: d.profession || '', j_ai_18_ans: d.j_ai_18_ans || false,
                allergies_alimentaires: d.allergies_alimentaires || '', allergies_autres: d.allergies_autres || '',
                problemes_sante: d.problemes_sante || '', groupe_sanguin: d.groupe_sanguin || '',
                competence_rs: labelsToIds('competence_rs', d.competence_rs),
                certificat_premiers_soins: labelsToIds('certificat_premiers_soins', d.certificat_premiers_soins),
                date_expiration_certificat: d.date_expiration_certificat || '',
                vehicule_tout_terrain: labelsToIds('vehicule_tout_terrain', d.vehicule_tout_terrain),
                navire_marin: labelsToIds('navire_marin', d.navire_marin),
                permis_conduire: labelsToIds('permis_conduire', d.permis_conduire),
                disponible_covoiturage: labelsToIds('disponible_covoiturage', d.disponible_covoiturage),
                satp_drone: labelsToIds('satp_drone', d.satp_drone),
                equipe_canine: labelsToIds('equipe_canine', d.equipe_canine),
                competences_securite: labelsToIds('competences_securite', d.competences_securite),
                competences_sauvetage: labelsToIds('competences_sauvetage', d.competences_sauvetage),
                certification_csi: labelsToIds('certification_csi', d.certification_csi),
                communication: labelsToIds('communication', d.communication),
                cartographie_sig: labelsToIds('cartographie_sig', d.cartographie_sig),
                operation_urgence: labelsToIds('operation_urgence', d.operation_urgence),
                experience_urgence_detail: d.experience_urgence_detail || '',
                autres_competences: d.autres_competences || '',
                commentaire: d.commentaire || '', confidentialite: d.confidentialite || false,
                consentement_antecedents: d.consentement_antecedents || false,
                preference_tache: d.preference_tache || 'aucune',
                preference_tache_commentaire: d.preference_tache_commentaire || '',
                groupe_recherche: d.groupe_recherche || '',
              }
              setDossier(loaded)
              setOriginalDossier(loaded)

              // Charger organisations, langues, groupes RS
              const { data: orgsData } = await supabase.from('organisations').select('id, nom').order('nom')
              setAllOrgs(orgsData || [])
              const { data: grsData } = await supabase.from('groupes_recherche').select('nom').eq('actif', true).order('nom')
              setGroupesRS((grsData || []).map(g => g.nom))
              const { data: languesData } = await supabase.from('langues').select('id, nom').order('nom')
              setAllLangues(languesData || [])

              // Charger orgs/langues liées (via service_role API)
              const { data: myOrgsData } = await supabase
                .from('reserviste_organisations').select('organisation_id').eq('benevole_id', d.benevole_id)
              setMyOrgIds((myOrgsData || []).map((r: any) => r.organisation_id))

              const { data: myLanguesData } = await supabase
                .from('reserviste_langues').select('langue_id').eq('benevole_id', d.benevole_id)
              setMyLangueIds((myLanguesData || []).map((r: any) => r.langue_id))

              logPageVisit('/profil')
              setLoading(false)
              return
            }
          }
        } catch (e) {
          console.error('[Profil] Erreur chargement bid:', e)
        }
      }

      // 🔧 SUPPORT MODE DEBUG
      if (typeof window !== 'undefined') {
        const debugMode = localStorage.getItem('debug_mode')
        if (debugMode === 'true') {
          const debugUser = localStorage.getItem('debug_user')
          if (debugUser) {
            const userData = JSON.parse(debugUser)
            console.log('🔧 Mode debug profil - Utilisateur:', userData.email)
            
            // Charger le profil complet depuis Supabase (RPC = SECURITY DEFINER)
            const { data: rpcData } = await supabase.rpc('get_reserviste_by_benevole_id', { target_benevole_id: userData.benevole_id })
            const fullData = rpcData?.[0] || userData
            
            setUser({ id: `debug_${fullData.benevole_id}`, email: fullData.email })
            setReserviste(fullData)
            
            setProfilData({
              telephone: formatPhoneDisplay(fullData.telephone || ''),
              telephone_secondaire: formatPhoneDisplay(fullData.telephone_secondaire || ''),
              adresse: fullData.adresse || '',
              ville: fullData.ville || '',
              code_postal: fullData.code_postal || '',
              region: fullData.region || '',
              latitude: fullData.latitude || null,
              longitude: fullData.longitude || null,
              contact_urgence_nom: fullData.contact_urgence_nom || '',
              contact_urgence_telephone: formatPhoneDisplay(fullData.contact_urgence_telephone || ''),
              contact_urgence_lien: fullData.contact_urgence_lien || '',
              contact_urgence_courriel: fullData.contact_urgence_courriel || '',
              methode_connexion: (fullData.methode_connexion === 'email' ? 'email' : 'sms') as 'sms' | 'email',
            })

            setOriginalProfilData({
              telephone: formatPhoneDisplay(fullData.telephone || ''),
              telephone_secondaire: formatPhoneDisplay(fullData.telephone_secondaire || ''),
              adresse: fullData.adresse || '',
              ville: fullData.ville || '',
              code_postal: fullData.code_postal || '',
              region: fullData.region || '',
              latitude: fullData.latitude || null,
              longitude: fullData.longitude || null,
              contact_urgence_nom: fullData.contact_urgence_nom || '',
              contact_urgence_telephone: formatPhoneDisplay(fullData.contact_urgence_telephone || ''),
              contact_urgence_lien: fullData.contact_urgence_lien || '',
              contact_urgence_courriel: fullData.contact_urgence_courriel || '',
              methode_connexion: (fullData.methode_connexion === 'email' ? 'email' : 'sms') as 'sms' | 'email',
            })

            // Charger dossier depuis Supabase
            const d = fullData
            const loaded: DossierData = {
              prenom: d.prenom || '',
              nom: d.nom || '',
              email: d.email || '',
              date_naissance: d.date_naissance || '',
              grandeur_bottes: d.grandeur_bottes || '',
              profession: d.profession || '',
              j_ai_18_ans: d.j_ai_18_ans || false,
              allergies_alimentaires: d.allergies_alimentaires || '',
              allergies_autres: d.allergies_autres || '',
              problemes_sante: d.problemes_sante || '',
              groupe_sanguin: d.groupe_sanguin || '',
              competence_rs: labelsToIds('competence_rs', d.competence_rs),
              certificat_premiers_soins: labelsToIds('certificat_premiers_soins', d.certificat_premiers_soins),
              date_expiration_certificat: d.date_expiration_certificat || '',
              vehicule_tout_terrain: labelsToIds('vehicule_tout_terrain', d.vehicule_tout_terrain),
              navire_marin: labelsToIds('navire_marin', d.navire_marin),
              permis_conduire: labelsToIds('permis_conduire', d.permis_conduire),
              disponible_covoiturage: labelsToIds('disponible_covoiturage', d.disponible_covoiturage),
              satp_drone: labelsToIds('satp_drone', d.satp_drone),
              equipe_canine: labelsToIds('equipe_canine', d.equipe_canine),
              competences_securite: labelsToIds('competences_securite', d.competences_securite),
              competences_sauvetage: labelsToIds('competences_sauvetage', d.competences_sauvetage),
              certification_csi: labelsToIds('certification_csi', d.certification_csi),
              communication: labelsToIds('communication', d.communication),
              cartographie_sig: labelsToIds('cartographie_sig', d.cartographie_sig),
              operation_urgence: labelsToIds('operation_urgence', d.operation_urgence),
              experience_urgence_detail: d.experience_urgence_detail || '',
              autres_competences: d.autres_competences || '',
              commentaire: d.commentaire || '',
              confidentialite: d.confidentialite || false,
              consentement_antecedents: d.consentement_antecedents || false,
              preference_tache: d.preference_tache || 'aucune',
              preference_tache_commentaire: d.preference_tache_commentaire || '',
              groupe_recherche: d.groupe_recherche || '',
            }
            setDossier(loaded)
            setOriginalDossier(loaded)

            // Charger organisations, langues et groupes RS
            const { data: orgsData } = await supabase.from('organisations').select('id, nom').order('nom')
            setAllOrgs(orgsData || [])
            const { data: grsData } = await supabase.from('groupes_recherche').select('nom').eq('actif', true).order('nom')
            setGroupesRS((grsData || []).map(g => g.nom))
            const { data: languesData } = await supabase.from('langues').select('id, nom').order('nom')
            setAllLangues(languesData || [])

            logPageVisit('/profil')
            setLoading(false)
            return
          }
        }
      }

      // 🎯 MODE DÉMO — prioritaire sur authUser
      if (isDemoActive()) {
          const groupe = getDemoGroupe()
          const demoRes = { ...DEMO_RESERVISTE, groupe } as any
          setUser(DEMO_USER)
          setReserviste(demoRes)
          setProfilData({
            telephone: '(418) 555-1234',
            telephone_secondaire: '',
            adresse: demoRes.adresse || '',
            ville: demoRes.ville || '',
            code_postal: demoRes.code_postal || '',
            region: demoRes.region || '',
            latitude: null,
            longitude: null,
            contact_urgence_nom: demoRes.contact_urgence_nom || '',
            contact_urgence_telephone: '(418) 555-9876',
            contact_urgence_lien: 'Conjoint',
            contact_urgence_courriel: 'jean.tremblay@example.com',
            methode_connexion: 'sms',
          })
          setOriginalProfilData({
            telephone: '(418) 555-1234',
            telephone_secondaire: '',
            adresse: demoRes.adresse || '',
            ville: demoRes.ville || '',
            code_postal: demoRes.code_postal || '',
            region: demoRes.region || '',
            latitude: null,
            longitude: null,
            contact_urgence_nom: demoRes.contact_urgence_nom || '',
            contact_urgence_telephone: '(418) 555-9876',
            contact_urgence_lien: 'Conjoint',
            contact_urgence_courriel: 'jean.tremblay@example.com',
            methode_connexion: 'sms',
          })
          setDossier({
            prenom: demoRes.prenom, nom: demoRes.nom, email: demoRes.email,
            date_naissance: demoRes.date_naissance || '', grandeur_bottes: '10', profession: 'Technicienne en environnement', j_ai_18_ans: true,
            allergies_alimentaires: demoRes.allergies_alimentaires || '', allergies_autres: '', problemes_sante: '', groupe_sanguin: 'O+',
            competence_rs: [1], certificat_premiers_soins: [], date_expiration_certificat: '',
            vehicule_tout_terrain: [], navire_marin: [], permis_conduire: [1], disponible_covoiturage: [],
            satp_drone: [], equipe_canine: [], competences_securite: [], competences_sauvetage: [],
            certification_csi: [], communication: [], cartographie_sig: [], operation_urgence: [],
            experience_urgence_detail: '', autres_competences: '', commentaire: '', confidentialite: true, consentement_antecedents: true,
            preference_tache: 'aucune', preference_tache_commentaire: '', groupe_recherche: '',
          })
          setOriginalDossier({
            prenom: demoRes.prenom, nom: demoRes.nom, email: demoRes.email,
            date_naissance: demoRes.date_naissance || '', grandeur_bottes: '10', profession: 'Technicienne en environnement', j_ai_18_ans: true,
            allergies_alimentaires: demoRes.allergies_alimentaires || '', allergies_autres: '', problemes_sante: '', groupe_sanguin: 'O+',
            competence_rs: [1], certificat_premiers_soins: [], date_expiration_certificat: '',
            vehicule_tout_terrain: [], navire_marin: [], permis_conduire: [1], disponible_covoiturage: [],
            satp_drone: [], equipe_canine: [], competences_securite: [], competences_sauvetage: [],
            certification_csi: [], communication: [], cartographie_sig: [], operation_urgence: [],
            experience_urgence_detail: '', autres_competences: '', commentaire: '', confidentialite: true, consentement_antecedents: true,
            preference_tache: 'aucune', preference_tache_commentaire: '', groupe_recherche: '',
          })
          logPageVisit('/profil')
          // Charger organisations et langues fictives pour démo
          setAllLangues([
            { id: 'demo-lang-fr', nom: 'Français' },
            { id: 'demo-lang-en', nom: 'Anglais' },
            { id: 'demo-lang-es', nom: 'Espagnol' },
          ])
          setMyLangueIds(['demo-lang-fr', 'demo-lang-en'])
          setAllOrgs([
            { id: 'demo-org-aqbrs', nom: 'AQBRS' },
            { id: 'demo-org-cr', nom: 'Croix-Rouge canadienne' },
          ])
          setMyOrgIds(['demo-org-aqbrs'])
          setLoading(false)
          return
      }

      if (!authUser) {
        router.push('/login')
        return
      }

      let reservisteData = null

      // CAS 1 : Emprunt d'identité
      if ('isImpersonated' in authUser && authUser.isImpersonated) {
        setUser(authUser)
        const { data } = await supabase
          .from('reservistes')
          .select('*')
          .eq('benevole_id', authUser.benevole_id)
          .single()
        reservisteData = data
      } else {
        // CAS 2 : Auth normale
        setUser(authUser)

        if ('email' in authUser && authUser.email) {
          const { data, error } = await supabase
            .from('reservistes')
            .select('*')
            .ilike('email', authUser.email)
            .single()
          if (error) console.error('❌ Erreur fetch par email:', error)
          reservisteData = data
        }

        if (!reservisteData && 'phone' in authUser && authUser.phone) {
          const phoneDigits = authUser.phone.replace(/\D/g, '')
          const { data } = await supabase
            .from('reservistes')
            .select('*')
            .eq('telephone', phoneDigits)
            .single()

          if (!data) {
            const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits
            const { data: data2 } = await supabase
              .from('reservistes')
              .select('*')
              .eq('telephone', phoneWithout1)
              .single()
            reservisteData = data2
          } else {
            reservisteData = data
          }
        }
      }

      if (!reservisteData) {
        setLoading(false)
        return
      }

      setReserviste(reservisteData)

      // Charger profilData depuis Supabase
      setProfilData({
        telephone: formatPhoneDisplay(reservisteData.telephone),
        telephone_secondaire: formatPhoneDisplay(reservisteData.telephone_secondaire),
        adresse: reservisteData.adresse || '',
        ville: reservisteData.ville || '',
        code_postal: reservisteData.code_postal || '',
        region: reservisteData.region || '',
        latitude: reservisteData.latitude || null,
        longitude: reservisteData.longitude || null,
        contact_urgence_nom: reservisteData.contact_urgence_nom || '',
        contact_urgence_telephone: formatPhoneDisplay(reservisteData.contact_urgence_telephone),
        contact_urgence_lien: reservisteData.contact_urgence_lien || '',
        contact_urgence_courriel: reservisteData.contact_urgence_courriel || '',
        methode_connexion: (reservisteData.methode_connexion === 'email' ? 'email' : 'sms') as 'sms' | 'email',
      })

      setOriginalProfilData({
        telephone: formatPhoneDisplay(reservisteData.telephone),
        telephone_secondaire: formatPhoneDisplay(reservisteData.telephone_secondaire),
        adresse: reservisteData.adresse || '',
        ville: reservisteData.ville || '',
        code_postal: reservisteData.code_postal || '',
        region: reservisteData.region || '',
        latitude: reservisteData.latitude || null,
        longitude: reservisteData.longitude || null,
        contact_urgence_nom: reservisteData.contact_urgence_nom || '',
        contact_urgence_telephone: formatPhoneDisplay(reservisteData.contact_urgence_telephone),
        contact_urgence_lien: reservisteData.contact_urgence_lien || '',
        contact_urgence_courriel: reservisteData.contact_urgence_courriel || '',
        methode_connexion: (reservisteData.methode_connexion === 'email' ? 'email' : 'sms') as 'sms' | 'email',
      })

      // Charger organisations
      const { data: orgsData } = await supabase.from('organisations').select('id, nom').order('nom')
      setAllOrgs(orgsData || [])
      
      const { data: myOrgsData } = await supabase
        .from('reserviste_organisations')
        .select('organisation_id')
        .eq('benevole_id', reservisteData.benevole_id)
      const linkedOrgIds = (myOrgsData || []).map(r => r.organisation_id).filter((x): x is string => x !== null)
      setMyOrgIds(linkedOrgIds)

      // Charger langues
      const { data: languesData } = await supabase.from('langues').select('id, nom').order('nom')
      setAllLangues(languesData || [])

      const { data: myLanguesData } = await supabase
        .from('reserviste_langues')
        .select('langue_id')
        .eq('benevole_id', reservisteData.benevole_id)
      setMyLangueIds((myLanguesData || []).map(r => r.langue_id).filter((x): x is string => x !== null))

      // Charger dossier depuis Supabase (déjà dans reservisteData via select *)
      const d = reservisteData
      const loaded: DossierData = {
        prenom: d.prenom || '',
        nom: d.nom || '',
        email: d.email || '',
        date_naissance: d.date_naissance || '',
        grandeur_bottes: d.grandeur_bottes || '',
        profession: d.profession || '',
        j_ai_18_ans: d.j_ai_18_ans || false,
        allergies_alimentaires: d.allergies_alimentaires || '',
        allergies_autres: d.allergies_autres || '',
        problemes_sante: d.problemes_sante || '',
        groupe_sanguin: d.groupe_sanguin || '',
        competence_rs: labelsToIds('competence_rs', d.competence_rs),
        certificat_premiers_soins: labelsToIds('certificat_premiers_soins', d.certificat_premiers_soins),
        date_expiration_certificat: d.date_expiration_certificat || '',
        vehicule_tout_terrain: labelsToIds('vehicule_tout_terrain', d.vehicule_tout_terrain),
        navire_marin: labelsToIds('navire_marin', d.navire_marin),
        permis_conduire: labelsToIds('permis_conduire', d.permis_conduire),
        disponible_covoiturage: labelsToIds('disponible_covoiturage', d.disponible_covoiturage),
        satp_drone: labelsToIds('satp_drone', d.satp_drone),
        equipe_canine: labelsToIds('equipe_canine', d.equipe_canine),
        competences_securite: labelsToIds('competences_securite', d.competences_securite),
        competences_sauvetage: labelsToIds('competences_sauvetage', d.competences_sauvetage),
        certification_csi: labelsToIds('certification_csi', d.certification_csi),
        communication: labelsToIds('communication', d.communication),
        cartographie_sig: labelsToIds('cartographie_sig', d.cartographie_sig),
        operation_urgence: labelsToIds('operation_urgence', d.operation_urgence),
        experience_urgence_detail: d.experience_urgence_detail || '',
        autres_competences: d.autres_competences || '',
        commentaire: d.commentaire || '',
        confidentialite: d.confidentialite || false,
        consentement_antecedents: d.consentement_antecedents || false,
        preference_tache: d.preference_tache || 'aucune',
        preference_tache_commentaire: d.preference_tache_commentaire || '',
        groupe_recherche: d.groupe_recherche || '',
      }
      setDossier(loaded)
      setOriginalDossier(loaded)

      // Charger groupes RS
      const { data: grsData } = await supabase.from('groupes_recherche').select('nom').eq('actif', true).order('nom')
      setGroupesRS((grsData || []).map(g => g.nom))

      // Backfill AQBRS si compétence RS ou groupe de recherche rempli
      if (((d.competence_rs || []).length > 0 || (d.groupe_recherche || '').length > 0) && !linkedOrgIds.includes(AQBRS_ORG_ID)) {
        await supabase.from('reserviste_organisations').insert({
          benevole_id: reservisteData.benevole_id,
          organisation_id: AQBRS_ORG_ID
        })
        setMyOrgIds(prev => [...prev, AQBRS_ORG_ID])
      }

      logPageVisit('/profil')
      setLoading(false)
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  // ─── Autocomplete Adresse ────────────────────────────────────────────────

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([])
      return
    }

    setIsLoadingAddress(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&country=ca&language=fr&types=address&limit=5`
      )
      const data = await response.json()
      setAddressSuggestions(data.features || [])
      setShowAddressSuggestions(true)
    } catch (error) {
      console.error('Erreur recherche adresse:', error)
    }
    setIsLoadingAddress(false)
  }, [])

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const handleAddressChange = (value: string) => {
    setProfilData(prev => ({ ...prev, adresse: value, latitude: null, longitude: null }))

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      searchAddress(value)
    }, 300)
  }

  const selectAddress = (feature: MapboxFeature) => {
    const [lng, lat] = feature.center

    let ville = ''
    let codePostal = ''
    if (feature.context) {
      const placeContext = feature.context.find(c => c.id.startsWith('place'))
      if (placeContext) ville = placeContext.text
      const postcodeContext = feature.context.find(c => c.id.startsWith('postcode'))
      if (postcodeContext) codePostal = postcodeContext.text.toUpperCase().replace(/\s/g, ' ').trim()
    }

    setProfilData(prev => ({
      ...prev,
      adresse: feature.place_name,
      latitude: lat,
      longitude: lng,
      ville: ville || prev.ville,
      ...(codePostal ? { code_postal: codePostal } : {})
    }))
    setShowAddressSuggestions(false)
    setAddressSuggestions([])

    if (ville) {
      lookupRegionFromVille(ville, codePostal || profilData.code_postal)
    } else if (codePostal || profilData.code_postal) {
      // Pas de ville Mapbox mais on a le code postal → fallback FSA direct
      const cp = codePostal || profilData.code_postal
      const regionFSA = detecterRegionParFSA(cp)
      if (regionFSA) {
        setProfilData(prev => ({ ...prev, region: regionFSA }))
        setRegionNonDetectee(false)
      } else {
        setRegionNonDetectee(true)
      }
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressDropdownRef.current && !addressDropdownRef.current.contains(event.target as Node) &&
          addressInputRef.current && !addressInputRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── Autocomplete Ville ──────────────────────────────────────────────────

  const searchVille = async (query: string) => {
    if (query.length < 2) {
      setVilleSuggestions([])
      return
    }
    setIsLoadingVille(true)
    try {
      const { data, error } = await supabase
        .from('municipalites_qc')
        .select('municipalite, region_administrative, mrc')
        .ilike('municipalite', `${query}%`)
        .order('municipalite')
        .limit(8)
      if (!error && data) {
        setVilleSuggestions(data)
        setShowVilleSuggestions(true)
      }
    } catch (e) {
      console.error('Erreur recherche ville:', e)
    }
    setIsLoadingVille(false)
  }

  const handleVilleChange = (value: string) => {
    setProfilData(prev => ({ ...prev, ville: value, region: '' }))
    if (villeDebounceRef.current) clearTimeout(villeDebounceRef.current)
    villeDebounceRef.current = setTimeout(() => {
      searchVille(value)
    }, 250)
  }

  const selectVille = (suggestion: { municipalite: string; region_administrative: string; mrc: string | null }) => {
    setProfilData(prev => ({
      ...prev,
      ville: suggestion.municipalite,
      region: suggestion.region_administrative
    }))
    setRegionNonDetectee(false)
    setShowVilleSuggestions(false)
    setVilleSuggestions([])
  }

  const lookupRegionFromVille = async (ville: string, codePostalFallback?: string): Promise<boolean> => {
    if (!ville) return false

    // Stratégie 1 : table municipalites_qc (nom exact de municipalité)
    const { data } = await supabase
      .from('municipalites_qc')
      .select('region_administrative')
      .ilike('municipalite', ville)
      .limit(1)
      .single()

    if (data?.region_administrative) {
      setProfilData(prev => ({ ...prev, region: data.region_administrative }))
      setRegionNonDetectee(false)
      return true
    }

    // Stratégie 2 : FSA du code postal (arrondissements, villes fusionnées)
    const cp = codePostalFallback || ''
    if (cp.length >= 3) {
      const regionFSA = detecterRegionParFSA(cp)
      if (regionFSA) {
        setProfilData(prev => ({ ...prev, region: regionFSA }))
        setRegionNonDetectee(false)
        return true
      }
    }

    // Aucune détection → afficher le sélecteur manuel
    setRegionNonDetectee(true)
    return false
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (villeDropdownRef.current && !villeDropdownRef.current.contains(event.target as Node) &&
          villeInputRef.current && !villeInputRef.current.contains(event.target as Node)) {
        setShowVilleSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── Photo ───────────────────────────────────────────────────────────────

  const handleCroppedPhoto = async (croppedBlob: Blob) => {
    if (!reserviste) return
    if (isDemoActive()) { setSaveMessage({ type: 'success', text: 'Mode démonstration — la photo ne peut pas être modifiée.' }); return }

    setUploadingPhoto(true)
    setSaveMessage(null)

    try {
      const fileName = `${reserviste.benevole_id}-${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('reservistes')
        .update({ photo_url: publicUrl })
        .eq('benevole_id', reserviste.benevole_id)

      if (updateError) throw updateError

      setReserviste(prev => prev ? { ...prev, photo_url: publicUrl } : null)
      setSaveMessage({ type: 'success', text: 'Photo mise à jour avec succès' })
    } catch (error) {
      console.error('Erreur upload photo:', error)
      setSaveMessage({ type: 'error', text: "Erreur lors de l'upload de la photo" })
      throw error
    } finally {
      setUploadingPhoto(false)
    }
  }

  const getInitials = () => {
    if (reserviste) {
      return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase()
    }
    return user?.email?.charAt(0).toUpperCase() || 'U'
  }

  // ─── Modification des données ────────────────────────────────────────────

  const updateDossier = (field: keyof DossierData, value: any) => {
    setDossier(prev => ({ ...prev, [field]: value }))
  }

  const handlePhoneBlur = (field: 'telephone' | 'telephone_secondaire' | 'contact_urgence_telephone') => {
    setProfilData(prev => ({
      ...prev,
      [field]: formatPhoneDisplay(prev[field])
    }))
  }

  // ─── Test notification ────────────────────────────────────────────────────

  const handleTestNotification = async () => {
    if (isDemoActive()) {
      setDemoTestEmail('')
      setDemoTestTel('')
      setTestNotifResult(null)
      setShowDemoTestModal(true)
      return
    }
    await sendTestNotification(
      dossier.prenom || reserviste?.prenom || '',
      dossier.nom || reserviste?.nom || '',
      user?.email || reserviste?.email || '',
      profilData.telephone || reserviste?.telephone || '',
    )
  }

  const sendTestNotification = async (prenom: string, nom: string, email: string, telephone: string) => {
    setTestNotifLoading(true)
    setTestNotifResult(null)
    try {
      const res = await fetch(n8nUrl('/webhook/test-notification-reserviste'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, nom, email, telephone }),
      })
      setTestNotifResult(res.ok ? 'success' : 'error')
    } catch {
      setTestNotifResult('error')
    } finally {
      setTestNotifLoading(false)
    }
  }

  // ─── Sauvegarde ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!reserviste) return
    if (isDemoActive()) { setSaveMessage({ type: 'success', text: 'Mode démonstration — les modifications ne sont pas enregistrées.' }); return }

    // Valider la confirmation d'email si l'email a changé
    const emailChanged = dossier.email && dossier.email !== originalDossier.email
    if (emailChanged) {
      if (!emailConfirm.trim()) {
        setEmailConfirmError('Veuillez confirmer le nouveau courriel')
        setSaveMessage({ type: 'error', text: 'Veuillez confirmer le nouveau courriel avant de sauvegarder.' })
        return
      }
      if (dossier.email.toLowerCase().trim() !== emailConfirm.toLowerCase().trim()) {
        setEmailConfirmError('Les courriels ne correspondent pas')
        setSaveMessage({ type: 'error', text: 'Les courriels ne correspondent pas.' })
        return
      }
    }

    // Valider le code postal
    const codePostalRegex = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i
    if (!profilData.code_postal.trim()) {
      setSaveMessage({ type: 'error', text: 'Le code postal est obligatoire. Sélectionnez votre adresse dans la liste pour le remplir automatiquement.' })
      return
    } else if (!codePostalRegex.test(profilData.code_postal.trim())) {
      setSaveMessage({ type: 'error', text: 'Le code postal est invalide. Format attendu : J1H 1A1' })
      return
    }

    setSaving(true)
    setSaveMessage(null)

    try {
      // 0. Détecter et appliquer un changement d'email
      if (emailChanged && user?.id) {
        const emailRes = await fetch('/api/email-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            new_email: dossier.email,
            benevole_id: reserviste.benevole_id,
          })
        })
        if (!emailRes.ok) {
          const errData = await emailRes.json()
          setSaveMessage({ type: 'error', text: `Erreur lors du changement d'email : ${errData.error || 'Erreur inconnue'}` })
          setSaving(false)
          return
        }
        // Mettre à jour l'email dans originalDossier pour éviter re-trigger
        setOriginalDossier(prev => ({ ...prev, email: dossier.email }))
      }

      // 1. Sauvegarder les champs Profil dans Supabase
      if (profilHasChanges) {
        const { error: updateError } = await supabase
          .from('reservistes')
          .update({
            telephone: cleanPhoneForSave(profilData.telephone),
            telephone_secondaire: cleanPhoneForSave(profilData.telephone_secondaire),
            adresse: profilData.adresse,
            code_postal: profilData.code_postal,
            ville: profilData.ville,
            region: profilData.region,
            latitude: profilData.latitude,
            longitude: profilData.longitude,
            contact_urgence_nom: profilData.contact_urgence_nom,
            contact_urgence_telephone: cleanPhoneForSave(profilData.contact_urgence_telephone),
            contact_urgence_lien: profilData.contact_urgence_lien,
            contact_urgence_courriel: profilData.contact_urgence_courriel,
            methode_connexion: profilData.methode_connexion,
          })
          .eq('benevole_id', reserviste.benevole_id)

        if (updateError) {
          console.error('Erreur update Supabase:', updateError)
          setSaveMessage({ type: 'error', text: 'Erreur lors de la sauvegarde des informations de contact' })
          setSaving(false)
          return
        }

        setOriginalProfilData({ ...profilData })
      }

      // 2. Sauvegarder le dossier dans Supabase
      if (hasChanges) {
        const { error: dossierError } = await supabase
          .from('reservistes')
          .update({
            prenom: dossier.prenom || undefined,
            nom: dossier.nom || undefined,
            date_naissance: dossier.date_naissance || null,
            grandeur_bottes: dossier.grandeur_bottes || null,
            profession: dossier.profession || null,
            j_ai_18_ans: dossier.j_ai_18_ans,
            allergies_alimentaires: dossier.allergies_alimentaires || null,
            allergies_autres: dossier.allergies_autres || null,
            problemes_sante: dossier.problemes_sante || null,
            groupe_sanguin: dossier.groupe_sanguin || null,
            competence_rs: idsToLabels('competence_rs', dossier.competence_rs),
            certificat_premiers_soins: idsToLabels('certificat_premiers_soins', dossier.certificat_premiers_soins),
            date_expiration_certificat: dossier.date_expiration_certificat || null,
            vehicule_tout_terrain: idsToLabels('vehicule_tout_terrain', dossier.vehicule_tout_terrain),
            navire_marin: idsToLabels('navire_marin', dossier.navire_marin),
            permis_conduire: idsToLabels('permis_conduire', dossier.permis_conduire),
            disponible_covoiturage: idsToLabels('disponible_covoiturage', dossier.disponible_covoiturage),
            satp_drone: idsToLabels('satp_drone', dossier.satp_drone),
            equipe_canine: idsToLabels('equipe_canine', dossier.equipe_canine),
            competences_securite: idsToLabels('competences_securite', dossier.competences_securite),
            competences_sauvetage: idsToLabels('competences_sauvetage', dossier.competences_sauvetage),
            certification_csi: idsToLabels('certification_csi', dossier.certification_csi),
            communication: idsToLabels('communication', dossier.communication),
            cartographie_sig: idsToLabels('cartographie_sig', dossier.cartographie_sig),
            operation_urgence: idsToLabels('operation_urgence', dossier.operation_urgence),
            experience_urgence_detail: dossier.experience_urgence_detail || null,
            autres_competences: dossier.autres_competences || null,
            commentaire: dossier.commentaire || null,
            confidentialite: dossier.confidentialite,
            consentement_antecedents: dossier.consentement_antecedents,
            preference_tache: dossier.preference_tache || 'aucune',
            preference_tache_commentaire: dossier.preference_tache_commentaire || null,
            groupe_recherche: dossier.groupe_recherche || null,
          })
          .eq('benevole_id', reserviste.benevole_id)

        if (dossierError) {
          console.error('Erreur update dossier Supabase:', dossierError)
          setSaveMessage({ type: 'error', text: 'Erreur lors de la sauvegarde du dossier' })
          setSaving(false)
          return
        }

        setOriginalDossier({ ...dossier })

        // 2b. Gérer formations liées aux compétences du profil
        const FORMATION_TRIGGERS: { field: string; labels: string[] }[] = [
          { field: 'certification_csi', labels: OPTIONS.certification_csi.map(o => o.label) },
          { field: 'certificat_premiers_soins', labels: OPTIONS.certificat_premiers_soins.map(o => o.label) },
          { field: 'navire_marin', labels: ["Permis d'embarcation de plaisance"] },
          { field: 'competences_securite', labels: ['Scies à chaînes', 'Contrôle de la circulation routière', 'Formateur certifié CNESST'] },
          { field: 'communication', labels: ['Radio amateur'] },
          { field: 'satp_drone', labels: ['Licence de pilote de drone (Transport Canada)'] },
        ]

        const addedFormations: { field: string; label: string }[] = []
        const removedFormations: { field: string; label: string; formationId: string }[] = []

        for (const trigger of FORMATION_TRIGGERS) {
          const oldIds: number[] = (originalDossier as any)[trigger.field] || []
          const newIds: number[] = (dossier as any)[trigger.field] || []
          const opts = (OPTIONS as any)[trigger.field] || []
          const oldLabels = oldIds.map((id: number) => opts.find((o: any) => o.id === id)?.label).filter(Boolean) as string[]
          const newLabels = newIds.map((id: number) => opts.find((o: any) => o.id === id)?.label).filter(Boolean) as string[]
          const oldTriggered = oldLabels.filter(l => trigger.labels.includes(l))
          const newTriggered = newLabels.filter(l => trigger.labels.includes(l))

          for (const label of newTriggered) {
            if (!oldTriggered.includes(label)) addedFormations.push({ field: trigger.field, label })
          }
          for (const label of oldTriggered) {
            if (!newTriggered.includes(label)) {
              // Chercher d'abord une formation source 'portail' (créée par le profil)
              const { data: portailEntry } = await supabase.from('formations_benevoles').select('id').eq('benevole_id', reserviste.benevole_id).eq('nom_formation', label).eq('source', 'portail').is('deleted_at', null).maybeSingle()
              if (portailEntry) {
                removedFormations.push({ field: trigger.field, label, formationId: portailEntry.id })
              } else {
                // Si pas de source portail, chercher une entrée SANS certificat (ne jamais supprimer un certificat approuvé)
                const { data: noCertEntry } = await supabase.from('formations_benevoles').select('id').eq('benevole_id', reserviste.benevole_id).eq('nom_formation', label).is('certificat_url', null).is('deleted_at', null).maybeSingle()
                if (noCertEntry) removedFormations.push({ field: trigger.field, label, formationId: noCertEntry.id })
                // Si toutes les entrées ont un certificat, on ne supprime rien
              }
            }
          }
        }

        // Créer les nouvelles formations silencieusement
        for (const { field, label } of addedFormations) {
          const { data: exists } = await supabase.from('formations_benevoles').select('id').eq('benevole_id', reserviste.benevole_id).eq('nom_formation', label).is('deleted_at', null).maybeSingle()
          if (!exists) {
            const noCertLabels = [
              'f) Infirmière / Infirmier',
              'g) Paramédic / Technicien ambulancier',
              'h) Médecin',
            ]
            await supabase.from('formations_benevoles').insert({
              benevole_id: reserviste.benevole_id,
              nom_complet: dossier.nom + ' ' + dossier.prenom,
              nom_formation: label,
              resultat: noCertLabels.includes(label) ? 'Réussi' : 'En attente',
              etat_validite: noCertLabels.includes(label) ? 'À jour' : null,
              role: 'Participant',
              source: 'portail',
              certificat_requis: !noCertLabels.includes(label),
              competence_profil_champ: field,
              competence_profil_label: label,
            })
          }
        }

        // Si des formations existantes doivent être retirées → demander confirmation
        if (removedFormations.length > 0) {
          setSaving(false)
          setFormationDialog({
            show: true,
            removedLabels: removedFormations.map(r => r.label),
            addedLabels: addedFormations.map(a => a.label),
            pendingSave: async () => {
              // Soft-delete (recuperable via /admin/corbeille-certificats)
              for (const { formationId } of removedFormations) {
                await supabase.rpc('formations_soft_delete', {
                  p_formation_id: Number(formationId),
                  p_reason: 'Décoché dans le profil par le réserviste',
                })
              }
              setSaveMessage({ type: 'success', text: 'Modifications enregistrées avec succès!' })
            }
          })
          return
        }
      }

      // 3. Organisations
      if (orgHasChanges) {
        // Supprimer les organisations retirées
        if (removedOrgIds.length > 0) {
          await supabase
            .from('reserviste_organisations')
            .delete()
            .eq('benevole_id', reserviste.benevole_id)
            .in('organisation_id', removedOrgIds)
        }

        let orgIdsToAdd = [...newOrgIds]
        // Creation de la nouvelle organisation via l'API (service_role: bypass RLS).
        // L'API fait aussi l'association au benevole, donc on retire l'id de la liste
        // uniqueOrgs pour ne pas tenter de recreer l'association client-side.
        let orgCreeeEtLiee: string | null = null
        if (newOrgName.trim()) {
          try {
            const resp = await fetch('/api/profil/organisation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nom: newOrgName.trim(), benevole_id: reserviste.benevole_id }),
            })
            const json = await resp.json()
            if (!resp.ok) {
              alert(`Erreur creation organisation: ${json.error || 'inconnue'}`)
            } else if (json.organisation_id) {
              orgCreeeEtLiee = json.organisation_id
            }
          } catch (e) {
            alert(`Erreur creation organisation: ${e instanceof Error ? e.message : 'inconnue'}`)
          }
        }
        // Associations des organisations existantes selectionnees (hors celle creee deja liee)
        const uniqueOrgs = orgIdsToAdd.filter(id => !myOrgIds.includes(id))
        if (uniqueOrgs.length > 0) {
          await supabase.from('reserviste_organisations').insert(
            uniqueOrgs.map(organisation_id => ({ benevole_id: reserviste.benevole_id, organisation_id }))
          )
        }
        // Ajouter l'org creee a la liste locale pour le refresh
        if (orgCreeeEtLiee) uniqueOrgs.push(orgCreeeEtLiee)
        const { data: refreshedOrgs } = await supabase.from('organisations').select('id, nom').order('nom')
        setAllOrgs(refreshedOrgs || [])
        setMyOrgIds(prev => [...prev.filter(id => !removedOrgIds.includes(id)), ...uniqueOrgs])
        setNewOrgIds([])
        setNewOrgName('')
        setShowNewOrgInput(false)
        setRemovedOrgIds([])
      }

      // 4. Langues
      if (langueHasChanges) {
        // Supprimer les langues retirées
        if (removedLangueIds.length > 0) {
          await supabase
            .from('reserviste_langues')
            .delete()
            .eq('benevole_id', reserviste.benevole_id)
            .in('langue_id', removedLangueIds)
        }

        let langueIdsToAdd = [...newLangueIds]
        if (newLangueName.trim()) {
          const { data: createdLangue, error: createError } = await supabase
            .from('langues').insert({ nom: newLangueName.trim() }).select('id').single()
          if (createError) {
            const { data: existingLangue } = await supabase.from('langues').select('id').ilike('nom', newLangueName.trim()).single()
            if (existingLangue) langueIdsToAdd.push(existingLangue.id)
          } else if (createdLangue) {
            langueIdsToAdd.push(createdLangue.id)
          }
        }
        const uniqueLangues = langueIdsToAdd.filter(id => !myLangueIds.includes(id))
        if (uniqueLangues.length > 0) {
          await supabase.from('reserviste_langues').insert(
            uniqueLangues.map(langue_id => ({ benevole_id: reserviste.benevole_id, langue_id }))
          )
        }
        const { data: refreshedLangues } = await supabase.from('langues').select('id, nom').order('nom')
        setAllLangues(refreshedLangues || [])
        setMyLangueIds(prev => [...prev.filter(id => !removedLangueIds.includes(id)), ...uniqueLangues])
        setNewLangueIds([])
        setNewLangueName('')
        setShowNewLangueInput(false)
        setRemovedLangueIds([])
      }

      setSaveMessage({ type: 'success', text: 'Profil sauvegardé avec succès !' })
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setSaveMessage({ type: 'error', text: 'Erreur de connexion' })
    }
    setSaving(false)
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#1e3a5f', fontSize: '16px' }}>
        Chargement...
      </div>
    )
  }

  const showConfirm18 = !isOlderThan18(dossier.date_naissance)
  const canSave = (hasChanges || profilHasChanges || orgHasChanges || langueHasChanges) && isValidNorthAmericanPhone(profilData.telephone)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>

      {/* Modal test notification — Mode démo */}
      {showDemoTestModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📨</div>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700' }}>Tester les notifications</h3>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                Entrez votre vrai numéro et courriel pour recevoir un exemple d&apos;avis de mobilisation RIUSC.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Courriel</label>
                <input
                  type="email"
                  value={demoTestEmail}
                  onChange={e => setDemoTestEmail(e.target.value)}
                  placeholder="votre@courriel.com"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' as const }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Téléphone (pour SMS)</label>
                <input
                  type="tel"
                  value={demoTestTel}
                  onChange={e => setDemoTestTel(e.target.value)}
                  placeholder="(555) 123-4567"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' as const }}
                />
              </div>
            </div>
            {testNotifResult === 'success' && (
              <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
                ✅ SMS et courriel envoyés — vérifiez vos appareils !
              </div>
            )}
            {testNotifResult === 'error' && (
              <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
                ❌ Erreur lors de l&apos;envoi. Vérifiez le numéro de téléphone.
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowDemoTestModal(false); setTestNotifResult(null) }}
                style={{ padding: '10px 20px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}
              >Fermer</button>
              <button
                type="button"
                disabled={testNotifLoading || (!demoTestEmail && !demoTestTel)}
                onClick={() => sendTestNotification('Marie', 'Tremblay', demoTestEmail, demoTestTel)}
                style={{
                  padding: '10px 20px', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: '6px',
                  cursor: (testNotifLoading || (!demoTestEmail && !demoTestTel)) ? 'not-allowed' : 'pointer',
                  backgroundColor: (testNotifLoading || (!demoTestEmail && !demoTestTel)) ? '#9ca3af' : '#059669',
                  color: 'white',
                }}
              >
                {testNotifLoading ? '⏳ Envoi...' : '📨 Envoyer le test'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PortailHeader subtitle={isViewingOther ? `Profil de ${reserviste?.prenom} ${reserviste?.nom}` : 'Mon profil'} />

      {isViewingOther && (
        <div style={{ backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe', padding: '10px 24px' }}>
          <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: '500' }}>
              👁️ Vous consultez le profil de <strong>{reserviste?.prenom} {reserviste?.nom}</strong>
            </span>
            <button
              onClick={() => {
                if (fromParam === 'reservistes') {
                  router.push('/admin/reservistes')
                } else {
                  window.close()
                }
              }}
              style={{ fontSize: '13px', color: '#1e40af', background: 'none', border: '1px solid #93c5fd', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}
            >
              ← Retour
            </button>
          </div>
        </div>
      )}


      {/* Barre d'onglets */}
      <div style={{ maxWidth: '860px', margin: '20px auto 0', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb' }}>
          <button onClick={() => switchTab('dossier')}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: 700, backgroundColor: activeTab === 'dossier' ? 'white' : 'transparent', color: activeTab === 'dossier' ? '#1e3a5f' : '#6b7280', border: 'none', borderBottom: activeTab === 'dossier' ? '3px solid #1e3a5f' : '3px solid transparent', marginBottom: -2, cursor: 'pointer', transition: 'all 0.15s' }}>
            📋 Mon profil
          </button>
          <button onClick={() => switchTab('trajets')}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: 700, backgroundColor: activeTab === 'trajets' ? 'white' : 'transparent', color: activeTab === 'trajets' ? '#1e3a5f' : '#6b7280', border: 'none', borderBottom: activeTab === 'trajets' ? '3px solid #1e3a5f' : '3px solid transparent', marginBottom: -2, cursor: 'pointer', transition: 'all 0.15s' }}>
            🚗 Mes trajets
          </button>
          <button onClick={() => switchTab('heures')}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: 700, backgroundColor: activeTab === 'heures' ? 'white' : 'transparent', color: activeTab === 'heures' ? '#1e3a5f' : '#6b7280', border: 'none', borderBottom: activeTab === 'heures' ? '3px solid #1e3a5f' : '3px solid transparent', marginBottom: -2, cursor: 'pointer', transition: 'all 0.15s' }}>
            📊 Mes heures
          </button>
        </div>
      </div>

      {/* Onglet TRAJETS */}
      {activeTab === 'trajets' && (
        <main style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 24px 80px' }}>
          <TrajetsTab />
        </main>
      )}

      {/* Onglet HEURES */}
      {activeTab === 'heures' && (
        <main style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 24px 80px' }}>
          <HeuresTab />
        </main>
      )}

      {/* Onglet PROFIL (contenu existant) */}
      {activeTab === 'dossier' && (
      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{ marginBottom: '24px' }}>
          {isViewingOther ? (
            <a href="/admin/reservistes" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour aux réservistes</a>
          ) : (
            <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour à l&apos;accueil</a>
          )}
        </div>

        {/* ── 1. Identité & Photo ── */}
        <Section title="Identité" icon="👤">
          {/* Photo de profil */}
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <ImageCropper
              currentPhotoUrl={reserviste?.photo_url}
              initials={getInitials()}
              size={100}
              uploading={uploadingPhoto}
              onCropComplete={handleCroppedPhoto}
            />
            <div>
              <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Cliquez sur la photo pour la modifier
              </p>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                {uploadingPhoto ? 'Téléversement en cours...' : 'Vous pourrez recadrer et zoomer l\'image. Format JPG ou PNG, max 10 Mo.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 24px' }}>
            <TextInput
              label="Prénom"
              value={dossier.prenom}
              onChange={v => updateDossier('prenom', v)}
            />
            <TextInput
              label="Nom de famille"
              value={dossier.nom}
              onChange={v => updateDossier('nom', v)}
            />
          </div>

          <TextInput
            label="Courriel"
            value={dossier.email}
            onChange={v => { updateDossier('email', v); setEmailConfirm(''); setEmailConfirmError('') }}
            type="email"
          />
          {dossier.email !== originalDossier.email && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Confirmer le nouveau courriel
              </label>
              <input
                type="email"
                value={emailConfirm}
                onChange={e => { setEmailConfirm(e.target.value); setEmailConfirmError('') }}
                onPaste={e => e.preventDefault()}
                placeholder="Répétez le nouveau courriel"
                autoComplete="off"
                style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: emailConfirmError ? '1px solid #dc2626' : '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' as const, backgroundColor: emailConfirmError ? '#fef2f2' : 'white' }}
              />
              {emailConfirmError && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{emailConfirmError}</p>}
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>Le courriel sera mis à jour lors de la sauvegarde</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 24px' }}>
            <div>
              <TextInput
                label="Cellulaire"
                value={profilData.telephone}
                onChange={v => setProfilData(prev => ({ ...prev, telephone: formatPhoneDisplay(v) }))}
                placeholder="(555) 123-4567"
              />
              <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>
                Utilisé pour les rappels SMS (camps, déploiements). Assurez-vous que ce soit un numéro de cellulaire.
              </div>
              {profilData.telephone && !isValidNorthAmericanPhone(profilData.telephone) && (
                <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠ Numéro invalide — entrez un numéro canadien à 10 chiffres
                </div>
              )}
            </div>
            <TextInput
              label="Téléphone maison (optionnel)"
              value={profilData.telephone_secondaire}
              onChange={v => setProfilData(prev => ({ ...prev, telephone_secondaire: formatPhoneDisplay(v) }))}
              placeholder="(555) 987-6543"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testNotifLoading || (!profilData.telephone && !reserviste?.telephone)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', fontSize: '13px', fontWeight: '500',
                backgroundColor: testNotifLoading ? '#e5e7eb' : '#f59e0b',
                color: testNotifLoading ? '#9ca3af' : '#ffffff',
                border: 'none', borderRadius: '6px',
                cursor: (testNotifLoading || (!profilData.telephone && !reserviste?.telephone)) ? 'not-allowed' : 'pointer',
                opacity: (!profilData.telephone && !reserviste?.telephone) ? 0.5 : 1,
                transition: 'background-color 0.2s',
              }}
            >
              {testNotifLoading ? '⏳ Envoi...' : '📨 Tester SMS et courriel'}
            </button>
            <span style={{ marginLeft: '10px', fontSize: '12px', color: '#9ca3af' }}>
              Simule un vrai avis de mobilisation à votre numéro et courriel
            </span>
            {testNotifResult === 'success' && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#059669' }}>
                ✅ SMS et courriel de test envoyés avec succès !
              </div>
            )}
            {testNotifResult === 'error' && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#dc2626' }}>
                ❌ Erreur lors de l&apos;envoi. Vérifiez votre numéro de téléphone.
              </div>
            )}
          </div>

          {/* Préférence de connexion */}
          <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Méthode de connexion préférée
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setProfilData(prev => ({ ...prev, methode_connexion: 'sms' }))}
                style={{
                  flex: 1, padding: '10px 14px', fontSize: '13px', fontWeight: '500',
                  borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                  backgroundColor: profilData.methode_connexion === 'sms' ? '#1e3a5f' : 'white',
                  color: profilData.methode_connexion === 'sms' ? 'white' : '#374151',
                  border: profilData.methode_connexion === 'sms' ? '2px solid #1e3a5f' : '2px solid #d1d5db',
                }}
              >
                📱 Texto (SMS)
              </button>
              <button
                type="button"
                onClick={() => setProfilData(prev => ({ ...prev, methode_connexion: 'email' }))}
                style={{
                  flex: 1, padding: '10px 14px', fontSize: '13px', fontWeight: '500',
                  borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                  backgroundColor: profilData.methode_connexion === 'email' ? '#1e3a5f' : 'white',
                  color: profilData.methode_connexion === 'email' ? 'white' : '#374151',
                  border: profilData.methode_connexion === 'email' ? '2px solid #1e3a5f' : '2px solid #d1d5db',
                }}
              >
                📧 Courriel
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '6px 0 0 0' }}>
              Choisissez comment recevoir votre code de connexion. Les notifications opérationnelles (camps, déploiements) sont toujours envoyées par texto et courriel.
            </p>
          </div>

          <TextInput
            label="Date de naissance"
            value={dossier.date_naissance}
            onChange={v => updateDossier('date_naissance', v)}
            type="date"
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 24px' }}>
            <TextInput
              label="Profession / Métier"
              value={dossier.profession}
              onChange={v => updateDossier('profession', v)}
              placeholder="Ex: Infirmière, Électricien, Enseignant..."
            />
            <TextInput
              label="Grandeur de bottes"
              value={dossier.grandeur_bottes}
              onChange={v => updateDossier('grandeur_bottes', v)}
              placeholder="Ex: 10"
            />
          </div>

          {showConfirm18 && (
            <Checkbox
              label="Je confirme avoir 18 ans ou plus"
              checked={dossier.j_ai_18_ans}
              onChange={v => updateDossier('j_ai_18_ans', v)}
            />
          )}
        </Section>

        {/* ── 2. Adresse ── */}
        <Section title="Adresse" icon="📍">
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Adresse complète
            </label>
            <input
              ref={addressInputRef}
              type="text"
              value={profilData.adresse}
              onChange={e => handleAddressChange(e.target.value)}
              placeholder="123 Rue Principale, Montréal, QC"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#111827',
                backgroundColor: 'white',
                boxSizing: 'border-box',
              }}
            />
            {showAddressSuggestions && addressSuggestions.length > 0 && (
              <div
                ref={addressDropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  marginTop: '4px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  zIndex: 1000,
                }}
              >
                {addressSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectAddress(suggestion)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      borderBottom: idx < addressSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    {suggestion.place_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 24px' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Ville
              </label>
              <input
                ref={villeInputRef}
                type="text"
                value={profilData.ville}
                onChange={e => handleVilleChange(e.target.value)}
                placeholder="Montréal"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#111827',
                  backgroundColor: 'white',
                  boxSizing: 'border-box',
                }}
              />
              {showVilleSuggestions && villeSuggestions.length > 0 && (
                <div
                  ref={villeDropdownRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                  }}
                >
                  {villeSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => selectVille(suggestion)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        borderBottom: idx < villeSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: '500', color: '#111827' }}>{suggestion.municipalite}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{suggestion.region_administrative}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Code postal *
              </label>
              <input
                type="text"
                value={profilData.code_postal}
                onChange={e => setProfilData(prev => ({ ...prev, code_postal: e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, '').slice(0, 7) }))}
                onBlur={e => {
                  const cp = e.target.value.trim()
                  if (cp.length >= 3 && !profilData.region) {
                    const r = detecterRegionParFSA(cp)
                    if (r) { setProfilData(prev => ({ ...prev, region: r })); setRegionNonDetectee(false) }
                    else if (cp.length >= 6) setRegionNonDetectee(true)
                  }
                }}
                placeholder="Ex: J1H 1A1"
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                  borderRadius: '8px', fontSize: '14px', color: '#111827',
                  backgroundColor: 'white', boxSizing: 'border-box' as const,
                }}
              />
            </div>
            {/* Région — auto-détectée ou sélecteur manuel si non détectée */}
            {regionNonDetectee && !profilData.region ? (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  background: '#fff8e1', border: '1px solid #ffd166', borderRadius: '6px',
                  padding: '7px 11px', marginBottom: '7px', fontSize: '12px', color: '#7a5c00',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span>⚠️</span>
                  <span>Région non détectée automatiquement — veuillez la sélectionner.</span>
                </div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Région administrative <span style={{ color: '#c0392b' }}>*</span>
                </label>
                <select
                  value={profilData.region}
                  onChange={e => {
                    setProfilData(prev => ({ ...prev, region: e.target.value }))
                    if (e.target.value) setRegionNonDetectee(false)
                  }}
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '1.5px solid #e74c3c', borderRadius: '8px',
                    fontSize: '14px', color: '#111827', backgroundColor: 'white',
                    boxSizing: 'border-box' as const,
                  }}
                >
                  <option value="">— Sélectionner une région —</option>
                  {REGIONS_QUEBEC.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Région
                </label>
                {profilData.region ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      flex: 1, padding: '10px 12px', border: '1px solid #d1d5db',
                      borderRadius: '8px', fontSize: '14px', color: '#111827',
                      backgroundColor: '#f9fafb', boxSizing: 'border-box' as const,
                    }}>
                      {profilData.region}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setRegionNonDetectee(true); setProfilData(prev => ({ ...prev, region: '' })) }}
                      style={{
                        padding: '6px 10px', fontSize: '12px', color: '#6b7280',
                        background: 'none', border: '1px solid #d1d5db', borderRadius: '6px',
                        cursor: 'pointer', whiteSpace: 'nowrap' as const,
                      }}
                      title="Modifier la région"
                    >
                      ✏️ Modifier
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={profilData.region}
                    onChange={e => setProfilData(prev => ({ ...prev, region: e.target.value }))}
                    onBlur={e => {
                      // Tentative FSA si code postal déjà saisi
                      if (!e.target.value && profilData.code_postal.length >= 3) {
                        const r = detecterRegionParFSA(profilData.code_postal)
                        if (r) { setProfilData(prev => ({ ...prev, region: r })); setRegionNonDetectee(false) }
                        else setRegionNonDetectee(true)
                      }
                    }}
                    placeholder="Sélectionnez votre adresse ci-dessus"
                    style={{
                      width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                      borderRadius: '8px', fontSize: '14px', color: '#9ca3af',
                      backgroundColor: '#f9fafb', boxSizing: 'border-box' as const,
                    }}
                  />
                )}
              </div>
            )}
          </div>

        </Section>

        {/* ── 3. Contact d'urgence ── */}
        <Section title="Contact d'urgence" icon="🚨">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <TextInput
              label="Nom du contact"
              value={profilData.contact_urgence_nom}
              onChange={v => setProfilData(prev => ({ ...prev, contact_urgence_nom: v }))}
              placeholder="Ex: Jean Tremblay"
            />
            <TextInput
              label="Lien avec la personne"
              value={profilData.contact_urgence_lien}
              onChange={v => setProfilData(prev => ({ ...prev, contact_urgence_lien: v }))}
              placeholder="Ex: Conjoint, Parent, Ami(e)"
            />
            <TextInput
              label="Téléphone du contact"
              value={profilData.contact_urgence_telephone}
              onChange={v => setProfilData(prev => ({ ...prev, contact_urgence_telephone: formatPhoneDisplay(v) }))}
              placeholder="(555) 123-4567"
            />
            <TextInput
              label="Courriel du contact"
              value={profilData.contact_urgence_courriel}
              onChange={v => setProfilData(prev => ({ ...prev, contact_urgence_courriel: v }))}
              placeholder="Ex: jean.tremblay@example.com"
            />
          </div>
        </Section>

        {/* ── 4. Santé ── */}
        {isViewingOther && !santeUnlocked ? (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', paddingBottom: '10px', borderBottom: '2px solid #1e3a5f' }}>
              <span style={{ fontSize: '20px' }}>🏥</span>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#1e3a5f' }}>Santé</h2>
            </div>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: '#1e3a5f' }}>Information confidentielle</p>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>Entrez le mot de passe pour accéder aux informations médicales de ce réserviste.</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                <input
                  type="password"
                  value={santeMdpInput}
                  onChange={e => { setSanteMdpInput(e.target.value); setSanteMdpError(false) }}
                  onKeyDown={e => e.key === 'Enter' && verifierMdpSante()}
                  placeholder="Mot de passe..."
                  style={{ padding: '8px 12px', border: santeMdpError ? '1px solid #dc2626' : '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '200px' }}
                />
                <button
                  onClick={verifierMdpSante}
                  disabled={santeMdpLoading || !santeMdpInput}
                  style={{ padding: '8px 16px', backgroundColor: santeMdpLoading ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: santeMdpLoading ? 'wait' : 'pointer' }}
                >
                  {santeMdpLoading ? '⏳' : '🔓 Déverrouiller'}
                </button>
              </div>
              {santeMdpError && (
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#dc2626' }}>Mot de passe incorrect</p>
              )}
            </div>
          </div>
        ) : (
        <Section
          title="Santé"
          icon="🏥"
          description="Informations médicales de base pour assurer votre sécurité et celle de votre équipe lors des déploiements."
          confidential
        >
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Groupe sanguin
            </label>
            <select
              value={dossier.groupe_sanguin}
              onChange={e => updateDossier('groupe_sanguin', e.target.value)}
              style={{
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#111827',
                backgroundColor: 'white',
                minWidth: '160px',
              }}
            >
              <option value="">— Sélectionner —</option>
              {GROUPES_SANGUIN.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <TextArea
            label="Allergies alimentaires"
            value={dossier.allergies_alimentaires}
            onChange={v => updateDossier('allergies_alimentaires', v)}
            placeholder="Ex: Noix, arachides, fruits de mer..."
          />
          <TextArea
            label="Autres allergies"
            value={dossier.allergies_autres}
            onChange={v => updateDossier('allergies_autres', v)}
            placeholder="Ex: Latex, pollen, médicaments..."
          />
          <TextArea
            label="Problèmes de santé ou conditions médicales"
            value={dossier.problemes_sante}
            onChange={v => updateDossier('problemes_sante', v)}
            placeholder="Conditions dont l'équipe devrait être informée lors d'un déploiement..."
          />
        </Section>
        )}

        {/* ── 6. Premiers soins ── */}
        <Section title="Certifications premiers soins" icon="🩹">
          <CheckboxGroup
            label="Certificats détenus"
            options={OPTIONS.certificat_premiers_soins}
            selected={dossier.certificat_premiers_soins}
            onChange={v => updateDossier('certificat_premiers_soins', v)}
          />
          <TextInput
            label="Date d'expiration du certificat"
            value={dossier.date_expiration_certificat}
            onChange={v => updateDossier('date_expiration_certificat', v)}
            type="date"
          />
        </Section>

        {/* ── 7. Permis et conduite ── */}
        <Section title="Permis de conduite et navigation" icon="🚗">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div>
              <CheckboxGroup
                label="Habileté à conduire"
                options={OPTIONS.vehicule_tout_terrain}
                selected={dossier.vehicule_tout_terrain}
                onChange={v => updateDossier('vehicule_tout_terrain', v)}
              />
              <CheckboxGroup
                label="Permis de navigation"
                options={OPTIONS.navire_marin}
                selected={dossier.navire_marin}
                onChange={v => updateDossier('navire_marin', v)}
              />
            </div>
            <div>
              <CheckboxGroup
                label="Permis de conduire"
                options={OPTIONS.permis_conduire}
                selected={dossier.permis_conduire}
                onChange={v => updateDossier('permis_conduire', v)}
              />
            </div>
          </div>
        </Section>

        {/* ── 8. Compétences spécialisées ── */}
        <Section title="Compétences spécialisées" icon="🎓">
          <CheckboxGroup
            label="Drone"
            options={OPTIONS.satp_drone}
            selected={dossier.satp_drone}
            onChange={v => updateDossier('satp_drone', v)}
          />
          <CheckboxGroup
            label="Compétences sécurité"
            options={OPTIONS.competences_securite}
            selected={dossier.competences_securite}
            onChange={v => updateDossier('competences_securite', v)}
          />
          <CheckboxGroup
            label="Compétences sauvetage"
            options={OPTIONS.competences_sauvetage}
            selected={dossier.competences_sauvetage}
            onChange={v => updateDossier('competences_sauvetage', v)}
          />
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Certification en système de commandement d&apos;intervention <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', fontWeight: '400' }}>(certificat requis)</span>
            </label>
            <select
              value={dossier.certification_csi.length > 0 ? dossier.certification_csi[0] : ''}
              onChange={e => updateDossier('certification_csi', e.target.value ? [Number(e.target.value)] : [])}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#374151',
                backgroundColor: 'white',
              }}
            >
              <option value="">— Aucune certification —</option>
              {OPTIONS.certification_csi.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          <CheckboxGroup
            label="Communication"
            options={OPTIONS.communication}
            selected={dossier.communication}
            onChange={v => updateDossier('communication', v)}
          />
          <CheckboxGroup
            label="Cartographie / SIG"
            options={OPTIONS.cartographie_sig}
            selected={dossier.cartographie_sig}
            onChange={v => updateDossier('cartographie_sig', v)}
          />
          <CheckboxGroup
            label="Expérience en situation d'urgence"
            options={OPTIONS.operation_urgence}
            selected={dossier.operation_urgence}
            onChange={v => updateDossier('operation_urgence', v)}
          />
          {dossier.operation_urgence.length > 0 && (
            <TextInput
              label="Précisez votre expérience"
              value={dossier.experience_urgence_detail}
              onChange={v => updateDossier('experience_urgence_detail', v)}
              placeholder="Ex: Déployé lors des inondations 2019, opération Lac-Mégantic..."
            />
          )}
          <TextArea
            label="Autres compétences"
            value={dossier.autres_competences}
            onChange={v => updateDossier('autres_competences', v)}
            placeholder="Décrivez toute autre compétence pertinente..."
            rows={4}
          />
        </Section>

        {/* ── 9. Organisations et Langues ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          <Section title="Organisations" icon="🏢">
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Organisations dont vous faites partie
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {allOrgs.filter(org => myOrgIds.includes(org.id) && !removedOrgIds.includes(org.id)).map(org => (
                  <button
                    key={org.id}
                    onClick={() => setRemovedOrgIds(prev => [...prev, org.id])}
                    title="Cliquer pour retirer"
                    style={{
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      padding: '6px 12px',
                      borderRadius: '16px',
                      fontSize: '13px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1px solid #bae6fd',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5' }}
                    onMouseOut={e => { e.currentTarget.style.backgroundColor = '#e0f2fe'; e.currentTarget.style.color = '#0369a1'; e.currentTarget.style.borderColor = '#bae6fd' }}
                  >
                    {org.nom}
                    <span style={{ fontSize: '16px', lineHeight: '1' }}>×</span>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Ajouter une organisation
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        setNewOrgIds(prev => [...prev, e.target.value])
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#374151',
                      backgroundColor: 'white',
                      minWidth: '200px',
                      flex: '1',
                    }}
                  >
                    <option value="">— Sélectionner —</option>
                    {allOrgs
                      .filter(org => (!myOrgIds.includes(org.id) || removedOrgIds.includes(org.id)) && !newOrgIds.includes(org.id))
                      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
                      .map(org => (
                        <option key={org.id} value={org.id}>{org.nom}</option>
                      ))
                    }
                  </select>
                  {!showNewOrgInput && (
                    <button
                      onClick={() => setShowNewOrgInput(true)}
                      style={{
                        backgroundColor: 'white',
                        border: '1px dashed #d1d5db',
                        color: '#6b7280',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + Autre
                    </button>
                  )}
                </div>

                {newOrgIds.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>À ajouter lors de la sauvegarde:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {newOrgIds.map(orgId => {
                        const org = allOrgs.find(o => o.id === orgId)
                        return org ? (
                          <span key={orgId} style={{
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            padding: '6px 12px',
                            borderRadius: '16px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}>
                            {org.nom}
                            <button
                              onClick={() => setNewOrgIds(prev => prev.filter(id => id !== orgId))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: '1' }}
                            >
                              ×
                            </button>
                          </span>
                        ) : null
                      })}
                    </div>
                  </div>
                )}

                {showNewOrgInput && (
                  <div style={{ marginTop: '12px' }}>
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={e => setNewOrgName(e.target.value)}
                      placeholder="Nom de la nouvelle organisation"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        marginBottom: '8px',
                        boxSizing: 'border-box',
                      }}
                    />

                    {newOrgName.trim() !== '' && (
                      <div style={{ marginBottom: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                          Nouvelle organisation à créer lors de la sauvegarde:
                        </p>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '13px',
                          fontWeight: 500,
                          border: '1px dashed #f59e0b',
                        }}>
                          + {newOrgName.trim()}
                          <span style={{ fontSize: '11px', opacity: 0.75 }}>(nouvelle)</span>
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => { setShowNewOrgInput(false); setNewOrgName('') }}
                      style={{
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        color: '#374151',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── 10. Langues ── */}
          <Section title="Langues" icon="🌐">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Langues parlées
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {allLangues.filter(langue => myLangueIds.includes(langue.id) && !removedLangueIds.includes(langue.id)).map(langue => (
                <span key={langue.id} style={{
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  {langue.nom}
                  <button
                    onClick={() => setRemovedLangueIds(prev => [...prev, langue.id])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0369a1',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '0',
                      lineHeight: '1',
                    }}
                    title="Retirer"
                  >×</button>
                </span>
              ))}
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Ajouter une langue
              </label>

              {/* Langues épinglées */}
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Langues courantes:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {LANGUES_EPINGLEES.map(nomLangue => {
                    const langue = allLangues.find(l => l.nom === nomLangue)
                    if (!langue || (myLangueIds.includes(langue.id) && !removedLangueIds.includes(langue.id)) || newLangueIds.includes(langue.id)) return null
                    return (
                      <button
                        key={langue.id}
                        onClick={() => setNewLangueIds(prev => [...prev, langue.id])}
                        style={{
                          backgroundColor: 'white',
                          border: '1px solid #d1d5db',
                          color: '#374151',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          fontWeight: '500',
                        }}
                      >
                        + {langue.nom}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Autres langues — dropdown */}
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Autres langues:</p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        setNewLangueIds(prev => [...prev, e.target.value])
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#374151',
                      backgroundColor: 'white',
                      minWidth: '200px',
                    }}
                  >
                    <option value="">— Sélectionner une langue —</option>
                    {allLangues
                      .filter(langue => !LANGUES_EPINGLEES.includes(langue.nom) && (!myLangueIds.includes(langue.id) || removedLangueIds.includes(langue.id)) && !newLangueIds.includes(langue.id))
                      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
                      .map(langue => (
                        <option key={langue.id} value={langue.id}>{langue.nom}</option>
                      ))
                    }
                  </select>
                  {!showNewLangueInput && (
                    <button
                      onClick={() => setShowNewLangueInput(true)}
                      style={{
                        backgroundColor: 'white',
                        border: '1px dashed #d1d5db',
                        color: '#6b7280',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + Autre
                    </button>
                  )}
                </div>
              </div>

              {newLangueIds.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>À ajouter lors de la sauvegarde:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {newLangueIds.map(langueId => {
                      const langue = allLangues.find(l => l.id === langueId)
                      return langue ? (
                        <span key={langueId} style={{
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          {langue.nom}
                          <button
                            onClick={() => setNewLangueIds(prev => prev.filter(id => id !== langueId))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: '1' }}
                          >
                            ×
                          </button>
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {showNewLangueInput && (
                <div style={{ marginTop: '12px' }}>
                  <input
                    type="text"
                    value={newLangueName}
                    onChange={e => setNewLangueName(e.target.value)}
                    placeholder="Nom de la langue"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      marginBottom: '8px',
                    }}
                  />
                  <button
                    onClick={() => setShowNewLangueInput(false)}
                    style={{
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      color: '#374151',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        </Section>
        </div>

        {/* ── Compétences RS (visible seulement si AQBRS sélectionné) ── */}
        {((myOrgIds.includes(AQBRS_ORG_ID) && !removedOrgIds.includes(AQBRS_ORG_ID)) || (myOrgIds.includes('demo-org-aqbrs') && !removedOrgIds.includes('demo-org-aqbrs')) || newOrgIds.includes(AQBRS_ORG_ID)) && (
        <Section title="Compétences en recherche et sauvetage" icon="🔍">
          <CheckboxGroup
            label="Niveau de compétence"
            options={OPTIONS.competence_rs}
            selected={dossier.competence_rs}
            onChange={v => updateDossier('competence_rs', v)}
          />
        </Section>
        )}

        {/* ── Groupe de recherche (visible seulement si AQBRS sélectionné) ── */}
        {((myOrgIds.includes(AQBRS_ORG_ID) && !removedOrgIds.includes(AQBRS_ORG_ID)) || (myOrgIds.includes('demo-org-aqbrs') && !removedOrgIds.includes('demo-org-aqbrs')) || newOrgIds.includes(AQBRS_ORG_ID)) && (
        <Section title="Groupe de recherche et sauvetage" icon="🏔️">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
              Membre d&apos;un groupe de Recherche et Sauvetage de l&apos;AQBRS
            </label>
            <select
              value={dossier.groupe_recherche}
              onChange={e => updateDossier('groupe_recherche', e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', color: '#374151', backgroundColor: 'white' }}
            >
              <option value="">Aucun / Non applicable</option>
              {groupesRS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </Section>
        )}

        {/* ── Préférence de tâches ── */}
        <Section
          title="Préférence de tâches en déploiement"
          icon="🎯"
          description="Lors d'un déploiement, les besoins évoluent d'une journée à l'autre. Nous prendrons votre préférence en compte dans la mesure du possible, mais nous ne pouvons garantir que votre affectation y correspondra toujours."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '8px' }}>
            {[
              { value: 'aucune', label: 'Pas de préférence — je suis disponible pour les deux types de tâches' },
              { value: 'terrain', label: 'Soutien aux opérations sur le terrain' },
              { value: 'sinistres', label: 'Soutien aux personnes sinistrées et aux populations vulnérables' },
            ].map(option => (
              <label
                key={option.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  cursor: 'pointer',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: `2px solid ${dossier.preference_tache === option.value ? '#1e3a5f' : '#e5e7eb'}`,
                  backgroundColor: dossier.preference_tache === option.value ? '#f0f4fa' : 'white',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="radio"
                  name="preference_tache"
                  value={option.value}
                  checked={dossier.preference_tache === option.value}
                  onChange={() => {
                    updateDossier('preference_tache', option.value)
                    if (option.value !== 'sinistres') {
                      updateDossier('preference_tache_commentaire', '')
                    }
                  }}
                  style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }}
                />
                <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>{option.label}</span>
              </label>
            ))}
          </div>

          {dossier.preference_tache === 'sinistres' && (
            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                Avez-vous une contrainte physique, médicale ou personnelle qui limite votre capacité à effectuer des tâches physiques exigeantes ?
              </label>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                Ex: transport de matériel lourd, travail en terrain difficile. Cette information nous aidera à vous affecter de façon appropriée. Laissez vide si aucune contrainte.
              </p>
              <textarea
                value={dossier.preference_tache_commentaire}
                onChange={e => updateDossier('preference_tache_commentaire', e.target.value)}
                placeholder="Décrivez votre contrainte si applicable..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#111827',
                  backgroundColor: 'white',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </Section>

        {/* ── 11. Commentaires ── */}
        <Section title="Commentaires" icon="💬">
          <TextArea
            label="Informations additionnelles"
            value={dossier.commentaire}
            onChange={v => updateDossier('commentaire', v)}
            placeholder="Toute information pertinente que vous souhaitez partager..."
            rows={5}
          />
        </Section>

        {/* ── 12. Confidentialité ── */}
        <Section title="Consentement" icon="✅">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: '#f9fafb', border: '1px solid transparent' }}>
              <input type="checkbox" checked={dossier.consentement_antecedents} onChange={e => updateDossier('consentement_antecedents', e.target.checked)}
                style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
              <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>J&apos;autorise l&apos;AQBRS à procéder à la vérification de mes antécédents judiciaires dans le cadre de mon processus d&apos;adhésion à la Réserve d&apos;Intervention d&apos;Urgence en Sécurité Civile.</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: '#f9fafb', border: '1px solid transparent' }}>
              <input type="checkbox" checked={dossier.confidentialite} onChange={e => updateDossier('confidentialite', e.target.checked)}
                style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
              <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>Je consens à ce que mes informations soient utilisées pour coordonner les opérations de la RIUSC</span>
            </label>
          </div>
        </Section>

        {/* ── Bouton de sauvegarde ── */}
        <div style={{
          position: 'fixed',
          bottom: user && 'isImpersonated' in user && user.isImpersonated ? 56 : 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTop: '1px solid #e5e7eb',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          zIndex: 100,
        }}>
          {saveMessage && (
            <div style={{
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              backgroundColor: saveMessage.type === 'success' ? '#d1fae5' : '#fef2f2',
              color: saveMessage.type === 'success' ? '#065f46' : '#dc2626',
              border: '1px solid ' + (saveMessage.type === 'success' ? '#6ee7b7' : '#fca5a5'),
              marginBottom: '8px',
              textAlign: 'center' as const,
              width: '100%',
              maxWidth: '400px',
            }}>
              {saveMessage.text}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={(!canSave && !saveMessage?.type) || saving || formationDialog.show}
            style={{
              backgroundColor: (canSave || saveMessage?.type) && !saving ? '#1e3a5f' : '#d1d5db',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '15px',
              fontWeight: '600',
              cursor: (canSave || saveMessage?.type) && !saving ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            {saving ? 'Sauvegarde en cours...' : 'Sauvegarder les modifications'}
          </button>

          {/* Dialog confirmation modification formations */}
          {formationDialog.show && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a5f', marginBottom: '16px' }}>Modifier vos formations</div>
                <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6', marginBottom: '8px' }}>
                  {formationDialog.removedLabels.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ marginBottom: '4px', fontWeight: '600' }}>Formations qui seront retirées :</p>
                      {formationDialog.removedLabels.map((label, i) => (
                        <p key={i} style={{ margin: '2px 0', paddingLeft: '12px' }}>• {label}</p>
                      ))}
                    </div>
                  )}
                  {formationDialog.addedLabels.length > 0 && (
                    <div>
                      <p style={{ marginBottom: '4px', fontWeight: '600' }}>Formations ajoutées :</p>
                      {formationDialog.addedLabels.map((label, i) => (
                        <p key={i} style={{ margin: '2px 0', paddingLeft: '12px' }}>• {label}</p>
                      ))}
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>Êtes-vous sûr de vouloir continuer ?</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setFormationDialog({ show: false, removedLabels: [], addedLabels: [], pendingSave: null }); setSaveMessage({ type: 'error', text: 'Modification annulée' }) }}
                    style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                  >Annuler</button>
                  <button
                    onClick={async () => { if (formationDialog.pendingSave) { await formationDialog.pendingSave() } setFormationDialog({ show: false, removedLabels: [], addedLabels: [], pendingSave: null }) }}
                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
                  >Oui, modifier</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      )}

    </div>
  )
}
