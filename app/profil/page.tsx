'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import ImageCropper from '@/app/components/ImageCropper'
import PortailHeader from '@/app/components/PortailHeader'
import { useAuth } from '@/utils/useAuth'
import ImpersonateBanner from '@/app/components/ImpersonateBanner'
import { logPageVisit } from '@/utils/logEvent'
import { isDemoActive, getDemoGroupe, DEMO_RESERVISTE, DEMO_USER } from '@/utils/demoMode'

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYXFicnMiLCJhIjoiY21sN2g0YW5hMG84NDNlb2EwdmI5NWZ0ayJ9.jsxH3ei2CqtShV8MrJ47XA'
const AQBRS_ORG_ID = 'bb948f22-a29e-42db-bdd9-aabab8a95abd'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reserviste {
  id: number
  benevole_id: string
  prenom: string
  nom: string
  email: string
  telephone?: string
  telephone_secondaire?: string
  date_naissance?: string
  adresse?: string
  ville?: string
  region?: string
  latitude?: number | null
  longitude?: number | null
  contact_urgence_nom?: string
  contact_urgence_telephone?: string
  contact_urgence_lien?: string
  contact_urgence_courriel?: string
  groupe?: string
  photo_url?: string
}

interface Organisation {
  id: string
  nom: string
}

interface Langue {
  id: string
  nom: string
}

interface MapboxFeature {
  place_name: string
  center: [number, number]
  context?: Array<{
    id: string
    text: string
  }>
}

interface DossierData {
  prenom: string
  nom: string
  email: string
  date_naissance: string
  grandeur_bottes: string
  profession: string
  j_ai_18_ans: boolean
  allergies_alimentaires: string
  allergies_autres: string
  problemes_sante: string
  groupe_sanguin: string
  competence_rs: number[]
  certificat_premiers_soins: number[]
  date_expiration_certificat: string
  vehicule_tout_terrain: number[]
  navire_marin: number[]
  permis_conduire: number[]
  disponible_covoiturage: number[]
  satp_drone: number[]
  equipe_canine: number[]
  competences_securite: number[]
  competences_sauvetage: number[]
  certification_csi: number[]
  communication: number[]
  cartographie_sig: number[]
  operation_urgence: number[]
  autres_competences: string
  commentaire: string
  confidentialite: boolean
}

// ─── OPTIONS ─────────────────────────────────────────────────────────────────

const GROUPES_SANGUIN = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu']

const GROUPE_SANGUIN_MAP: Record<string, number> = {
  'A+': 1,
  'B+': 2,
  'A-': 3,
  'A−': 3,
  'B-': 4,
  'B−': 4,
  'AB+': 5,
  'AB-': 6,
  'AB−': 6,
  'O+': 7,
  'O-': 8,
  'O−': 8,
}

const GROUPE_SANGUIN_REVERSE: Record<number, string> = {
  1: 'A+',
  2: 'B+',
  3: 'A-',
  4: 'B-',
  5: 'AB+',
  6: 'AB-',
  7: 'O+',
  8: 'O-',
}

const LANGUES_EPINGLEES = ['Anglais', 'Espagnol', 'Français']

const OPTIONS: Record<string, { id: number; label: string }[]> = {
  competence_rs: [
    { id: 1, label: 'Niveau 1 - Équipier' },
    { id: 2, label: "Niveau 2 - Chef d'équipe" },
    { id: 3, label: 'Niveau 3 - Responsable des opérations' },
  ],
  certificat_premiers_soins: [
    { id: 1, label: 'a) RCR/DEA (4-6h) certificat' },
    { id: 2, label: 'b) Premiers soins standard (8-16h)' },
    { id: 3, label: 'c) Secourisme en milieu de travail (16h)' },
    { id: 4, label: 'd) Secourisme en milieu éloigné (20-40h)' },
    { id: 5, label: 'e) Premier répondant (80-120h)' },
  ],
  vehicule_tout_terrain: [
    { id: 1, label: 'VTT' },
    { id: 2, label: 'Motoneige' },
    { id: 3, label: 'Argo' },
    { id: 4, label: 'Côte à côte' },
  ],
  navire_marin: [
    { id: 1, label: "Permis d'embarcation de plaisance" },
    { id: 2, label: 'Petits bateaux' },
  ],
  permis_conduire: [
    { id: 1, label: 'Classe 5 Voiture (classe G Ontario)' },
    { id: 2, label: 'Classe 4b Autobus (4-14 passagers)' },
    { id: 3, label: 'Classe 2 Autobus (24+ passagers)' },
    { id: 4, label: 'Classe 1 Ensemble de véhicules routiers' },
    { id: 5, label: "Classe 4a Véhicule d'urgence" },
    { id: 6, label: 'Classe 3 Camions' },
    { id: 7, label: 'Classe 6 Motocyclette' },
  ],
  disponible_covoiturage: [
    { id: 1, label: 'Je peux transporter des gens' },
  ],
  satp_drone: [
    { id: 4, label: 'Utilisation de drone (petit drone de moins de 250g)' },
    { id: 5, label: 'Licence de pilote de drone (Transport Canada)' },
  ],
  equipe_canine: [
    { id: 1, label: 'Ratissage' },
    { id: 2, label: 'Pistage' },
    { id: 3, label: 'Avalanche' },
    { id: 4, label: 'Décombres' },
  ],
  competences_securite: [
    { id: 1, label: 'Scies à chaînes' },
    { id: 2, label: 'Contrôle de la circulation routière' },
    { id: 3, label: 'Formateur certifié CNESST' },
  ],
  competences_sauvetage: [
    { id: 1, label: 'Sauvetage sur corde' },
    { id: 2, label: 'Sauvetage en eau vive' },
    { id: 3, label: 'Sauvetage sur glace' },
    { id: 4, label: 'Sauvetage en hauteur' },
  ],
  certification_csi: [
    { id: 1, label: 'Certification CSI (Centre de services incendie)' },
  ],
  communication: [
    { id: 2, label: 'Radio amateur' },
    { id: 3, label: 'Téléphonie satellite' },
  ],
  cartographie_sig: [
    { id: 1, label: 'Lecture de cartes topographiques' },
    { id: 2, label: 'Utilisation GPS' },
    { id: 3, label: 'SIG (Système d\'information géographique)' },
  ],
  operation_urgence: [
    { id: 1, label: 'Gestion des opérations d\'urgence' },
    { id: 2, label: 'Planification de continuité' },
  ],
}

// ─── Conversion labels ↔ IDs (Supabase stocke les labels, UI utilise les IDs) ─
function labelsToIds(field: string, labels: string[] | null): number[] {
  if (!labels || labels.length === 0) return []
  const opts = OPTIONS[field]
  if (!opts) return []
  return labels.map(label => {
    // Match exact
    const exact = opts.find(o => o.label === label)
    if (exact) return exact.id
    // Match si l'ancien label contenait " / English" — comparer la partie française (insensible à la casse)
    const frPart = label.split(' / ')[0].trim().toLowerCase()
    const partial = opts.find(o => o.label.toLowerCase() === frPart || o.label.toLowerCase().startsWith(frPart))
    return partial ? partial.id : null
  }).filter((id): id is number => id !== null)
}

function idsToLabels(field: string, ids: number[]): string[] {
  if (!ids || ids.length === 0) return []
  const opts = OPTIONS[field]
  if (!opts) return []
  return ids.map(id => {
    const opt = opts.find(o => o.id === id)
    return opt ? opt.label : null
  }).filter((label): label is string => label !== null)
}

// ─── Fonctions utilitaires ──────────────────────────────────────────────────

function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

function cleanPhoneForSave(phone: string): string {
  return phone.replace(/\D/g, '')
}

function isOlderThan18(dateNaissance: string): boolean {
  if (!dateNaissance) return true
  const birthDate = new Date(dateNaissance)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 18
  }
  return age >= 18
}

// ─── Composants UI ───────────────────────────────────────────────────────────

const Section = ({ title, icon, description, confidential, children }: {
  title: string
  icon?: string
  description?: string
  confidential?: boolean
  children: React.ReactNode
}) => (
  <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: description ? '8px' : '20px' }}>
      {icon && <span style={{ fontSize: '24px' }}>{icon}</span>}
      <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>{title}</h2>
      {confidential && (
        <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '4px 10px', borderRadius: '12px', fontWeight: '500' }}>
          🔒 Confidentiel
        </span>
      )}
    </div>
    {description && (
      <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '0', marginBottom: '20px', lineHeight: '1.5' }}>
        {description}
      </p>
    )}
    {children}
  </div>
)

const TextInput = ({ label, value, onChange, disabled, placeholder, type = 'text', inputRef }: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  type?: string
  inputRef?: React.RefObject<HTMLInputElement>
}) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
      {label}
    </label>
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '14px',
        color: disabled ? '#9ca3af' : '#111827',
        backgroundColor: disabled ? '#f9fafb' : 'white',
        boxSizing: 'border-box',
      }}
    />
  </div>
)

const TextArea = ({ label, value, onChange, placeholder, rows = 3 }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
      {label}
    </label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
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
)

const Checkbox = ({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151', marginBottom: '12px' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
      style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
    {label}
  </label>
)

const CheckboxGroup = ({ label, options, selected, onChange }: {
  label: string
  options: { id: number; label: string }[]
  selected: number[]
  onChange: (selected: number[]) => void
}) => (
  <div style={{ marginBottom: '20px' }}>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
      {label}
    </label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {options.map(opt => (
        <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
          <input
            type="checkbox"
            checked={selected.includes(opt.id)}
            onChange={e => {
              if (e.target.checked) {
                onChange([...selected, opt.id])
              } else {
                onChange(selected.filter(id => id !== opt.id))
              }
            }}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  </div>
)

// ─── Composant principal ────────────────────────────────────────────────────

export default function ProfilPage() {
  const router = useRouter()
  const supabase = createClient()

  // Hook d'authentification avec support emprunt
  const { user: authUser, loading: authLoading } = useAuth()

  // États généraux
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    autres_competences: '',
    commentaire: '',
    confidentialite: false,
  })
  const [originalDossier, setOriginalDossier] = useState<DossierData>(dossier)

  // États pour les champs Profil (Supabase)
  const [profilData, setProfilData] = useState({
    telephone: '',
    telephone_secondaire: '',
    adresse: '',
    ville: '',
    region: '',
    latitude: null as number | null,
    longitude: null as number | null,
    contact_urgence_nom: '',
    contact_urgence_telephone: '',
    contact_urgence_lien: '',
    contact_urgence_courriel: '',
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

  const [villeSuggestions, setVilleSuggestions] = useState<Array<{ municipalite: string; region_administrative: string; mrc: string }>>([])
  const [showVilleSuggestions, setShowVilleSuggestions] = useState(false)
  const [isLoadingVille, setIsLoadingVille] = useState(false)
  const villeInputRef = useRef<HTMLInputElement>(null)
  const villeDropdownRef = useRef<HTMLDivElement>(null)
  const villeDebounceRef = useRef<NodeJS.Timeout | null>(null)

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
              region: fullData.region || '',
              latitude: fullData.latitude || null,
              longitude: fullData.longitude || null,
              contact_urgence_nom: fullData.contact_urgence_nom || '',
              contact_urgence_telephone: formatPhoneDisplay(fullData.contact_urgence_telephone || ''),
              contact_urgence_lien: fullData.contact_urgence_lien || '',
              contact_urgence_courriel: fullData.contact_urgence_courriel || '',
            })

            setOriginalProfilData({
              telephone: formatPhoneDisplay(fullData.telephone || ''),
              telephone_secondaire: formatPhoneDisplay(fullData.telephone_secondaire || ''),
              adresse: fullData.adresse || '',
              ville: fullData.ville || '',
              region: fullData.region || '',
              latitude: fullData.latitude || null,
              longitude: fullData.longitude || null,
              contact_urgence_nom: fullData.contact_urgence_nom || '',
              contact_urgence_telephone: formatPhoneDisplay(fullData.contact_urgence_telephone || ''),
              contact_urgence_lien: fullData.contact_urgence_lien || '',
              contact_urgence_courriel: fullData.contact_urgence_courriel || '',
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
              autres_competences: d.autres_competences || '',
              commentaire: d.commentaire || '',
              confidentialite: d.confidentialite || false,
            }
            setDossier(loaded)
            setOriginalDossier(loaded)

            // Charger organisations et langues
            const { data: orgsData } = await supabase.from('organisations').select('id, nom').order('nom')
            setAllOrgs(orgsData || [])
            const { data: languesData } = await supabase.from('langues').select('id, nom').order('nom')
            setAllLangues(languesData || [])

            logPageVisit('/profil')
            setLoading(false)
            return
          }
        }
      }

      if (!authUser) {
        // Mode démo : charger données fictives
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
            region: demoRes.region || '',
            latitude: null,
            longitude: null,
            contact_urgence_nom: demoRes.contact_urgence_nom || '',
            contact_urgence_telephone: '(418) 555-9876',
            contact_urgence_lien: 'Conjoint',
            contact_urgence_courriel: 'jean.tremblay@example.com',
          })
          setOriginalProfilData({
            telephone: '(418) 555-1234',
            telephone_secondaire: '',
            adresse: demoRes.adresse || '',
            ville: demoRes.ville || '',
            region: demoRes.region || '',
            latitude: null,
            longitude: null,
            contact_urgence_nom: demoRes.contact_urgence_nom || '',
            contact_urgence_telephone: '(418) 555-9876',
            contact_urgence_lien: 'Conjoint',
            contact_urgence_courriel: 'jean.tremblay@example.com',
          })
          setDossier({
            prenom: demoRes.prenom, nom: demoRes.nom, email: demoRes.email,
            date_naissance: demoRes.date_naissance || '', grandeur_bottes: '10', profession: 'Technicienne en environnement', j_ai_18_ans: true,
            allergies_alimentaires: demoRes.allergies_alimentaires || '', allergies_autres: '', problemes_sante: '', groupe_sanguin: 'O+',
            competence_rs: [], certificat_premiers_soins: [], date_expiration_certificat: '',
            vehicule_tout_terrain: [], navire_marin: [], permis_conduire: [], disponible_covoiturage: [],
            satp_drone: [], equipe_canine: [], competences_securite: [], competences_sauvetage: [],
            certification_csi: [], communication: [], cartographie_sig: [], operation_urgence: [],
            autres_competences: '', commentaire: '', confidentialite: true,
          })
          setOriginalDossier({
            prenom: demoRes.prenom, nom: demoRes.nom, email: demoRes.email,
            date_naissance: demoRes.date_naissance || '', grandeur_bottes: '10', profession: 'Technicienne en environnement', j_ai_18_ans: true,
            allergies_alimentaires: demoRes.allergies_alimentaires || '', allergies_autres: '', problemes_sante: '', groupe_sanguin: 'O+',
            competence_rs: [], certificat_premiers_soins: [], date_expiration_certificat: '',
            vehicule_tout_terrain: [], navire_marin: [], permis_conduire: [], disponible_covoiturage: [],
            satp_drone: [], equipe_canine: [], competences_securite: [], competences_sauvetage: [],
            certification_csi: [], communication: [], cartographie_sig: [], operation_urgence: [],
            autres_competences: '', commentaire: '', confidentialite: true,
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
        region: reservisteData.region || '',
        latitude: reservisteData.latitude || null,
        longitude: reservisteData.longitude || null,
        contact_urgence_nom: reservisteData.contact_urgence_nom || '',
        contact_urgence_telephone: formatPhoneDisplay(reservisteData.contact_urgence_telephone),
        contact_urgence_lien: reservisteData.contact_urgence_lien || '',
        contact_urgence_courriel: reservisteData.contact_urgence_courriel || '',
      })

      setOriginalProfilData({
        telephone: formatPhoneDisplay(reservisteData.telephone),
        telephone_secondaire: formatPhoneDisplay(reservisteData.telephone_secondaire),
        adresse: reservisteData.adresse || '',
        ville: reservisteData.ville || '',
        region: reservisteData.region || '',
        latitude: reservisteData.latitude || null,
        longitude: reservisteData.longitude || null,
        contact_urgence_nom: reservisteData.contact_urgence_nom || '',
        contact_urgence_telephone: formatPhoneDisplay(reservisteData.contact_urgence_telephone),
        contact_urgence_lien: reservisteData.contact_urgence_lien || '',
        contact_urgence_courriel: reservisteData.contact_urgence_courriel || '',
      })

      // Charger organisations
      const { data: orgsData } = await supabase.from('organisations').select('id, nom').order('nom')
      setAllOrgs(orgsData || [])
      
      const { data: myOrgsData } = await supabase
        .from('reserviste_organisations')
        .select('organisation_id')
        .eq('benevole_id', reservisteData.benevole_id)
      const linkedOrgIds = (myOrgsData || []).map(r => r.organisation_id)
      setMyOrgIds(linkedOrgIds)

      // Charger langues
      const { data: languesData } = await supabase.from('langues').select('id, nom').order('nom')
      setAllLangues(languesData || [])

      const { data: myLanguesData } = await supabase
        .from('reserviste_langues')
        .select('langue_id')
        .eq('benevole_id', reservisteData.benevole_id)
      setMyLangueIds((myLanguesData || []).map(r => r.langue_id))

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
        autres_competences: d.autres_competences || '',
        commentaire: d.commentaire || '',
        confidentialite: d.confidentialite || false,
      }
      setDossier(loaded)
      setOriginalDossier(loaded)

      // Backfill AQBRS si compétence RS remplie
      if ((d.competence_rs || []).length > 0 && !linkedOrgIds.includes(AQBRS_ORG_ID)) {
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
    if (feature.context) {
      const placeContext = feature.context.find(c => c.id.startsWith('place'))
      if (placeContext) {
        ville = placeContext.text
      }
    }

    setProfilData(prev => ({
      ...prev,
      adresse: feature.place_name,
      latitude: lat,
      longitude: lng,
      ville: ville || prev.ville
    }))
    setShowAddressSuggestions(false)
    setAddressSuggestions([])

    if (ville) {
      lookupRegionFromVille(ville)
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

  const selectVille = (suggestion: { municipalite: string; region_administrative: string; mrc: string }) => {
    setProfilData(prev => ({
      ...prev,
      ville: suggestion.municipalite,
      region: suggestion.region_administrative
    }))
    setShowVilleSuggestions(false)
    setVilleSuggestions([])
  }

  const lookupRegionFromVille = async (ville: string) => {
    if (!ville) return
    const { data } = await supabase
      .from('municipalites_qc')
      .select('region_administrative')
      .ilike('municipalite', ville)
      .limit(1)
      .single()
    if (data) {
      setProfilData(prev => ({ ...prev, region: data.region_administrative }))
    }
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
        .eq('id', reserviste.id)

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

  // ─── Sauvegarde ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!reserviste) return
    if (isDemoActive()) { setSaveMessage({ type: 'success', text: 'Mode démonstration — les modifications ne sont pas enregistrées.' }); return }
    setSaving(true)
    setSaveMessage(null)

    try {
      // 1. Sauvegarder les champs Profil dans Supabase
      if (profilHasChanges) {
        const { error: updateError } = await supabase
          .from('reservistes')
          .update({
            telephone: cleanPhoneForSave(profilData.telephone),
            telephone_secondaire: cleanPhoneForSave(profilData.telephone_secondaire),
            adresse: profilData.adresse,
            ville: profilData.ville,
            region: profilData.region,
            latitude: profilData.latitude,
            longitude: profilData.longitude,
            contact_urgence_nom: profilData.contact_urgence_nom,
            contact_urgence_telephone: cleanPhoneForSave(profilData.contact_urgence_telephone),
            contact_urgence_lien: profilData.contact_urgence_lien,
            contact_urgence_courriel: profilData.contact_urgence_courriel,
          })
          .eq('id', reserviste.id)

        if (updateError) {
          console.error('Erreur update Supabase:', updateError)
          setSaveMessage({ type: 'error', text: 'Erreur lors de la sauvegarde des informations de contact' })
          setSaving(false)
          return
        }

        // Sync vers Monday via webhook
        await fetch('https://n8n.aqbrs.ca/webhook/riusc-sync-profil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            prenom: dossier.prenom,
            nom: dossier.nom,
            email: dossier.email,
            telephone: cleanPhoneForSave(profilData.telephone),
            telephone_secondaire: cleanPhoneForSave(profilData.telephone_secondaire),
            date_naissance: dossier.date_naissance,
            adresse: profilData.adresse,
            ville: profilData.ville,
            region: profilData.region,
            latitude: profilData.latitude,
            longitude: profilData.longitude,
            contact_urgence_nom: profilData.contact_urgence_nom,
            contact_urgence_telephone: cleanPhoneForSave(profilData.contact_urgence_telephone),
            contact_urgence_lien: profilData.contact_urgence_lien,
            contact_urgence_courriel: profilData.contact_urgence_courriel,
          })
        })

        setOriginalProfilData({ ...profilData })
      }

      // 2. Sauvegarder le dossier dans Supabase
      if (hasChanges) {
        const { error: dossierError } = await supabase
          .from('reservistes')
          .update({
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
            autres_competences: dossier.autres_competences || null,
            commentaire: dossier.commentaire || null,
            confidentialite: dossier.confidentialite,
          })
          .eq('id', reserviste.id)

        if (dossierError) {
          console.error('Erreur update dossier Supabase:', dossierError)
          setSaveMessage({ type: 'error', text: 'Erreur lors de la sauvegarde du dossier' })
          setSaving(false)
          return
        }

        // Fire-and-forget sync vers Monday
        fetch('https://n8n.aqbrs.ca/webhook/riusc-update-dossier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            dossier: {
              prenom: dossier.prenom,
              nom: dossier.nom,
              email: dossier.email,
              date_naissance: dossier.date_naissance,
              grandeur_bottes: dossier.grandeur_bottes,
              profession: dossier.profession,
              j_ai_18_ans: dossier.j_ai_18_ans,
              allergies_alimentaires: dossier.allergies_alimentaires,
              allergies_autres: dossier.allergies_autres,
              problemes_sante: dossier.problemes_sante,
              groupe_sanguin: dossier.groupe_sanguin && GROUPE_SANGUIN_MAP[dossier.groupe_sanguin] ? [GROUPE_SANGUIN_MAP[dossier.groupe_sanguin]] : [],
              competence_rs: dossier.competence_rs,
              certificat_premiers_soins: dossier.certificat_premiers_soins,
              date_expiration_certificat: dossier.date_expiration_certificat,
              vehicule_tout_terrain: dossier.vehicule_tout_terrain,
              navire_marin: dossier.navire_marin,
              permis_conduire: dossier.permis_conduire,
              disponible_covoiturage: dossier.disponible_covoiturage,
              satp_drone: dossier.satp_drone,
              equipe_canine: dossier.equipe_canine,
              competences_securite: dossier.competences_securite,
              competences_sauvetage: dossier.competences_sauvetage,
              certification_csi: dossier.certification_csi,
              communication: dossier.communication,
              cartographie_sig: dossier.cartographie_sig,
              operation_urgence: dossier.operation_urgence,
              autres_competences: dossier.autres_competences,
              commentaire: dossier.commentaire,
              confidentialite: dossier.confidentialite,
            }
          })
        }).catch(() => {}) // fire-and-forget

        setOriginalDossier({ ...dossier })
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
        if (newOrgName.trim()) {
          const { data: createdOrg, error: createError } = await supabase
            .from('organisations').insert({ nom: newOrgName.trim(), created_by: reserviste.benevole_id }).select('id').single()
          if (createError) {
            const { data: existingOrg } = await supabase.from('organisations').select('id').ilike('nom', newOrgName.trim()).single()
            if (existingOrg) orgIdsToAdd.push(existingOrg.id)
          } else if (createdOrg) {
            orgIdsToAdd.push(createdOrg.id)
          }
        }
        const uniqueOrgs = orgIdsToAdd.filter(id => !myOrgIds.includes(id))
        if (uniqueOrgs.length > 0) {
          await supabase.from('reserviste_organisations').insert(
            uniqueOrgs.map(organisation_id => ({ benevole_id: reserviste.benevole_id, organisation_id }))
          )
        }
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
  const canSave = hasChanges || profilHasChanges || orgHasChanges || langueHasChanges

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <PortailHeader subtitle="Mon profil" />

      <ImpersonateBanner />

      {saveMessage && (
        <div style={{ maxWidth: '860px', margin: '16px auto 0', padding: '0 24px' }}>
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            backgroundColor: saveMessage.type === 'success' ? '#d1fae5' : '#fef2f2',
            color: saveMessage.type === 'success' ? '#065f46' : '#dc2626',
            border: `1px solid ${saveMessage.type === 'success' ? '#6ee7b7' : '#fca5a5'}`
          }}>
            {saveMessage.text}
          </div>
        </div>
      )}

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour à l&apos;accueil</a>
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
            onChange={v => updateDossier('email', v)}
            type="email"
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 24px' }}>
            <TextInput
              label="Téléphone principal"
              value={profilData.telephone}
              onChange={v => setProfilData(prev => ({ ...prev, telephone: v }))}
              placeholder="(555) 123-4567"
            />
            <TextInput
              label="Téléphone secondaire"
              value={profilData.telephone_secondaire}
              onChange={v => setProfilData(prev => ({ ...prev, telephone_secondaire: v }))}
              placeholder="(555) 987-6543"
            />
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

            <TextInput
              label="Région"
              value={profilData.region}
              onChange={v => setProfilData(prev => ({ ...prev, region: v }))}
              placeholder="Montréal"
            />
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
              onChange={v => setProfilData(prev => ({ ...prev, contact_urgence_telephone: v }))}
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
          <CheckboxGroup
            label="Certification CSI"
            options={OPTIONS.certification_csi}
            selected={dossier.certification_csi}
            onChange={v => updateDossier('certification_csi', v)}
          />
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
            label="Opérations d'urgence"
            options={OPTIONS.operation_urgence}
            selected={dossier.operation_urgence}
            onChange={v => updateDossier('operation_urgence', v)}
          />
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
                  <span key={org.id} style={{
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
                    {org.nom}
                    <button
                      onClick={() => setRemovedOrgIds(prev => [...prev, org.id])}
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
                      .sort((a, b) => a.nom.localeCompare(b.nom))
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
                      }}
                    />
                    <button
                      onClick={() => setShowNewOrgInput(false)}
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
                      .sort((a, b) => a.nom.localeCompare(b.nom))
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
          <Checkbox
            label="Je consens à ce que mes informations soient utilisées pour coordonner les opérations de recherche et sauvetage"
            checked={dossier.confidentialite}
            onChange={v => updateDossier('confidentialite', v)}
          />
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
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              backgroundColor: canSave && !saving ? '#1e3a5f' : '#d1d5db',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '15px',
              fontWeight: '600',
              cursor: canSave && !saving ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            {saving ? 'Sauvegarde en cours...' : 'Sauvegarder les modifications'}
          </button>
        </div>
      </main>

      <ImpersonateBanner position="bottom" />
    </div>
  )
}
