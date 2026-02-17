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

// Tous les dropdown sont maintenant des number[] (IDs Monday)
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
  allergies_oui_non: number[]
  allergie_detail: string
  // Compétences RS
  competence_rs: number[]
  // Premiers soins
  certificat_premiers_soins: number[]
  date_expiration_certificat: string
  // Véhicules
  vehicule_tout_terrain: number[]
  navire_marin: number[]
  permis_conduire: number[]
  disponible_covoiturage: number[]
  // Spécialisé
  satp_drone: number[]
  equipe_canine: number[]
  competences_securite: number[]
  competences_sauvetage: number[]
  certification_csi: number[]
  communication: number[]
  cartographie_sig: number[]
  operation_urgence: number[]
  // Langues
  langues_parlees: number[]
  autres_langues: string
  // Affiliation
  provenance: number[]
  membre_groupe_rs: number[]
  organisme_autre: string
  // Notes
  autres_competences: string
  commentaire: string
  confidentialite: boolean
}

// ─── OPTIONS: { id: number, label: string }[] ───────────────────────────────
// L'id correspond au ID Monday du dropdown

const OPTIONS: Record<string, { id: number; label: string }[]> = {
  allergies_oui_non: [
    { id: 1, label: 'Oui / Yes' },
    { id: 2, label: 'Non / No' },
  ],
  competence_rs: [
    { id: 1, label: 'Niveau 1 - Équipier' },
    { id: 2, label: 'Niveau 2 - Chef d\'équipe' },
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
    { id: 1, label: 'Permis d\'embarcation de plaisance' },
    { id: 2, label: 'Petits bateaux / Small craft' },
  ],
  permis_conduire: [
    { id: 1, label: 'Classe 5 Voiture (G ontario) / Car' },
    { id: 2, label: 'Classe 4b Autobus (4-14 passagers) / Bus (4-14 passengers)' },
    { id: 3, label: 'Classe 2 Autobus (24+ passager) / Bus (24+ passenger)' },
    { id: 4, label: 'Classe 1 Ensemble de véhicules routiers / Heavy vehicle' },
    { id: 5, label: 'Classe 4a Véhicule d\'urgence / Emergency vehicle' },
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
    { id: 1, label: 'CSI / ICS 100' },
    { id: 2, label: 'CSI / ICS 200' },
    { id: 3, label: 'CSI / ICS 300' },
    { id: 4, label: 'CSI / ICS 400' },
  ],
  communication: [
    { id: 1, label: 'Radio aéronautique / Aeronautical radio' },
    { id: 2, label: 'Radio maritime / Maritime radio' },
    { id: 3, label: 'Radio amateur / Amateur radio' },
    { id: 4, label: 'Radio générale opérateur / General radio operator' },
    { id: 5, label: 'Radio restreinte / Restricted radio' },
    { id: 6, label: 'PCRS / GSAR Radio operator' },
    { id: 7, label: 'Télécommunication d\'urgence / Emergency telecommunication' },
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
    { id: 1, label: 'Gestion de l\'hébergement / Shelter management' },
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
  langues_parlees: [
    { id: 1, label: 'Anglais / English' },
    { id: 2, label: 'Français / French' },
    { id: 3, label: 'Espagnol / Spanish' },
    { id: 4, label: 'Mandarin' },
    { id: 5, label: 'Arabe / Arabic' },
    { id: 6, label: 'Portugais / Portuguese' },
    { id: 7, label: 'Russe / Russian' },
    { id: 8, label: 'Japonais / Japanese' },
    { id: 9, label: 'Allemand / German' },
    { id: 10, label: 'Coréen / Korean' },
    { id: 11, label: 'Italien / Italian' },
    { id: 12, label: 'Néerlandais / Dutch' },
    { id: 13, label: 'Turc / Turkish' },
    { id: 14, label: 'Polonais / Polish' },
    { id: 15, label: 'Ukrainien / Ukrainian' },
    { id: 16, label: 'Roumain / Romanian' },
    { id: 17, label: 'Grec / Greek' },
    { id: 18, label: 'Hongrois / Hungarian' },
    { id: 19, label: 'Tchèque / Czech' },
    { id: 20, label: 'Suédois / Swedish' },
  ],
  provenance: [
    { id: 1, label: 'AQBRS' },
    { id: 2, label: 'MSP' },
    { id: 3, label: 'Site Web AQBRS' },
    { id: 4, label: 'Association des scouts du Canada / ASJ' },
  ],
  membre_groupe_rs: [
    { id: 1, label: 'District 5: Recherche Sauvetage Estrie' },
    { id: 2, label: 'District 4: Recherche Sauvetage Mauricie' },
    { id: 3, label: 'District 3: Recherche Sauvetage Québec' },
    { id: 4, label: 'District 1: Recherche Sauvetage Saguenay' },
    { id: 5, label: 'District 6: Recherche Sauvetage Outaouais' },
    { id: 6, label: 'District 2: Recherche Sauvetage Bas St-Laurent' },
    { id: 7, label: 'District 7: Recherche Sauvetage Laurentides-Lanaudière' },
    { id: 8, label: 'District 8: Recherche Sauvetage Montérégie' },
    { id: 9, label: 'District 9: Recherche Sauvetage Abitibi' },
    { id: 10, label: 'District 10: Recherche Sauvetage Côte-Nord' },
    { id: 11, label: 'District 11: Recherche Sauvetage Chaudières-Appalaches' },
    { id: 12, label: 'District 12: Recherche Sauvetage Centre-du-Québec' },
    { id: 13, label: 'District 13: Recherche Sauvetage Gaspésie' },
    { id: 14, label: 'District 14: Recherche Sauvetage Montréal-Laval' },
    { id: 15, label: 'Autre' },
  ],
}

const DEFAULT_DOSSIER: DossierData = {
  prenom: '', nom: '', email: '', date_naissance: '',
  grandeur_bottes: '', j_ai_18_ans: false,
  allergies_oui_non: [], allergie_detail: '',
  competence_rs: [],
  certificat_premiers_soins: [], date_expiration_certificat: '',
  vehicule_tout_terrain: [], navire_marin: [], permis_conduire: [], disponible_covoiturage: [],
  satp_drone: [], equipe_canine: [], competences_securite: [],
  competences_sauvetage: [], certification_csi: [],
  communication: [], cartographie_sig: [], operation_urgence: [],
  langues_parlees: [], autres_langues: '',
  provenance: [], membre_groupe_rs: [], organisme_autre: '',
  autres_competences: '', commentaire: '', confidentialite: false,
}

// ─── Composants UI ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#1e3a5f]">
        <span className="text-xl">{icon}</span>
        <h2 className="text-lg font-semibold text-[#1e3a5f]">{title}</h2>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {children}
      </div>
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
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md text-sm ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300 focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]'}`}
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
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
      />
    </div>
  )
}

function RadioGroupId({ label, options, value, onChange }: {
  label: string; options: { id: number; label: string }[]; value: number[]; onChange: (v: number[]) => void
}) {
  const selectedId = value[0] || 0
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      {options.map(opt => (
        <label key={opt.id} className="flex items-center gap-2 cursor-pointer py-1">
          <input
            type="radio" checked={selectedId === opt.id}
            name={label}
            onChange={() => onChange([opt.id])}
            className="text-[#1e3a5f]"
          />
          <span className="text-sm text-gray-700">{opt.label}</span>
        </label>
      ))}
    </div>
  )
}

function CheckboxGroupId({ label, options, values, onChange, columns = 1 }: {
  label: string; options: { id: number; label: string }[]; values: number[];
  onChange: (v: number[]) => void; columns?: number
}) {
  const toggle = (id: number) => {
    if (values.includes(id)) {
      onChange(values.filter(v => v !== id))
    } else {
      onChange([...values, id])
    }
  }
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '4px' }}>
        {options.map(opt => (
          <label key={opt.id} className="flex items-start gap-2 cursor-pointer py-1">
            <input
              type="checkbox" checked={values.includes(opt.id)}
              onChange={() => toggle(opt.id)}
              className="mt-0.5 text-[#1e3a5f]"
            />
            <span className="text-sm text-gray-700">{opt.label}</span>
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
        type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 text-[#1e3a5f]"
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
  const [originalDossier, setOriginalDossier] = useState<DossierData>(DEFAULT_DOSSIER)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

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
        .from('reservistes')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!reservisteData) { router.push('/'); return }

      setReserviste(reservisteData)

      // Protection: les non-approuvés n'ont pas accès au dossier
      if (reservisteData.groupe !== 'Approuvé') {
        router.push('/')
        return
      }

      setLoading(false)

      // Charger le dossier depuis n8n/Monday
      try {
        const response = await fetch(
          `https://n8n.aqbrs.ca/webhook/riusc-get-dossier?benevole_id=${reservisteData.benevole_id}`
        )
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
              allergies_oui_non: d.allergies_oui_non || [],
              allergie_detail: d.allergie_detail || '',
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
              langues_parlees: d.langues_parlees || [],
              autres_langues: d.autres_langues || '',
              provenance: d.provenance || [],
              membre_groupe_rs: d.membre_groupe_rs || [],
              organisme_autre: d.organisme_autre || '',
              autres_competences: d.autres_competences || '',
              commentaire: d.commentaire || '',
              confidentialite: d.confidentialite || false,
            }
            setDossier(loaded)
            setOriginalDossier(loaded)
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
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-update-dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          dossier: {
            grandeur_bottes: dossier.grandeur_bottes,
            j_ai_18_ans: dossier.j_ai_18_ans,
            allergies_oui_non: dossier.allergies_oui_non,
            allergie_detail: dossier.allergie_detail,
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
            langues_parlees: dossier.langues_parlees,
            autres_langues: dossier.autres_langues,
            provenance: dossier.provenance,
            membre_groupe_rs: dossier.membre_groupe_rs,
            organisme_autre: dossier.organisme_autre,
            autres_competences: dossier.autres_competences,
            commentaire: dossier.commentaire,
            confidentialite: dossier.confidentialite,
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Dossier sauvegardé avec succès !' })
        setOriginalDossier({ ...dossier })
        setHasChanges(false)
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Erreur lors de la sauvegarde' })
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setSaveMessage({ type: 'error', text: 'Erreur de connexion' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-[#1e3a5f] text-lg">
        Chargement...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {/* Header sticky — standardisé */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6" style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Mon dossier réserviste</p>
            </div>
          </a>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              hasChanges
                ? 'bg-[#1e3a5f] text-white hover:bg-[#2d4a6f] cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </header>

      {/* Message de sauvegarde */}
      {saveMessage && (
        <div className={`max-w-4xl mx-auto px-6 mt-4`}>
          <div className={`p-4 rounded-lg text-sm font-medium ${
            saveMessage.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {saveMessage.text}
          </div>
        </div>
      )}

      {/* Formulaire */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Lien retour standardisé */}
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>&larr; Retour &agrave; l&apos;accueil</a>
        </div>

        {/* ── Identité ── */}
        <Section title="Identité" icon="👤">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <TextInput label="Prénom" value={dossier.prenom} onChange={() => {}} disabled />
            <TextInput label="Nom de famille" value={dossier.nom} onChange={() => {}} disabled />
          </div>
          <TextInput label="Courriel" value={dossier.email} onChange={() => {}} disabled />
          <TextInput label="Date de naissance" value={dossier.date_naissance} onChange={() => {}} disabled type="text" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <TextInput
              label="Grandeur de bottes"
              value={dossier.grandeur_bottes}
              onChange={v => updateDossier('grandeur_bottes', v)}
              placeholder="Ex: 10"
            />
          </div>
          <Checkbox
            label="Je confirme avoir 18 ans ou plus"
            checked={dossier.j_ai_18_ans}
            onChange={v => updateDossier('j_ai_18_ans', v)}
          />
        </Section>

        {/* ── Santé ── */}
        <Section title="Santé" icon="🏥">
          <RadioGroupId
            label="Avez-vous des allergies ou d'autres problèmes médicaux dont l'équipe de gestion des incidents devrait être informée?"
            options={OPTIONS.allergies_oui_non}
            value={dossier.allergies_oui_non}
            onChange={v => updateDossier('allergies_oui_non', v)}
          />
          {dossier.allergies_oui_non.includes(1) && (
            <TextArea
              label="Détails (allergies, problèmes de santé)"
              value={dossier.allergie_detail}
              onChange={v => updateDossier('allergie_detail', v)}
              placeholder="Décrivez vos allergies ou problèmes médicaux..."
            />
          )}
        </Section>

        {/* ── Compétences RS ── */}
        <Section title="Compétences en recherche et sauvetage" icon="🔍">
          <RadioGroupId
            label="Compétence en recherche et sauvetage au sol"
            options={OPTIONS.competence_rs}
            value={dossier.competence_rs}
            onChange={v => updateDossier('competence_rs', v)}
          />
        </Section>

        {/* ── Certifications ── */}
        <Section title="Certifications" icon="🩺">
          <CheckboxGroupId
            label="Certificat de premiers soins (en cours de validité)"
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
          <div className="mt-6">
            <RadioGroupId
              label="Certification CSI / ICS"
              options={[{ id: 0, label: 'Aucune' }, ...OPTIONS.certification_csi]}
              value={dossier.certification_csi.length > 0 ? dossier.certification_csi : [0]}
              onChange={v => updateDossier('certification_csi', v[0] === 0 ? [] : v)}
            />
          </div>
        </Section>

        {/* ── Transport ── */}
        <Section title="Transport et véhicules" icon="🚗">
          <CheckboxGroupId
            label="Catégorie de permis de conduire"
            options={OPTIONS.permis_conduire}
            values={dossier.permis_conduire}
            onChange={v => updateDossier('permis_conduire', v)}
          />
          <div className="mt-6">
            <CheckboxGroupId
              label="Véhicule tout-terrain"
              options={OPTIONS.vehicule_tout_terrain}
              values={dossier.vehicule_tout_terrain}
              onChange={v => updateDossier('vehicule_tout_terrain', v)}
            />
          </div>
          <div className="mt-6">
            <CheckboxGroupId
              label="Navire marin"
              options={OPTIONS.navire_marin}
              values={dossier.navire_marin}
              onChange={v => updateDossier('navire_marin', v)}
            />
          </div>
          <div className="mt-6">
            <CheckboxGroupId
              label="Disponible pour offrir du covoiturage"
              options={OPTIONS.disponible_covoiturage}
              values={dossier.disponible_covoiturage}
              onChange={v => updateDossier('disponible_covoiturage', v)}
            />
          </div>
        </Section>

        {/* ── Compétences spécialisées ── */}
        <Section title="Compétences spécialisées" icon="⚙️">
          <CheckboxGroupId
            label="SATP Pilote (Drone) / RPAS Pilot"
            options={OPTIONS.satp_drone}
            values={dossier.satp_drone}
            onChange={v => updateDossier('satp_drone', v)}
          />
          <div className="mt-6">
            <CheckboxGroupId
              label="Équipe Canine R-S / SAR Dog Team"
              options={OPTIONS.equipe_canine}
              values={dossier.equipe_canine}
              onChange={v => updateDossier('equipe_canine', v)}
            />
          </div>
          <div className="mt-6">
            <CheckboxGroupId
              label="Compétences en sécurité"
              options={OPTIONS.competences_securite}
              values={dossier.competences_securite}
              onChange={v => updateDossier('competences_securite', v)}
            />
          </div>
          <div className="mt-6">
            <CheckboxGroupId
              label="Compétences en sauvetage"
              options={OPTIONS.competences_sauvetage}
              values={dossier.competences_sauvetage}
              onChange={v => updateDossier('competences_sauvetage', v)}
            />
          </div>
        </Section>

        {/* ── Communication & SIG ── */}
        <Section title="Communication et cartographie" icon="📡">
          <CheckboxGroupId
            label="Communication"
            options={OPTIONS.communication}
            values={dossier.communication}
            onChange={v => updateDossier('communication', v)}
          />
          <div className="mt-6">
            <CheckboxGroupId
              label="Cartographie / SIG"
              options={OPTIONS.cartographie_sig}
              values={dossier.cartographie_sig}
              onChange={v => updateDossier('cartographie_sig', v)}
            />
          </div>
        </Section>

        {/* ── Opération urgence ── */}
        <Section title="Opérations d'urgence" icon="🚨">
          <CheckboxGroupId
            label="Expérience en opération d'urgence"
            options={OPTIONS.operation_urgence}
            values={dossier.operation_urgence}
            onChange={v => updateDossier('operation_urgence', v)}
          />
        </Section>

        {/* ── Langues ── */}
        <Section title="Langues" icon="🌐">
          <CheckboxGroupId
            label="Langues parlées"
            options={OPTIONS.langues_parlees}
            values={dossier.langues_parlees}
            onChange={v => updateDossier('langues_parlees', v)}
            columns={2}
          />
          <TextInput
            label="Autres langues"
            value={dossier.autres_langues}
            onChange={v => updateDossier('autres_langues', v)}
            placeholder="Précisez si non listée ci-dessus"
          />
        </Section>

        {/* ── Affiliation ── */}
        <Section title="Affiliation" icon="🏛️">
          <CheckboxGroupId
            label="Provenance"
            options={OPTIONS.provenance}
            values={dossier.provenance}
            onChange={v => updateDossier('provenance', v)}
          />
          <div className="mt-6">
            <CheckboxGroupId
              label="Membre d'un groupe de recherche et sauvetage"
              options={OPTIONS.membre_groupe_rs}
              values={dossier.membre_groupe_rs}
              onChange={v => updateDossier('membre_groupe_rs', v)}
            />
          </div>
          <TextInput
            label="Autre organisme"
            value={dossier.organisme_autre}
            onChange={v => updateDossier('organisme_autre', v)}
            placeholder="Si applicable"
          />
        </Section>

        {/* ── Notes ── */}
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

      {/* Barre de sauvegarde sticky en bas */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-amber-600 font-medium">
              ⚠️ Vous avez des modifications non sauvegardées
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-semibold hover:bg-[#2d4a6f] transition-colors"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
