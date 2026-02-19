'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PortailHeader from '@/app/components/PortailHeader'

const AQBRS_ORG_ID = 'bb948f22-a29e-42db-bdd9-aabab8a95abd'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reserviste {
  benevole_id: string
  prenom: string
  nom: string
  email: string
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

interface DossierData {
  prenom: string
  nom: string
  email: string
  date_naissance: string
  grandeur_bottes: string
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

// Mapping Monday.com pour groupe sanguin (IDs)
const GROUPE_SANGUIN_MAP: Record<string, number> = {
  'A+': 1,
  'B+': 2,
  'A-': 3,
  'A−': 3,  // Unicode minus
  'B-': 4,
  'B−': 4,  // Unicode minus
  'AB+': 5,
  'AB-': 6,
  'AB−': 6, // Unicode minus
  'O+': 7,
  'O-': 8,
  'O−': 8,  // Unicode minus
}

// Reverse mapping (ID → Label)
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

// Langues épinglées en haut
const LANGUES_EPINGLEES = ['Anglais', 'Espagnol', 'Français']

const OPTIONS: Record<string, { id: number; label: string }[]> = {
  competence_rs: [
    { id: 1, label: 'Niveau 1 - Équipier' },
    { id: 2, label: "Niveau 2 - Chef d'équipe" },
    { id: 3, label: 'Niveau 3 - Responsable des opérations' },
  ],
  certificat_premiers_soins: [
    { id: 1, label: 'a) RCR/DEA (4-6h) certificat' },
    { id: 2, label: 'b) Premiers soins standard (8-16h) / Standard first aid' },
    { id: 3, label: 'c) Secourisme en milieu de travail (16h) / First aid in the workplace' },
    { id: 4, label: 'd) Secourisme en milieu éloigné (20-40h) / Wilderness first aid' },
    { id: 5, label: 'e) Premier répondant (80-120h) / First responder' },
  ],
  vehicule_tout_terrain: [
    { id: 1, label: 'VTT / ATV' },
    { id: 2, label: 'Motoneige / Snowmobile' },
    { id: 3, label: 'Argo' },
    { id: 4, label: 'Côte à côte / Side by side' },
  ],
  navire_marin: [
    { id: 1, label: "Permis d'embarcation de plaisance" },
    { id: 2, label: 'Petits bateaux / Small craft' },
  ],
  permis_conduire: [
    { id: 1, label: 'Classe 5 Voiture (G ontario) / Car' },
    { id: 2, label: 'Classe 4b Autobus (4-14 passagers) / Bus (4-14 passengers)' },
    { id: 3, label: 'Classe 2 Autobus (24+ passager) / Bus (24+ passenger)' },
    { id: 4, label: 'Classe 1 Ensemble de véhicules routiers / Heavy vehicle' },
    { id: 5, label: "Classe 4a Véhicule d'urgence / Emergency vehicle" },
    { id: 6, label: 'Classe 3 Camions / Trucks' },
    { id: 7, label: 'Classe 6 Motocyclette / Motocycle' },
  ],
  disponible_covoiturage: [
    { id: 1, label: 'Je peux transporter des gens / I can transport people' },
  ],
  satp_drone: [
    { id: 1, label: 'Observateur / Observer' },
    { id: 2, label: 'Opérations de base / Basic operations' },
    { id: 3, label: 'Opérations avancées / Advanced operations' },
  ],
  equipe_canine: [
    { id: 1, label: 'Ratissage / Area search' },
    { id: 2, label: 'Pistage / Trailing-Tracking' },
    { id: 3, label: 'Avalanche' },
    { id: 4, label: 'Décombres / Disaster' },
  ],
  competences_securite: [
    { id: 1, label: 'Scies à chaînes / Chainsaw' },
    { id: 2, label: 'Contrôle de la circulation routière / Traffic control' },
  ],
  competences_sauvetage: [
    { id: 1, label: 'Sauvetage sur corde / Rope rescue' },
    { id: 2, label: 'Sauvetage en eau vive / Swift water rescue' },
    { id: 3, label: 'Sauvetage sur glace / Ice rescue' },
  ],
  certification_csi: [
    { id: 1, label: 'SCI / ICS 100' },
    { id: 2, label: 'SCI / ICS 200' },
    { id: 3, label: 'SCI / ICS 300' },
    { id: 4, label: 'SCI / ICS 400' },
  ],
  communication: [
    { id: 1, label: 'Radio aéronautique / Aeronautical radio' },
    { id: 2, label: 'Radio maritime / Maritime radio' },
    { id: 3, label: 'Radio amateur / Amateur radio' },
    { id: 4, label: 'Radio générale opérateur / General radio operator' },
    { id: 5, label: 'Radio restreinte / Restricted radio' },
    { id: 6, label: 'PCRS / GSAR Radio operator' },
    { id: 7, label: "Télécommunication d'urgence / Emergency telecommunication" },
  ],
  cartographie_sig: [
    { id: 1, label: 'ArcGIS Pro' },
    { id: 2, label: 'ArcGIS Online' },
    { id: 3, label: 'ArcGIS QuickCapture (Mobile)' },
    { id: 4, label: 'Caltopo - Sartopo' },
    { id: 5, label: 'Sartrack' },
    { id: 6, label: 'Autre / Other' },
  ],
  operation_urgence: [
    { id: 1, label: "Gestion de l'hébergement / Shelter management" },
    { id: 2, label: 'Gestion de point de service / Service point management' },
    { id: 3, label: 'Accueil et inscription / Reception and registration' },
    { id: 4, label: 'Alimentation / Food services' },
    { id: 5, label: 'Services aux sinistrés / Victim services' },
    { id: 6, label: 'Aide psychosociale / Psychosocial support' },
    { id: 7, label: 'Gestion des dons / Donation management' },
    { id: 8, label: 'Soutien logistique / Logistical support' },
    { id: 9, label: 'Analyse et évaluation / Analysis and evaluation' },
    { id: 10, label: 'Animaux / Animals' },
  ],
}

const DEFAULT_DOSSIER: DossierData = {
  prenom: '', nom: '', email: '', date_naissance: '',
  grandeur_bottes: '', j_ai_18_ans: false,
  allergies_alimentaires: '', allergies_autres: '', problemes_sante: '', groupe_sanguin: '',
  competence_rs: [],
  certificat_premiers_soins: [], date_expiration_certificat: '',
  vehicule_tout_terrain: [], navire_marin: [], permis_conduire: [], disponible_covoiturage: [],
  satp_drone: [], equipe_canine: [], competences_securite: [], competences_sauvetage: [],
  certification_csi: [],
  communication: [], cartographie_sig: [], operation_urgence: [],
  autres_competences: '', commentaire: '', confidentialite: false,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOlderThan18(dateStr: string): boolean {
  if (!dateStr) return false
  const dob = new Date(dateStr)
  if (isNaN(dob.getTime())) return false
  const today = new Date()
  const age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  return age > 18 || (age === 18 && (m > 0 || (m === 0 && today.getDate() >= dob.getDate())))
}

function checkboxRow(selected: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
    borderRadius: '8px', cursor: 'pointer',
    backgroundColor: selected ? '#eff6ff' : '#f9fafb',
    border: selected ? '1px solid #bfdbfe' : '1px solid transparent',
    transition: 'background-color 0.15s',
  }
}

// ─── Composants UI ───────────────────────────────────────────────────────────

function Section({ title, icon, description, children, confidential }: {
  title: string; icon: string; description?: string; children: React.ReactNode; confidential?: boolean
}) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', paddingBottom: '10px', borderBottom: '2px solid #1e3a5f' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#1e3a5f' }}>{title}</h2>
      </div>
      {description && (
        <p style={{ margin: '6px 0 14px 0', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>{description}</p>
      )}
      {confidential && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', marginBottom: '14px' }}>
          <span style={{ fontSize: '14px' }}>🔒</span>
          <p style={{ margin: 0, fontSize: '12px', color: '#0369a1' }}>
            Ces informations sont strictement confidentielles et ne seront utilisées qu&apos;en cas de déploiement, afin d&apos;assurer votre sécurité et celle de votre équipe.
          </p>
        </div>
      )}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, disabled, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; type?: string
}) {
  const base: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#111827', backgroundColor: disabled ? '#f3f4f6' : 'white', boxSizing: 'border-box', cursor: disabled ? 'not-allowed' : 'text' }
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={base} />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#111827', resize: 'vertical', boxSizing: 'border-box' as const }} />
    </div>
  )
}

function RadioGroupId({ label, options, value, onChange }: {
  label: string; options: { id: number; label: string }[]; value: number[]; onChange: (v: number[]) => void
}) {
  const selectedId = value[0] || 0
  return (
    <div style={{ marginBottom: '16px' }}>
      {label && <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{label}</label>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {options.map(opt => (
          <label key={opt.id} style={checkboxRow(selectedId === opt.id)}>
            <input type="radio" checked={selectedId === opt.id} name={label} onChange={() => onChange([opt.id])} style={{ accentColor: '#1e3a5f', width: '16px', height: '16px', flexShrink: 0 }} />
            <span style={{ fontSize: '14px', color: '#374151' }}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function CheckboxGroupId({ label, options, values, onChange, columns = 1 }: {
  label: string; options: { id: number; label: string }[]; values: number[];
  onChange: (v: number[]) => void; columns?: number
}) {
  const toggle = (id: number) => {
    onChange(values.includes(id) ? values.filter(v => v !== id) : [...values, id])
  }
  return (
    <div style={{ marginBottom: '16px' }}>
      {label && <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{label}</label>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '4px' }}>
        {options.map(opt => (
          <label key={opt.id} style={checkboxRow(values.includes(opt.id))}>
            <input type="checkbox" checked={values.includes(opt.id)} onChange={() => toggle(opt.id)} style={{ accentColor: '#1e3a5f', width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }} />
            <span style={{ fontSize: '14px', color: '#374151' }}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: '#1e3a5f', width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }} />
      <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>{label}</span>
    </label>
  )
}

// ─── Composant liste dynamique (Organisations / Langues) ─────────────────────

function DynamicList({ myIds, allItems, pinnedNoms, newIds, newName, showInput, onToggleNew, onSetNewName, onSetShowInput, addLabel, placeholder, globalNote }: {
  myIds: string[]
  allItems: { id: string; nom: string }[]
  pinnedNoms?: string[]
  newIds: string[]
  newName: string
  showInput: boolean
  onToggleNew: (id: string) => void
  onSetNewName: (v: string) => void
  onSetShowInput: (v: boolean) => void
  addLabel: string
  placeholder: string
  globalNote?: string
}) {
  const myItems = allItems.filter(o => myIds.includes(o.id))
  const available = allItems.filter(o => !myIds.includes(o.id))

  const pinnedAvailable = pinnedNoms
    ? available.filter(o => pinnedNoms.includes(o.nom))
    : []
  const restAvailable = pinnedNoms
    ? available.filter(o => !pinnedNoms.includes(o.nom))
    : available

  return (
    <div>
      {myItems.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' }}>Mes sélections actuelles</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {myItems.map(item => (
              <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '20px', fontSize: '13px', fontWeight: '500', color: '#1e3a5f' }}>
                ✓ {item.nom}
              </span>
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' }}>Ajouter</p>

          {pinnedAvailable.length > 0 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {pinnedAvailable.map(item => (
                  <label key={item.id} style={checkboxRow(newIds.includes(item.id))}>
                    <input type="checkbox" checked={newIds.includes(item.id)} onChange={() => onToggleNew(item.id)}
                      style={{ accentColor: '#1e3a5f', width: '16px', height: '16px', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', color: '#374151' }}>{item.nom}</span>
                  </label>
                ))}
              </div>
              {restAvailable.length > 0 && (
                <div style={{ margin: '8px 0', borderTop: '1px solid #e5e7eb' }} />
              )}
            </>
          )}

          {restAvailable.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto', padding: '2px 0' }}>
              {restAvailable.map(item => (
                <label key={item.id} style={checkboxRow(newIds.includes(item.id))}>
                  <input type="checkbox" checked={newIds.includes(item.id)} onChange={() => onToggleNew(item.id)}
                    style={{ accentColor: '#1e3a5f', width: '16px', height: '16px', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>{item.nom}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {!showInput ? (
        <button onClick={() => onSetShowInput(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'transparent', border: '1px dashed #9ca3af', borderRadius: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}>
          + {addLabel}
        </button>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="text" value={newName} onChange={e => onSetNewName(e.target.value)} placeholder={placeholder}
              style={{ flex: 1, padding: '9px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '8px', color: '#111827', backgroundColor: 'white' }} />
            <button onClick={() => { onSetShowInput(false); onSetNewName('') }}
              style={{ padding: '9px 12px', backgroundColor: 'transparent', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Annuler
            </button>
          </div>
          {globalNote && <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', marginBottom: 0 }}>{globalNote}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function DossierPage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [dossier, setDossier] = useState<DossierData>(DEFAULT_DOSSIER)
  const [originalDossier, setOriginalDossier] = useState<DossierData>(DEFAULT_DOSSIER)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // ─── Organisations ──────────────────────────────────────────────────────────
  const [allOrgs, setAllOrgs] = useState<Organisation[]>([])
  const [myOrgIds, setMyOrgIds] = useState<string[]>([])
  const [newOrgIds, setNewOrgIds] = useState<string[]>([])
  const [newOrgName, setNewOrgName] = useState('')
  const [showNewOrgInput, setShowNewOrgInput] = useState(false)

  // ─── Langues ────────────────────────────────────────────────────────────────
  const [allLangues, setAllLangues] = useState<Langue[]>([])
  const [myLangueIds, setMyLangueIds] = useState<string[]>([])
  const [newLangueIds, setNewLangueIds] = useState<string[]>([])
  const [newLangueName, setNewLangueName] = useState('')
  const [showNewLangueInput, setShowNewLangueInput] = useState(false)

  const isAqbrsLinked = myOrgIds.includes(AQBRS_ORG_ID) || newOrgIds.includes(AQBRS_ORG_ID)
  const orgHasChanges = newOrgIds.length > 0 || newOrgName.trim() !== ''
  const langueHasChanges = newLangueIds.length > 0 || newLangueName.trim() !== ''
  const anyChanges = hasChanges || orgHasChanges || langueHasChanges

  const router = useRouter()
  const supabase = createClient()

  const updateDossier = (field: keyof DossierData, value: any) => {
    setDossier(prev => {
      const updated = { ...prev, [field]: value }
      setHasChanges(JSON.stringify(updated) !== JSON.stringify(originalDossier))
      return updated
    })
  }

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: reservisteData } = await supabase
        .from('reservistes').select('*').eq('user_id', user.id).single()
      if (!reservisteData) { router.push('/'); return }
      setReserviste(reservisteData)

      if (reservisteData.groupe !== 'Approuvé') { router.push('/'); return }

      setLoading(false)

      // Charger organisations
      const { data: allOrgsData } = await supabase.from('organisations').select('id, nom').order('nom')
      setAllOrgs(allOrgsData || [])

      const { data: myOrgsData } = await supabase
        .from('reserviste_organisations').select('organisation_id').eq('benevole_id', reservisteData.benevole_id)
      const linkedOrgIds = (myOrgsData || []).map((r: any) => r.organisation_id)
      setMyOrgIds(linkedOrgIds)

      // Charger langues
      const { data: allLanguesData } = await supabase.from('langues').select('id, nom').order('nom')
      setAllLangues(allLanguesData || [])

      const { data: myLanguesData } = await supabase
        .from('reserviste_langues').select('langue_id').eq('benevole_id', reservisteData.benevole_id)
      setMyLangueIds((myLanguesData || []).map((r: any) => r.langue_id))

      // Charger dossier depuis n8n/Monday
      try {
        const response = await fetch(`https://n8n.aqbrs.ca/webhook/riusc-get-dossier?benevole_id=${reservisteData.benevole_id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.dossier) {
            const d = data.dossier
            const loaded: DossierData = {
              prenom: d.prenom || '',
              nom: d.nom || '',
              email: d.email || '',
              date_naissance: d.date_naissance || '',
              grandeur_bottes: d.grandeur_bottes || '',
              j_ai_18_ans: d.j_ai_18_ans || false,
              allergies_alimentaires: d.allergies_alimentaires || '',
              allergies_autres: d.allergies_autres || '',
              problemes_sante: d.problemes_sante || '',
              groupe_sanguin: Array.isArray(d.groupe_sanguin) && d.groupe_sanguin.length > 0 ? (GROUPE_SANGUIN_REVERSE[d.groupe_sanguin[0]] || '') : '',
              competence_rs: d.competence_rs || [],
              certificat_premiers_soins: d.certificat_premiers_soins || [],
              date_expiration_certificat: d.date_expiration_certificat || '',
              vehicule_tout_terrain: d.vehicule_tout_terrain || [],
              navire_marin: d.navire_marin || [],
              permis_conduire: d.permis_conduire || [],
              disponible_covoiturage: d.disponible_covoiturage || [],
              satp_drone: d.satp_drone || [],
              equipe_canine: d.equipe_canine || [],
              competences_securite: d.competences_securite || [],
              competences_sauvetage: d.competences_sauvetage || [],
              certification_csi: d.certification_csi || [],
              communication: d.communication || [],
              cartographie_sig: d.cartographie_sig || [],
              operation_urgence: d.operation_urgence || [],
              autres_competences: d.autres_competences || '',
              commentaire: d.commentaire || '',
              confidentialite: d.confidentialite || false,
            }
            setDossier(loaded)
            setOriginalDossier(loaded)

            // Backfill AQBRS si compétence RS remplie et AQBRS pas encore lié
            if ((d.competence_rs || []).length > 0 && !linkedOrgIds.includes(AQBRS_ORG_ID)) {
              await supabase.from('reserviste_organisations').insert({
                benevole_id: reservisteData.benevole_id,
                organisation_id: AQBRS_ORG_ID
              })
              setMyOrgIds(prev => [...prev, AQBRS_ORG_ID])
            }
          }
        }
      } catch (error) {
        console.error('Erreur chargement dossier:', error)
      }
    }
    loadData()
  }, [])

  const handleSave = async () => {
    if (!reserviste) return
    setSaving(true)
    setSaveMessage(null)

    try {
      // ── Dossier principal (Monday via n8n) ──────────────────────────────────
      if (hasChanges) {
        const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-update-dossier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            dossier: {
              grandeur_bottes: dossier.grandeur_bottes,
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
        })
        const data = await response.json()
        if (!data.success) {
          setSaveMessage({ type: 'error', text: data.error || 'Erreur lors de la sauvegarde' })
          setSaving(false)
          return
        }
        setOriginalDossier({ ...dossier })
        setHasChanges(false)
      }

      // ── Organisations (Supabase) ─────────────────────────────────────────────
      if (orgHasChanges) {
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
        setMyOrgIds(prev => [...prev, ...uniqueOrgs])
        setNewOrgIds([])
        setNewOrgName('')
        setShowNewOrgInput(false)
      }

      // ── Langues (Supabase) ───────────────────────────────────────────────────
      if (langueHasChanges) {
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
        setMyLangueIds(prev => [...prev, ...uniqueLangues])
        setNewLangueIds([])
        setNewLangueName('')
        setShowNewLangueInput(false)
      }

      setSaveMessage({ type: 'success', text: 'Dossier sauvegardé avec succès !' })
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setSaveMessage({ type: 'error', text: 'Erreur de connexion' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#1e3a5f', fontSize: '16px' }}>
        Chargement...
      </div>
    )
  }

  const showConfirm18 = !isOlderThan18(dossier.date_naissance)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>

      <PortailHeader subtitle="Mon dossier réserviste" />

      {saveMessage && (
        <div style={{ maxWidth: '860px', margin: '16px auto 0', padding: '0 24px' }}>
          <div style={{ padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500', backgroundColor: saveMessage.type === 'success' ? '#d1fae5' : '#fef2f2', color: saveMessage.type === 'success' ? '#065f46' : '#dc2626', border: `1px solid ${saveMessage.type === 'success' ? '#6ee7b7' : '#fca5a5'}` }}>
            {saveMessage.text}
          </div>
        </div>
      )}

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour à l&apos;accueil</a>
        </div>

        {/* ── 1. Identité ── */}
        <Section title="Identité" icon="👤">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 24px' }}>
            <TextInput label="Prénom" value={dossier.prenom} onChange={() => {}} disabled />
            <TextInput label="Nom de famille" value={dossier.nom} onChange={() => {}} disabled />
          </div>
          <TextInput label="Courriel" value={dossier.email} onChange={() => {}} disabled />
          <TextInput label="Date de naissance" value={dossier.date_naissance} onChange={() => {}} disabled />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 24px' }}>
            <TextInput label="Grandeur de bottes" value={dossier.grandeur_bottes} onChange={v => updateDossier('grandeur_bottes', v)} placeholder="Ex: 10" />
          </div>
          {showConfirm18 && (
            <Checkbox
              label="Je confirme avoir 18 ans ou plus"
              checked={dossier.j_ai_18_ans}
              onChange={v => updateDossier('j_ai_18_ans', v)}
            />
          )}
        </Section>

        {/* ── 2. Santé ── */}
        <Section
          title="Santé"
          icon="🏥"
          description="Informations médicales de base pour assurer votre sécurité et celle de votre équipe lors des déploiements."
          confidential
        >
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Groupe sanguin</label>
            <select value={dossier.groupe_sanguin} onChange={e => updateDossier('groupe_sanguin', e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', color: '#111827', backgroundColor: 'white', minWidth: '160px' }}>
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

        {/* ── 3. Organisations d'appartenance ── */}
        <Section
          title="Organisations d'appartenance"
          icon="🏢"
          description="À quelles organisations êtes-vous affilié? Vos associations sont permanentes — vous pouvez en ajouter, mais pas en retirer."
        >
          <DynamicList
            myIds={myOrgIds}
            allItems={allOrgs}
            newIds={newOrgIds}
            newName={newOrgName}
            showInput={showNewOrgInput}
            onToggleNew={id => setNewOrgIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            onSetNewName={setNewOrgName}
            onSetShowInput={setShowNewOrgInput}
            addLabel="Mon organisation n'est pas dans la liste"
            placeholder="Ex: Croix-Rouge canadienne"
            globalNote="Cette organisation sera ajoutée à la liste globale pour tous les réservistes."
          />
          {myOrgIds.length === 0 && newOrgIds.length === 0 && !newOrgName.trim() && (
            <div style={{ padding: '12px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '13px', color: '#92400e', marginTop: '12px' }}>
              ⚠️ Aucune organisation associée — veuillez en sélectionner au moins une.
            </div>
          )}
        </Section>

        {/* ── 4. Compétences RS (conditionnel AQBRS) ── */}
        {isAqbrsLinked && (
          <Section
            title="Compétences en recherche et sauvetage"
            icon="🔍"
            description="Quel est votre niveau de formation certifiée en recherche et sauvetage au sol?"
          >
            <RadioGroupId
              label=""
              options={OPTIONS.competence_rs}
              value={dossier.competence_rs}
              onChange={v => updateDossier('competence_rs', v)}
            />
          </Section>
        )}

        {/* ── 5. Certifications premiers soins ── */}
        <Section
          title="Certifications en premiers soins"
          icon="🩺"
          description="Avez-vous un certificat de premiers soins en cours de validité? Cochez tous ceux qui s'appliquent."
        >
          <CheckboxGroupId
            label=""
            options={OPTIONS.certificat_premiers_soins}
            values={dossier.certificat_premiers_soins}
            onChange={v => updateDossier('certificat_premiers_soins', v)}
          />
          <TextInput
            label="Date d'expiration du certificat"
            value={dossier.date_expiration_certificat}
            onChange={v => updateDossier('date_expiration_certificat', v)}
            type="date"
          />
        </Section>

        {/* ── 6. Système de commandement ── */}
        <Section
          title="Système de commandement des interventions"
          icon="🎖️"
          description="Avez-vous complété des formations en Système de Commandement des Interventions (SCI/ICS)?"
        >
          <RadioGroupId
            label=""
            options={[{ id: 0, label: 'Aucune formation' }, ...OPTIONS.certification_csi]}
            value={dossier.certification_csi.length > 0 ? dossier.certification_csi : [0]}
            onChange={v => updateDossier('certification_csi', v[0] === 0 ? [] : v)}
          />
        </Section>

        {/* ── 7. Transport ── */}
        <Section
          title="Transport et véhicules"
          icon="🚗"
          description="Quels types de permis possédez-vous, et avez-vous accès à des véhicules spécialisés?"
        >
          <CheckboxGroupId
            label="Catégorie de permis de conduire"
            options={OPTIONS.permis_conduire}
            values={dossier.permis_conduire}
            onChange={v => updateDossier('permis_conduire', v)}
          />
          <div style={{ marginTop: '16px' }}>
            <CheckboxGroupId
              label="Véhicule tout-terrain"
              options={OPTIONS.vehicule_tout_terrain}
              values={dossier.vehicule_tout_terrain}
              onChange={v => updateDossier('vehicule_tout_terrain', v)}
            />
          </div>
          <div style={{ marginTop: '16px' }}>
            <CheckboxGroupId
              label="Navire marin"
              options={OPTIONS.navire_marin}
              values={dossier.navire_marin}
              onChange={v => updateDossier('navire_marin', v)}
            />
          </div>
          <div style={{ marginTop: '16px' }}>
            <CheckboxGroupId
              label="Covoiturage"
              options={OPTIONS.disponible_covoiturage}
              values={dossier.disponible_covoiturage}
              onChange={v => updateDossier('disponible_covoiturage', v)}
            />
          </div>
        </Section>

        {/* ── 8. Compétences spécialisées ── */}
        <Section
          title="Compétences spécialisées"
          icon="⚙️"
          description="Avez-vous des formations, certifications ou équipements dans les domaines spécialisés suivants?"
        >
          <CheckboxGroupId
            label="SATP Pilote (Drone) / RPAS Pilot"
            options={OPTIONS.satp_drone}
            values={dossier.satp_drone}
            onChange={v => updateDossier('satp_drone', v)}
          />
          <div style={{ marginTop: '16px' }}>
            <CheckboxGroupId
              label="Équipe Canine R-S / SAR Dog Team"
              options={OPTIONS.equipe_canine}
              values={dossier.equipe_canine}
              onChange={v => updateDossier('equipe_canine', v)}
            />
          </div>
          <div style={{ marginTop: '16px' }}>
            <CheckboxGroupId
              label="Compétences en sécurité"
              options={OPTIONS.competences_securite}
              values={dossier.competences_securite}
              onChange={v => updateDossier('competences_securite', v)}
            />
          </div>
          <div style={{ marginTop: '16px' }}>
            <CheckboxGroupId
              label="Compétences en sauvetage"
              options={OPTIONS.competences_sauvetage}
              values={dossier.competences_sauvetage}
              onChange={v => updateDossier('competences_sauvetage', v)}
            />
          </div>
        </Section>

        {/* ── 9. Communication ── */}
        <Section
          title="Communication"
          icon="📡"
          description="Avez-vous des accréditations, permis ou certifications pour l'utilisation de systèmes de communication radio?"
        >
          <CheckboxGroupId
            label=""
            options={OPTIONS.communication}
            values={dossier.communication}
            onChange={v => updateDossier('communication', v)}
          />
        </Section>

        {/* ── 10. Cartographie ── */}
        <Section
          title="Cartographie et SIG"
          icon="🗺️"
          description="Avez-vous de l'expérience avec les applications de cartographie ou de systèmes d'information géographique (SIG) suivantes?"
        >
          <CheckboxGroupId
            label=""
            options={OPTIONS.cartographie_sig}
            values={dossier.cartographie_sig}
            onChange={v => updateDossier('cartographie_sig', v)}
          />
        </Section>

        {/* ── 11. Opérations d'urgence — 2 colonnes ── */}
        <Section
          title="Opérations d'urgence"
          icon="🚨"
          description="Avez-vous de l'expérience en déploiement ou en soutien aux sinistrés lors d'opérations d'urgence ou de gestion de crise?"
        >
          <CheckboxGroupId
            label=""
            options={OPTIONS.operation_urgence}
            values={dossier.operation_urgence}
            onChange={v => updateDossier('operation_urgence', v)}
            columns={2}
          />
        </Section>

        {/* ── 12. Langues ── */}
        <Section
          title="Langues"
          icon="🌐"
          description="Quelles langues parlez-vous? Sélectionnez celles qui s'appliquent ou ajoutez-en une si elle n'est pas dans la liste."
        >
          <DynamicList
            myIds={myLangueIds}
            allItems={allLangues}
            pinnedNoms={LANGUES_EPINGLEES}
            newIds={newLangueIds}
            newName={newLangueName}
            showInput={showNewLangueInput}
            onToggleNew={id => setNewLangueIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            onSetNewName={setNewLangueName}
            onSetShowInput={setShowNewLangueInput}
            addLabel="Ma langue n'est pas dans la liste"
            placeholder="Ex: Créole haïtien"
            globalNote="Cette langue sera ajoutée à la liste globale pour tous les réservistes."
          />
        </Section>

        {/* ── 13. Notes ── */}
        <Section title="Notes et commentaires" icon="📝">
          <TextArea
            label="Autres compétences"
            value={dossier.autres_competences}
            onChange={v => updateDossier('autres_competences', v)}
            placeholder="Compétences supplémentaires non listées ci-dessus..."
          />
          <TextArea
            label="Commentaire"
            value={dossier.commentaire}
            onChange={v => updateDossier('commentaire', v)}
            placeholder="Commentaires ou informations additionnelles..."
          />
          <Checkbox
            label="J'accepte les conditions de confidentialité et d'utilisation de mes données"
            checked={dossier.confidentialite}
            onChange={v => updateDossier('confidentialite', v)}
          />
        </Section>
      </main>

      {/* Barre sticky en bas */}
      {anyChanges && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTop: '1px solid #e5e7eb', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', zIndex: 9999 }}>
          <div style={{ maxWidth: '860px', margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#d97706', fontWeight: '500' }}>⚠️ Modifications non sauvegardées</span>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '10px 24px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
