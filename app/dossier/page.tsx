'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reserviste {
  benevole_id: string
  prenom: string
  nom: string
  email: string
  groupe?: string
}

interface DossierData {
  // Identité (lecture seule)
  prenom: string
  nom: string
  email: string
  date_naissance: string
  // Infos complémentaires
  grandeur_bottes: string
  j_ai_18_ans: boolean
  // Santé
  allergies_oui_non: string
  allergie_detail: string
  // Compétences RS
  competence_rs: string[]
  // Premiers soins
  certificat_premiers_soins: string[]
  date_expiration_certificat: string
  // Véhicules
  vehicule_tout_terrain: string[]
  navire_marin: string[]
  permis_conduire: string[]
  disponible_covoiturage: string[]
  // Spécialisé
  satp_drone: string[]
  equipe_canine: string[]
  competences_securite: string[]
  competences_sauvetage: string[]
  certification_csi: string[]
  communication: string[]
  cartographie_sig: string[]
  operation_urgence: string[]
  // Langues
  langues_parlees: string[]
  autres_langues: string
  // Affiliation
  provenance: string[]
  membre_groupe_rs: string[]
  organisme_autre: string
  // Notes
  autres_competences: string
  commentaire: string
  // Confidentialité
  confidentialite: boolean
}

// ─── Options dropdown (depuis le document structure Monday) ──────────────────

const OPTIONS = {
  allergies_oui_non: ['Oui / Yes', 'Non / No'],
  competence_rs: [
    'Niveau 1 - Chercheur',
    'Niveau 2 - Chef d\'équipe',
    'Niveau 3 - Gestionnaire de recherche',
  ],
  certificat_premiers_soins: [
    'a) RCR/DEA (4-6h) certificat',
    'b) Premiers soins standard (8-16h) / Standard first aid',
    'c) Secourisme en milieu de travail (16h) / First aid in the workplace',
    'd) Secourisme en milieu éloigné (20-40h) / Wilderness first aid',
    'e) Premier répondant (80-120h) / First responder',
  ],
  vehicule_tout_terrain: [
    'VTT / ATV',
    'Motoneige / Snowmobile',
    'Argo',
    'Côte à côte / Side by Side',
  ],
  navire_marin: [
    'Permis d\'embarcation de plaisance / Pleasure craf licence',
    'Petits bateaux / Small craft',
  ],
  permis_conduire: [
    'Classe 5 Voiture (G ontario) / Car',
    'Classe 4b Autobus (4-14 passagers) / Bus (4-14 passengers)',
    'Classe 2 Autobus (24+ passager) / Bus (24+ passenger)',
    'Classe 1 Ensemble de véhicules routiers / Heavy vehicle',
    'Classe 4a Véhicule d\'urgence / Emergency vehicle',
    'Classe 3 Camions / Trucks',
    'Classe 6 Motocyclette / Motocycle',
  ],
  disponible_covoiturage: [
    'Je peux transporter des gens / I can transport people',
  ],
  satp_drone: [
    'SATP Obs / RPAS Visual Observer',
    'SATP de base / RPAS Basic',
    'SATP avancées / RPAS Advanced',
  ],
  equipe_canine: [
    'Ratissage',
    'Pistage / Track-Trail',
    'Avalanche / Avalanche',
    'Décombres - Noyés - Restes humains / USAR - Water search - Human remains',
  ],
  competences_securite: [
    'Cours sur la sécurité des scies à chaînes / Chain saw safety course',
    'Certification de contrôle du trafic / Traffic control and flagging certificate',
  ],
  competences_sauvetage: [
    'Sauvetage sur corde / Rope rescue',
    'Sauvetage en eau vive / Swift water rescue',
    'Sauvetage sur glace / Ice rescue',
  ],
  certification_csi: [
    'CSI / ICS 100',
    'CSI / ICS 200',
    'CSI / ICS 300',
    'CSI / ICS 400',
  ],
  communication: [
    'Certificat restreint d\'opérateur radio - Aéronautique / Restricted operator certificate - aeronautic',
    'Opérateur radio - maritime / Radio operator - maritime',
    'Expérience en communications radio mobiles terrestres / Land mobile radio technical professional',
    'Certificat d\'opérateur radioamateur - de base / Amateur radio operator certificate - basic',
    'Certificat d\'opérateur radioamateur - de base avec distinction / Amateur radio operator certificate - basic with honors',
    'Certificat d\'opérateur radioamateur - avancée / Amateur radio operator certificate - advanced',
    'Professionnel de réseau ou expérience significative en matière de réseau IP / Networking professional or significant IP networking experience',
  ],
  cartographie_sig: [
    'ArcGIS Pro',
    'ArcGIS Online',
    'ArcGIS QuickCapture (Mobile)',
    'Caltopo - Sartopo',
    'Sartrack',
    'Autre / Other',
  ],
  operation_urgence: [] as string[],
  langues_parlees: [
    'Anglais / English',
    'Français / French',
    'Espagnol / Spanish',
    'Mandarin / Mandarin',
    'Arabe',
    'Créole haïtien / Haitian Creole',
    'Cantonais / Cantonese',
    'Portugais / Portuguese',
    'Italien / Italian',
    'Roumain / Romanian',
    'Vietnamien / Vietnamese',
    'Russe / Russian',
    'Allemand / German',
    'Coréen / Korean',
    'Japonais / Japanese',
    'Cri / Cree',
    'Innu-aimun (Montagnais)',
    'Atikamekw',
    'Naskapi',
    'Algonquin',
    'Mohawk',
  ],
  provenance: [
    'AQBRS - Association Québécoise des bénévoles en recherche et sauvetage',
    'MSP - Ministère de la sécurité publique',
    'Site Web de l\'AQBRS',
    'ASJ - Ambulance St-Jean',
  ],
  membre_groupe_rs: [
    'Recherche et Sauvetage Québec-Métro (RSQM)',
    'District 1: Équipe de RS La Grande-Ourse',
    'District 2: Sauvetage Région 02',
    'District 3: Recherche et Sauvetage Québec-Métro (RSQM)',
    'District 4: Eurêka Recherche et sauvetage',
    'District 4: SIUCQ Drummondville',
    'District 4: SIUCQ MRC Arthabaska',
    'District 4: SIUSQ Division Mauricie',
    'District 4: Sauvetage Mauricie K9',
    'District 5: Recherche Sauvetage Estrie',
    'District 6: Sauvetage Baie-D\'Urfé',
    'District 6: Ambulance St-Jean - Div. 971 Laval',
    'District 6: Québec Secours',
    'District 6: Pointe-Claire Rescue',
    'District 6: Recherche Sauvetage Laurentides Lanaudière',
    'District 6: S&R Balise Beacon R&S',
    'District 7: Sauvetage Bénévole Outaouais',
    'District 7: SAR 360',
    'District 8: Recherche et sauvetage du Témiscamingue R.E.S.Tem',
    'District 9: Groupe de recherche Manicouagan',
    'District 10: Groupe de recherche Manicouagas',
  ],
}

// ─── Valeurs par défaut ──────────────────────────────────────────────────────

const DEFAULT_DOSSIER: DossierData = {
  prenom: '', nom: '', email: '', date_naissance: '',
  grandeur_bottes: '', j_ai_18_ans: false,
  allergies_oui_non: '', allergie_detail: '',
  competence_rs: [],
  certificat_premiers_soins: [], date_expiration_certificat: '',
  vehicule_tout_terrain: [], navire_marin: [],
  permis_conduire: [], disponible_covoiturage: [],
  satp_drone: [], equipe_canine: [],
  competences_securite: [], competences_sauvetage: [],
  certification_csi: [], communication: [],
  cartographie_sig: [], operation_urgence: [],
  langues_parlees: [], autres_langues: '',
  provenance: [], membre_groupe_rs: [], organisme_autre: '',
  autres_competences: '', commentaire: '',
  confidentialite: false,
}

// ─── Composants de formulaire ────────────────────────────────────────────────

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mt-10 mb-4 pb-2 border-b-2 border-[#1e3a5f]">
      <span className="text-xl">{icon}</span>
      <h2 className="text-lg font-semibold text-[#1e3a5f]">{title}</h2>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder, disabled, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; type?: string
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition
          ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-300'}`}
      />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition resize-y"
      />
    </div>
  )
}

function RadioGroup({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={label}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="w-4 h-4 text-[#1e3a5f] focus:ring-[#1e3a5f]"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function CheckboxGroup({ label, options, values, onChange, columns = 1 }: {
  label: string; options: string[]; values: string[];
  onChange: (v: string[]) => void; columns?: number
}) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt))
    } else {
      onChange([...values, opt])
    }
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {options.map((opt) => (
          <label key={opt} className="flex items-start gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={values.includes(opt)}
              onChange={() => toggle(opt)}
              className="w-4 h-4 mt-0.5 text-[#1e3a5f] rounded focus:ring-[#1e3a5f] shrink-0"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Checkbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer mb-4 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 text-[#1e3a5f] rounded focus:ring-[#1e3a5f] shrink-0"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function DossierPage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [dossier, setDossier] = useState<DossierData>(DEFAULT_DOSSIER)
  const [loading, setLoading] = useState(true)
  const [loadingDossier, setLoadingDossier] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalDossier, setOriginalDossier] = useState<string>('')
  
  const router = useRouter()
  const supabase = createClient()

  // Charger le dossier depuis Monday via n8n
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Récupérer le réserviste depuis Supabase
      const { data: reservisteData } = await supabase
        .from('reservistes')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (!reservisteData) {
        setLoading(false)
        setLoadingDossier(false)
        return
      }
      setReserviste(reservisteData)

      // Protection: les new_group n'ont pas accès au dossier
      if (reservisteData.groupe === 'new_group') {
        router.push('/')
        return
      }

      setLoading(false)

      // Charger le dossier depuis Monday via n8n
      try {
        const response = await fetch(
          `https://n8n.aqbrs.ca/webhook/riusc-get-dossier?benevole_id=${reservisteData.benevole_id}`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.dossier) {
            const merged = { ...DEFAULT_DOSSIER, ...data.dossier }
            setDossier(merged)
            setOriginalDossier(JSON.stringify(merged))
          }
        }
      } catch (error) {
        console.error('Erreur chargement dossier:', error)
      }
      setLoadingDossier(false)
    }
    loadData()
  }, [])

  // Détecter les changements
  useEffect(() => {
    setHasChanges(JSON.stringify(dossier) !== originalDossier)
  }, [dossier, originalDossier])

  // Helper pour mettre à jour un champ
  const updateField = <K extends keyof DossierData>(key: K, value: DossierData[K]) => {
    setDossier(prev => ({ ...prev, [key]: value }))
    setSaveSuccess(false)
    setSaveError(null)
  }

  // Sauvegarder
  const handleSave = async () => {
    if (!reserviste || !hasChanges) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-update-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          dossier: dossier,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSaveSuccess(true)
          setOriginalDossier(JSON.stringify(dossier))
          setTimeout(() => setSaveSuccess(false), 4000)
        } else {
          setSaveError(result.error || 'Erreur lors de la sauvegarde')
        }
      } else {
        setSaveError('Erreur de communication avec le serveur')
      }
    } catch (error) {
      setSaveError('Erreur réseau. Vérifiez votre connexion.')
    }
    setSaving(false)
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f] mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!reserviste) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium">Profil réserviste introuvable</p>
          <p className="text-gray-500 mt-2 text-sm">Votre compte n'est pas encore lié à un dossier réserviste.</p>
          <button onClick={() => router.push('/')} className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm hover:bg-[#15304f] transition">
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white py-4 px-6 shadow-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-white/70 hover:text-white transition">
              ← Retour
            </button>
            <span className="text-white/30">|</span>
            <h1 className="text-lg font-semibold">Mon dossier réserviste</h1>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-xs bg-amber-500 text-white px-2 py-1 rounded-full animate-pulse">
                Modifications non sauvegardées
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                saving || !hasChanges
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#e63946] hover:bg-[#d62b39] active:scale-95'
              } text-white`}
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-32">
        
        {/* Bannière de succès / erreur */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <span className="text-green-600 text-lg">✓</span>
            <p className="text-green-800 text-sm font-medium">Dossier sauvegardé avec succès !</p>
          </div>
        )}
        {saveError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <span className="text-red-600 text-lg">✕</span>
            <p className="text-red-800 text-sm font-medium">{saveError}</p>
          </div>
        )}

        {loadingDossier && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1e3a5f]"></div>
            <p className="text-blue-800 text-sm">Chargement de votre dossier depuis Monday.com...</p>
          </div>
        )}

        {/* ─── SECTION 1: Identité ─────────────────────────────────────── */}
        <SectionTitle icon="👤" title="Informations personnelles" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <TextInput label="Prénom" value={dossier.prenom} onChange={() => {}} disabled />
            <TextInput label="Nom de famille" value={dossier.nom} onChange={() => {}} disabled />
          </div>
          <TextInput label="Courriel" value={dossier.email} onChange={() => {}} disabled />
          <TextInput label="Date de naissance" value={dossier.date_naissance} onChange={() => {}} disabled type="text" />
          <p className="text-xs text-gray-400 -mt-2 mb-4">Ces informations sont gérées dans votre profil.</p>
          
          <TextInput
            label="Grandeur de bottes"
            value={dossier.grandeur_bottes}
            onChange={(v) => updateField('grandeur_bottes', v)}
            placeholder="Ex: 10, 42, etc."
          />
          <Checkbox
            label="Je confirme avoir 18 ans ou plus"
            checked={dossier.j_ai_18_ans}
            onChange={(v) => updateField('j_ai_18_ans', v)}
          />
        </div>

        {/* ─── SECTION 2: Santé ────────────────────────────────────────── */}
        <SectionTitle icon="🏥" title="Santé et allergies" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <RadioGroup
            label="Avez-vous des allergies ou d'autres problèmes médicaux dont l'équipe de gestion des incidents devrait être informée?"
            options={OPTIONS.allergies_oui_non}
            value={dossier.allergies_oui_non}
            onChange={(v) => updateField('allergies_oui_non', v)}
          />
          {dossier.allergies_oui_non === 'Oui / Yes' && (
            <TextArea
              label="Détails (allergies, problèmes de santé)"
              value={dossier.allergie_detail}
              onChange={(v) => updateField('allergie_detail', v)}
              placeholder="Décrivez vos allergies ou conditions médicales..."
            />
          )}
        </div>

        {/* ─── SECTION 3: Compétences RS ───────────────────────────────── */}
        <SectionTitle icon="🔍" title="Compétences en recherche et sauvetage" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <CheckboxGroup
            label="Compétence en recherche et sauvetage au sol"
            options={OPTIONS.competence_rs}
            values={dossier.competence_rs}
            onChange={(v) => updateField('competence_rs', v)}
          />
        </div>

        {/* ─── SECTION 4: Premiers soins & CSI ─────────────────────────── */}
        <SectionTitle icon="🩺" title="Certifications" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <CheckboxGroup
            label="Certificat de premiers soins (en cours de validité)"
            options={OPTIONS.certificat_premiers_soins}
            values={dossier.certificat_premiers_soins}
            onChange={(v) => updateField('certificat_premiers_soins', v)}
          />
          <TextInput
            label="Date d'expiration du certificat"
            value={dossier.date_expiration_certificat}
            onChange={(v) => updateField('date_expiration_certificat', v)}
            type="date"
          />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Certification CSI / ICS"
              options={OPTIONS.certification_csi}
              values={dossier.certification_csi}
              onChange={(v) => updateField('certification_csi', v)}
            />
          </div>
        </div>

        {/* ─── SECTION 5: Transport et véhicules ──────────────────────── */}
        <SectionTitle icon="🚗" title="Transport et véhicules" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <CheckboxGroup
            label="Catégorie de permis de conduire"
            options={OPTIONS.permis_conduire}
            values={dossier.permis_conduire}
            onChange={(v) => updateField('permis_conduire', v)}
          />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Véhicule tout-terrain"
              options={OPTIONS.vehicule_tout_terrain}
              values={dossier.vehicule_tout_terrain}
              onChange={(v) => updateField('vehicule_tout_terrain', v)}
              columns={2}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Navire marin"
              options={OPTIONS.navire_marin}
              values={dossier.navire_marin}
              onChange={(v) => updateField('navire_marin', v)}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Disponible pour offrir du covoiturage"
              options={OPTIONS.disponible_covoiturage}
              values={dossier.disponible_covoiturage}
              onChange={(v) => updateField('disponible_covoiturage', v)}
            />
          </div>
        </div>

        {/* ─── SECTION 6: Compétences spécialisées ────────────────────── */}
        <SectionTitle icon="⚙️" title="Compétences spécialisées" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <CheckboxGroup
            label="SATP Pilote (Drone) / RPAS Pilot"
            options={OPTIONS.satp_drone}
            values={dossier.satp_drone}
            onChange={(v) => updateField('satp_drone', v)}
          />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Équipe Canine R-S / SAR Dog Team"
              options={OPTIONS.equipe_canine}
              values={dossier.equipe_canine}
              onChange={(v) => updateField('equipe_canine', v)}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Compétences en matière de sécurité"
              options={OPTIONS.competences_securite}
              values={dossier.competences_securite}
              onChange={(v) => updateField('competences_securite', v)}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Compétences de sauvetage"
              options={OPTIONS.competences_sauvetage}
              values={dossier.competences_sauvetage}
              onChange={(v) => updateField('competences_sauvetage', v)}
            />
          </div>
        </div>

        {/* ─── SECTION 7: Communication & SIG ─────────────────────────── */}
        <SectionTitle icon="📡" title="Communication et cartographie" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <CheckboxGroup
            label="Communication"
            options={OPTIONS.communication}
            values={dossier.communication}
            onChange={(v) => updateField('communication', v)}
          />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Expérience cartographie SIG / GIS Mapping"
              options={OPTIONS.cartographie_sig}
              values={dossier.cartographie_sig}
              onChange={(v) => updateField('cartographie_sig', v)}
              columns={2}
            />
          </div>
        </div>

        {/* ─── SECTION 8: Langues ─────────────────────────────────────── */}
        <SectionTitle icon="🌐" title="Langues" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <CheckboxGroup
            label="Langues parlées"
            options={OPTIONS.langues_parlees}
            values={dossier.langues_parlees}
            onChange={(v) => updateField('langues_parlees', v)}
            columns={2}
          />
          <TextInput
            label="Autres langues"
            value={dossier.autres_langues}
            onChange={(v) => updateField('autres_langues', v)}
            placeholder="Langues non listées ci-dessus..."
          />
        </div>

        {/* ─── SECTION 9: Affiliation ─────────────────────────────────── */}
        <SectionTitle icon="🏢" title="Affiliation" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <CheckboxGroup
            label="Provenance"
            options={OPTIONS.provenance}
            values={dossier.provenance}
            onChange={(v) => updateField('provenance', v)}
          />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <CheckboxGroup
              label="Membres d'un groupe de R.S. de l'AQBRS"
              options={OPTIONS.membre_groupe_rs}
              values={dossier.membre_groupe_rs}
              onChange={(v) => updateField('membre_groupe_rs', v)}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <TextInput
              label="Organisme - Autre impliqué en sécurité civile"
              value={dossier.organisme_autre}
              onChange={(v) => updateField('organisme_autre', v)}
              placeholder="Si applicable..."
            />
          </div>
        </div>

        {/* ─── SECTION 10: Notes & confidentialité ────────────────────── */}
        <SectionTitle icon="📝" title="Notes et confidentialité" />
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <TextArea
            label="Autres compétences ou expertises"
            value={dossier.autres_competences}
            onChange={(v) => updateField('autres_competences', v)}
            placeholder="Toute autre compétence pertinente..."
          />
          <TextArea
            label="Commentaire"
            value={dossier.commentaire}
            onChange={(v) => updateField('commentaire', v)}
            placeholder="Commentaire additionnel..."
          />
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Checkbox
              label="Je comprends et j'accepte les conditions de confidentialité de la RIUSC. Je m'engage à traiter toute information relative aux opérations et aux personnes de manière confidentielle."
              checked={dossier.confidentialite}
              onChange={(v) => updateField('confidentialite', v)}
            />
          </div>
        </div>

      </main>

      {/* Barre de sauvegarde fixe en bas */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg py-3 px-6 z-50">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <p className="text-sm text-amber-600 font-medium">
              ⚠ Vous avez des modifications non sauvegardées
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDossier(JSON.parse(originalDossier))
                  setSaveSuccess(false)
                  setSaveError(null)
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-[#e63946] text-white rounded-lg text-sm font-medium hover:bg-[#d62b39] transition disabled:bg-gray-400"
              >
                {saving ? 'Sauvegarde...' : 'Sauvegarder le dossier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
