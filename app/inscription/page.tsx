'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { logPageVisit } from '@/utils/logEvent'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const AQBRS_ORG_ID = 'bb948f22-a29e-42db-bdd9-aabab8a95abd'
const AUCUNE_ORG_ID = 'AUCUNE'

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  context?: Array<{
    id: string;
    text: string;
  }>;
}

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
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return '1' + digits
  }
  return digits
}

const GROUPES_RS = [
  'District 1: Équipe de RS La Grande-Ourse',
  'District 1: EBRES du KRTB',
  'District 2: Sauvetage Région 02',
  'District 3: Recherche et Sauvetage Québec-Métro (RSQM)',
  'District 3: Recherche Sauvetage Tourville',
  'District 4: Eurêka Recherche et sauvetage',
  'District 4: SIUCQ Drummondville',
  'District 4: SIUCQ MRC Arthabaska',
  'District 4: SIUSQ Division Mauricie',
  'District 4: Sauvetage Mauricie K9',
  'District 5: Recherche Sauvetage Estrie',
  "District 6: Sauvetage Baie-D'Urfé",
  'District 6: Ambulance St-Jean - Div. 971 Laval',
  'District 6: Québec Secours',
  'District 6: Pointe-Claire Rescue',
  'District 6: Recherche Sauvetage Laurentides Lanaudière',
  'District 6: S&R Balise Beacon R&S',
  'District 7: Sauvetage Bénévole Outaouais',
  'District 7: SAR 360',
  'District 8: Recherche et sauvetage du Témiscamingue R.E.S.Tem',
  'District 9: Groupe de recherche Manicouagan'
]

interface Organisation {
  id: string
  nom: string
}

// ─── Régions administratives du Québec ───────────────────────────────────────

const REGIONS_QUEBEC = [
  'Bas-Saint-Laurent',
  'Saguenay–Lac-Saint-Jean',
  'Capitale-Nationale',
  'Mauricie',
  'Estrie',
  'Montréal',
  'Outaouais',
  'Abitibi-Témiscamingue',
  'Côte-Nord',
  'Nord-du-Québec',
  'Gaspésie–Îles-de-la-Madeleine',
  'Chaudière-Appalaches',
  'Laval',
  'Lanaudière',
  'Laurentides',
  'Montérégie',
  'Centre-du-Québec',
] as const

const FSA_TO_REGION: Record<string, string> = {
  G4W:'Bas-Saint-Laurent',G5L:'Bas-Saint-Laurent',G5M:'Bas-Saint-Laurent',G5N:'Bas-Saint-Laurent',
  G5R:'Bas-Saint-Laurent',G5S:'Bas-Saint-Laurent',G0J:'Bas-Saint-Laurent',G0K:'Bas-Saint-Laurent',G0L:'Bas-Saint-Laurent',
  G7H:'Saguenay–Lac-Saint-Jean',G7J:'Saguenay–Lac-Saint-Jean',G7K:'Saguenay–Lac-Saint-Jean',G7N:'Saguenay–Lac-Saint-Jean',
  G7P:'Saguenay–Lac-Saint-Jean',G7S:'Saguenay–Lac-Saint-Jean',G7T:'Saguenay–Lac-Saint-Jean',G7X:'Saguenay–Lac-Saint-Jean',
  G7Y:'Saguenay–Lac-Saint-Jean',G7Z:'Saguenay–Lac-Saint-Jean',G8A:'Saguenay–Lac-Saint-Jean',G8B:'Saguenay–Lac-Saint-Jean',
  G8C:'Saguenay–Lac-Saint-Jean',G8E:'Saguenay–Lac-Saint-Jean',G8G:'Saguenay–Lac-Saint-Jean',G8H:'Saguenay–Lac-Saint-Jean',
  G8J:'Saguenay–Lac-Saint-Jean',G8K:'Saguenay–Lac-Saint-Jean',G8L:'Saguenay–Lac-Saint-Jean',G8M:'Saguenay–Lac-Saint-Jean',
  G8N:'Saguenay–Lac-Saint-Jean',G8P:'Saguenay–Lac-Saint-Jean',G0W:'Saguenay–Lac-Saint-Jean',
  G1A:'Capitale-Nationale',G1B:'Capitale-Nationale',G1C:'Capitale-Nationale',G1E:'Capitale-Nationale',G1G:'Capitale-Nationale',
  G1H:'Capitale-Nationale',G1J:'Capitale-Nationale',G1K:'Capitale-Nationale',G1L:'Capitale-Nationale',G1M:'Capitale-Nationale',
  G1N:'Capitale-Nationale',G1P:'Capitale-Nationale',G1R:'Capitale-Nationale',G1S:'Capitale-Nationale',G1T:'Capitale-Nationale',
  G1V:'Capitale-Nationale',G1W:'Capitale-Nationale',G1X:'Capitale-Nationale',G1Y:'Capitale-Nationale',
  G2A:'Capitale-Nationale',G2B:'Capitale-Nationale',G2C:'Capitale-Nationale',G2E:'Capitale-Nationale',G2G:'Capitale-Nationale',
  G2J:'Capitale-Nationale',G2K:'Capitale-Nationale',G2L:'Capitale-Nationale',G2M:'Capitale-Nationale',G2N:'Capitale-Nationale',
  G3A:'Capitale-Nationale',G3B:'Capitale-Nationale',G3C:'Capitale-Nationale',G3E:'Capitale-Nationale',G3G:'Capitale-Nationale',
  G3H:'Capitale-Nationale',G3J:'Capitale-Nationale',G3K:'Capitale-Nationale',G3L:'Capitale-Nationale',G3M:'Capitale-Nationale',
  G3N:'Capitale-Nationale',G3Z:'Capitale-Nationale',G0A:'Capitale-Nationale',G0N:'Capitale-Nationale',
  G8T:'Mauricie',G8V:'Mauricie',G8W:'Mauricie',G8X:'Mauricie',G8Y:'Mauricie',G8Z:'Mauricie',
  G9A:'Mauricie',G9B:'Mauricie',G9C:'Mauricie',G9N:'Mauricie',G9P:'Mauricie',G9T:'Mauricie',G9X:'Mauricie',
  G0T:'Mauricie',G0V:'Mauricie',G0X:'Mauricie',
  J1H:'Estrie',J1J:'Estrie',J1K:'Estrie',J1L:'Estrie',J1M:'Estrie',J1N:'Estrie',J1R:'Estrie',J1S:'Estrie',
  J1T:'Estrie',J1X:'Estrie',J1Z:'Estrie',J0B:'Estrie',
  H1A:'Montréal',H1B:'Montréal',H1C:'Montréal',H1E:'Montréal',H1G:'Montréal',H1H:'Montréal',H1J:'Montréal',H1K:'Montréal',
  H1L:'Montréal',H1M:'Montréal',H1N:'Montréal',H1P:'Montréal',H1R:'Montréal',H1S:'Montréal',H1T:'Montréal',H1V:'Montréal',
  H1W:'Montréal',H1X:'Montréal',H1Y:'Montréal',H1Z:'Montréal',H2A:'Montréal',H2B:'Montréal',H2C:'Montréal',H2E:'Montréal',
  H2G:'Montréal',H2H:'Montréal',H2J:'Montréal',H2K:'Montréal',H2L:'Montréal',H2M:'Montréal',H2N:'Montréal',H2P:'Montréal',
  H2R:'Montréal',H2S:'Montréal',H2T:'Montréal',H2V:'Montréal',H2W:'Montréal',H2X:'Montréal',H2Y:'Montréal',H2Z:'Montréal',
  H3A:'Montréal',H3B:'Montréal',H3C:'Montréal',H3E:'Montréal',H3G:'Montréal',H3H:'Montréal',H3J:'Montréal',H3K:'Montréal',
  H3L:'Montréal',H3M:'Montréal',H3N:'Montréal',H3P:'Montréal',H3R:'Montréal',H3S:'Montréal',H3T:'Montréal',H3V:'Montréal',
  H3W:'Montréal',H3X:'Montréal',H3Y:'Montréal',H3Z:'Montréal',H4A:'Montréal',H4B:'Montréal',H4C:'Montréal',H4E:'Montréal',
  H4G:'Montréal',H4H:'Montréal',H4J:'Montréal',H4K:'Montréal',H4L:'Montréal',H4M:'Montréal',H4N:'Montréal',H4P:'Montréal',
  H4R:'Montréal',H4S:'Montréal',H4T:'Montréal',H4V:'Montréal',H4W:'Montréal',H4X:'Montréal',H4Y:'Montréal',H4Z:'Montréal',
  H5A:'Montréal',H5B:'Montréal',H8N:'Montréal',H8P:'Montréal',H8R:'Montréal',H8S:'Montréal',H8T:'Montréal',
  H9A:'Montréal',H9B:'Montréal',H9C:'Montréal',H9E:'Montréal',H9G:'Montréal',H9H:'Montréal',H9J:'Montréal',H9K:'Montréal',
  H9P:'Montréal',H9R:'Montréal',H9S:'Montréal',H9W:'Montréal',H9X:'Montréal',
  J8L:'Outaouais',J8M:'Outaouais',J8N:'Outaouais',J8P:'Outaouais',J8R:'Outaouais',J8T:'Outaouais',J8V:'Outaouais',
  J8X:'Outaouais',J8Y:'Outaouais',J8Z:'Outaouais',J9A:'Outaouais',J9H:'Outaouais',J9J:'Outaouais',
  J0V:'Outaouais',J0X:'Outaouais',
  J9B:'Abitibi-Témiscamingue',J9E:'Abitibi-Témiscamingue',J9L:'Abitibi-Témiscamingue',J9T:'Abitibi-Témiscamingue',
  J9V:'Abitibi-Témiscamingue',J9X:'Abitibi-Témiscamingue',J9Y:'Abitibi-Témiscamingue',J9Z:'Abitibi-Témiscamingue',
  J0Y:'Abitibi-Témiscamingue',J0Z:'Abitibi-Témiscamingue',
  G4R:'Côte-Nord',G4S:'Côte-Nord',G4T:'Côte-Nord',G5A:'Côte-Nord',G5B:'Côte-Nord',G5C:'Côte-Nord',
  G0G:'Côte-Nord',G0H:'Côte-Nord',
  J0M:'Nord-du-Québec',
  G0C:'Gaspésie–Îles-de-la-Madeleine',G0E:'Gaspésie–Îles-de-la-Madeleine',G0M:'Gaspésie–Îles-de-la-Madeleine',
  G4V:'Gaspésie–Îles-de-la-Madeleine',G4X:'Gaspésie–Îles-de-la-Madeleine',G4Y:'Gaspésie–Îles-de-la-Madeleine',
  G4Z:'Gaspésie–Îles-de-la-Madeleine',G5H:'Gaspésie–Îles-de-la-Madeleine',
  G5Y:'Chaudière-Appalaches',G5Z:'Chaudière-Appalaches',G6A:'Chaudière-Appalaches',G6B:'Chaudière-Appalaches',
  G6C:'Chaudière-Appalaches',G6E:'Chaudière-Appalaches',G6G:'Chaudière-Appalaches',G6H:'Chaudière-Appalaches',
  G6J:'Chaudière-Appalaches',G6K:'Chaudière-Appalaches',G6L:'Chaudière-Appalaches',G6P:'Chaudière-Appalaches',
  G6R:'Chaudière-Appalaches',G6S:'Chaudière-Appalaches',G6T:'Chaudière-Appalaches',G6V:'Chaudière-Appalaches',
  G6W:'Chaudière-Appalaches',G6X:'Chaudière-Appalaches',G6Y:'Chaudière-Appalaches',G6Z:'Chaudière-Appalaches',
  G7A:'Chaudière-Appalaches',G7B:'Chaudière-Appalaches',G7C:'Chaudière-Appalaches',G7E:'Chaudière-Appalaches',G7G:'Chaudière-Appalaches',
  G0R:'Chaudière-Appalaches',G0S:'Chaudière-Appalaches',
  H7A:'Laval',H7B:'Laval',H7C:'Laval',H7E:'Laval',H7G:'Laval',H7H:'Laval',H7J:'Laval',H7K:'Laval',
  H7L:'Laval',H7M:'Laval',H7N:'Laval',H7P:'Laval',H7R:'Laval',H7S:'Laval',H7T:'Laval',H7V:'Laval',H7W:'Laval',H7X:'Laval',H7Y:'Laval',
  J0K:'Lanaudière',J5L:'Lanaudière',J5R:'Lanaudière',J5T:'Lanaudière',J5V:'Lanaudière',J5W:'Lanaudière',
  J5X:'Lanaudière',J5Y:'Lanaudière',J5Z:'Lanaudière',J6E:'Lanaudière',J6S:'Lanaudière',J6V:'Lanaudière',
  J6W:'Lanaudière',J6X:'Lanaudière',J6Y:'Lanaudière',J6Z:'Lanaudière',
  J0N:'Laurentides',J0R:'Laurentides',J0T:'Laurentides',J7A:'Laurentides',J7B:'Laurentides',J7C:'Laurentides',
  J7E:'Laurentides',J7G:'Laurentides',J7H:'Laurentides',J7J:'Laurentides',J7K:'Laurentides',J7L:'Laurentides',
  J7M:'Laurentides',J7N:'Laurentides',J7P:'Laurentides',J7R:'Laurentides',J7S:'Laurentides',J7T:'Laurentides',
  J7V:'Laurentides',J7W:'Laurentides',J7X:'Laurentides',J7Y:'Laurentides',J7Z:'Laurentides',
  J8A:'Laurentides',J8B:'Laurentides',J8C:'Laurentides',J8E:'Laurentides',J8G:'Laurentides',J8H:'Laurentides',J8K:'Laurentides',
  J0H:'Montérégie',J0L:'Montérégie',J0S:'Montérégie',J3A:'Montérégie',J3B:'Montérégie',J3E:'Montérégie',J3G:'Montérégie',
  J3H:'Montérégie',J3L:'Montérégie',J3M:'Montérégie',J3N:'Montérégie',J3P:'Montérégie',J3R:'Montérégie',J3T:'Montérégie',
  J3V:'Montérégie',J3X:'Montérégie',J3Y:'Montérégie',J3Z:'Montérégie',J4B:'Montérégie',J4G:'Montérégie',J4H:'Montérégie',
  J4J:'Montérégie',J4K:'Montérégie',J4L:'Montérégie',J4M:'Montérégie',J4N:'Montérégie',J4P:'Montérégie',J4R:'Montérégie',
  J4S:'Montérégie',J4T:'Montérégie',J4V:'Montérégie',J4W:'Montérégie',J4X:'Montérégie',J4Y:'Montérégie',J4Z:'Montérégie',
  J5A:'Montérégie',J5B:'Montérégie',J5C:'Montérégie',J5J:'Montérégie',J5K:'Montérégie',J5M:'Montérégie',J5N:'Montérégie',
  J0A:'Centre-du-Québec',J0C:'Centre-du-Québec',J0G:'Centre-du-Québec',J1A:'Centre-du-Québec',
  J2A:'Centre-du-Québec',J2B:'Centre-du-Québec',J2C:'Centre-du-Québec',J2E:'Centre-du-Québec',J2G:'Centre-du-Québec',
  J2H:'Centre-du-Québec',J2K:'Centre-du-Québec',J2L:'Centre-du-Québec',J2M:'Centre-du-Québec',J2N:'Centre-du-Québec',
  J2R:'Centre-du-Québec',J2S:'Centre-du-Québec',J2T:'Centre-du-Québec',G0P:'Centre-du-Québec',G0Z:'Centre-du-Québec',
}

function detecterRegionParFSA(codePostal: string): string | null {
  const fsa = codePostal.replace(/\s/g, '').toUpperCase().slice(0, 3)
  return FSA_TO_REGION[fsa] || null
}

export default function InscriptionPage() {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [emailConfirm, setEmailConfirm] = useState('')
  const [campInscrit, setCampInscrit] = useState(false)
  const [nomCampInscrit, setNomCampInscrit] = useState('')
  const [isListeAttente, setIsListeAttente] = useState(false)
  
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    code_postal: '',
    region: '',
    latitude: null as number | null,
    longitude: null as number | null,
    groupe_rs: [] as string[],
    commentaire: '',
    confirm_18: false,
    consent_photos: false,
    consent_confidentialite: false,
    consent_antecedents: false
  })

  // ─── Organisations ──────────────────────────────────────────────────────────
  const [allOrgs, setAllOrgs] = useState<Organisation[]>([])
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([AUCUNE_ORG_ID])
  const [newOrgName, setNewOrgName] = useState('')
  const [showNewOrgInput, setShowNewOrgInput] = useState(false)
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  // ────────────────────────────────────────────────────────────────────────────

  // ─── Camps et Santé ─────────────────────────────────────────────────────────
  const [sessionsDisponibles, setSessionsDisponibles] = useState<Array<{
    session_id: string;
    monday_id?: string;
    nom: string;
    dates: string;
    site: string;
    location: string;
  }>>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string>('PLUS_TARD')
  const [allergiesAlimentaires, setAllergiesAlimentaires] = useState('')
  const [autresAllergies, setAutresAllergies] = useState('')
  const [conditionsMedicales, setConditionsMedicales] = useState('')
  const [consentementPhoto, setConsentementPhoto] = useState(false)
  const [sessionCapacities, setSessionCapacities] = useState<Record<string, { inscrits: number; capacite: number; attente: number; attente_max: number; places_restantes: number; statut: string }>>({})
  const [loadingCapacities, setLoadingCapacities] = useState(true)
  // ────────────────────────────────────────────────────────────────────────────

  const [addressSuggestions, setAddressSuggestions] = useState<MapboxFeature[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const addressDropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const [villeSuggestions, setVilleSuggestions] = useState<Array<{ municipalite: string; region_administrative: string; mrc: string }>>([])
  const [showVilleSuggestions, setShowVilleSuggestions] = useState(false)
  const [isLoadingVille, setIsLoadingVille] = useState(false)
  const villeInputRef = useRef<HTMLInputElement>(null)
  const villeDropdownRef = useRef<HTMLDivElement>(null)
  const villeDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const [regionNonDetectee, setRegionNonDetectee] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const isAqbrsSelected = selectedOrgIds.includes(AQBRS_ORG_ID)

  const [campId, setCampId] = useState('')
  useEffect(() => {
    logPageVisit('/inscription')
    const params = new URLSearchParams(window.location.search)
    setCampId(params.get('camp') || '')
    const emailParam = params.get('email')
    if (emailParam) {
      setFormData(prev => ({ ...prev, email: emailParam }))
    }
  }, [])

  useEffect(() => {
    const fetchOrgs = async () => {
      const { data } = await supabase
        .from('organisations')
        .select('id, nom')
        .order('nom')
      setAllOrgs(data || [])
      setLoadingOrgs(false)
    }
    fetchOrgs()
  }, [])

  // Liste statique des camps 2026 (au lieu de charger depuis Monday.com) Ca marche tu ?
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const campsStat = [
      {
        session_id: 'CAMP_STE_CATHERINE_MAR26',
        monday_id: '11074000836',
        nom: 'Cohorte 8 - Camp de qualification - Sainte-Catherine',
        dates: '14 et 15 mars 2026',
        date_fin: new Date('2026-03-15'),
        site: "Centre Municipal Aimé-Guérin",
        location: '5365 Boul Saint-Laurent, Sainte-Catherine, QC, Canada'
      },
      {
        session_id: 'CAMP_CHICOUTIMI_AVR26',
        monday_id: '11267314669',
        nom: 'Cohorte 9 - Camp de qualification - Chicoutimi',
        dates: '25-26 avril 2026',
        date_fin: new Date('2026-04-26'),
        site: 'Hôtel Chicoutimi',
        location: '460 Rue Racine Est, Chicoutimi, Québec G7H 1T7, Canada'
      },
      {
        session_id: 'CAMP_QUEBEC_MAI26',
        monday_id: '11267288411',
        nom: 'Cohorte 10 - Camp de qualification - Québec',
        dates: '23-24 mai 2026',
        date_fin: new Date('2026-05-24'),
        site: 'Résidences Campus Notre-Dame-De-Foy',
        location: 'Québec, QC'
      },
      {
        session_id: 'CAMP_RIMOUSKI_SEP26',
        monday_id: '11267307391',
        nom: 'Cohorte 11 - Camp de qualification - Rimouski',
        dates: '26-27 septembre 2026',
        date_fin: new Date('2026-09-27'),
        site: 'À définir',
        location: 'Rimouski, QC'
      },
      {
        session_id: 'CAMP_SHERBROOKE_OCT26',
        monday_id: '11267307484',
        nom: 'Cohorte 12 - Camp de qualification - Sherbrooke',
        dates: '17-18 octobre 2026',
        date_fin: new Date('2026-10-18'),
        site: 'À définir',
        location: 'Sherbrooke, QC'
      },
      {
        session_id: 'CAMP_GATINEAU_NOV26',
        monday_id: '11267277716',
        nom: 'Cohorte 13 - Camp de qualification - Gatineau',
        dates: '14-15 novembre 2026',
        date_fin: new Date('2026-11-15'),
        site: 'À définir',
        location: 'Gatineau, QC'
      }
    ].filter(c => c.date_fin >= today)
    
    setSessionsDisponibles(campsStat)
    setLoadingSessions(false)
    
    // Pré-sélectionner le camp si présent dans l'URL
    if (campId) {
      const campTrouve = campsStat.find(s => s.session_id === campId)
      if (campTrouve) {
        setSelectedSessionId(campId)
      }
    }

    // Charger les capacités
    fetch('https://n8n.aqbrs.ca/webhook/camp-capacity')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.success && data.sessions) {
          setSessionCapacities(data.sessions)
        }
      })
      .catch(e => console.error('Erreur capacité camps:', e))
      .finally(() => setLoadingCapacities(false))
  }, [campId])

  // NOTE: useEffect de pré-sélection retiré car fusionné ci-dessus

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressDropdownRef.current && !addressDropdownRef.current.contains(event.target as Node) &&
          addressInputRef.current && !addressInputRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false)
      }
      if (villeDropdownRef.current && !villeDropdownRef.current.contains(event.target as Node) &&
          villeInputRef.current && !villeInputRef.current.contains(event.target as Node)) {
        setShowVilleSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (field: string, value: string | boolean) => {
    const formatted = field === 'telephone' && typeof value === 'string'
      ? formatPhoneDisplay(value)
      : value
    setFormData(prev => ({ ...prev, [field]: formatted }))
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handlePhoneBlur = () => {
    setFormData(prev => ({ ...prev, telephone: formatPhoneDisplay(prev.telephone) }))
  }

  const toggleOrg = (id: string) => {
    // Si on coche une organisation réelle, décocher automatiquement "Aucune"
    if (id !== AUCUNE_ORG_ID && !selectedOrgIds.includes(id)) {
      setSelectedOrgIds(prev => [...prev.filter(x => x !== AUCUNE_ORG_ID), id])
    } 
    // Si on coche "Aucune", décocher toutes les autres organisations
    else if (id === AUCUNE_ORG_ID && !selectedOrgIds.includes(id)) {
      setSelectedOrgIds([AUCUNE_ORG_ID])
      // Vider aussi les groupes RS si AQBRS était sélectionné
      setFormData(prev => ({ ...prev, groupe_rs: [] }))
    }
    // Si on décoche une organisation
    else if (selectedOrgIds.includes(id)) {
      const newSelected = selectedOrgIds.filter(x => x !== id)
      // Si on décoche tout, remettre "Aucune" par défaut
      if (newSelected.length === 0) {
        setSelectedOrgIds([AUCUNE_ORG_ID])
      } else {
        setSelectedOrgIds(newSelected)
      }
      // Si on décoche AQBRS, vider les groupes RS
      if (id === AQBRS_ORG_ID) {
        setFormData(prev => ({ ...prev, groupe_rs: [] }))
      }
    }
    
    if (fieldErrors.organisations) {
      setFieldErrors(prev => ({ ...prev, organisations: '' }))
    }
  }

  const toggleGroupeRS = (groupe: string) => {
    setFormData(prev => ({
      ...prev,
      groupe_rs: prev.groupe_rs.includes(groupe)
        ? prev.groupe_rs.filter(g => g !== groupe)
        : [...prev.groupe_rs, groupe]
    }))
  }

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) { setAddressSuggestions([]); return }
    setIsLoadingAddress(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=ca&language=fr&types=address&limit=5`
      )
      const data = await response.json()
      setAddressSuggestions(data.features || [])
      setShowAddressSuggestions(true)
    } catch (error) { console.error('Erreur recherche adresse:', error) }
    setIsLoadingAddress(false)
  }, [])

  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, adresse: value, latitude: null, longitude: null }))
    if (fieldErrors.adresse) setFieldErrors(prev => ({ ...prev, adresse: '' }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAddress(value), 300)
  }

  const lookupRegionFromVille = async (ville: string, codePostalFallback?: string): Promise<boolean> => {
    if (!ville) return false

    // Stratégie 1 : table municipalites_qc
    const { data } = await supabase
      .from('municipalites_qc')
      .select('region_administrative')
      .ilike('municipalite', ville)
      .limit(1)
      .single()

    if (data?.region_administrative) {
      setFormData(prev => ({ ...prev, region: data.region_administrative }))
      setRegionNonDetectee(false)
      if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
      return true
    }

    // Stratégie 2 : FSA du code postal (arrondissements, villes fusionnées)
    const cp = codePostalFallback || ''
    if (cp.length >= 3) {
      const regionFSA = detecterRegionParFSA(cp)
      if (regionFSA) {
        setFormData(prev => ({ ...prev, region: regionFSA }))
        setRegionNonDetectee(false)
        if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
        return true
      }
    }

    // Aucune détection → afficher le sélecteur manuel
    setRegionNonDetectee(true)
    return false
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
    setFormData(prev => ({
      ...prev,
      adresse: feature.place_name,
      latitude: lat,
      longitude: lng,
      ville: ville || prev.ville,
      ...(codePostal ? { code_postal: codePostal } : {})
    }))
    if (codePostal && fieldErrors.code_postal) setFieldErrors(prev => ({ ...prev, code_postal: '' }))
    setShowAddressSuggestions(false)
    setAddressSuggestions([])
    if (ville) {
      lookupRegionFromVille(ville, codePostal || formData.code_postal)
    } else if (codePostal || formData.code_postal) {
      const cp = codePostal || formData.code_postal
      const regionFSA = detecterRegionParFSA(cp)
      if (regionFSA) {
        setFormData(prev => ({ ...prev, region: regionFSA }))
        setRegionNonDetectee(false)
        if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
      } else {
        setRegionNonDetectee(true)
      }
    }
  }

  const searchVille = async (query: string) => {
    if (query.length < 2) { setVilleSuggestions([]); return }
    setIsLoadingVille(true)
    try {
      const { data, error } = await supabase
        .from('municipalites_qc')
        .select('municipalite, region_administrative, mrc')
        .ilike('municipalite', `${query}%`)
        .order('municipalite')
        .limit(8)
      if (!error && data) { setVilleSuggestions(data); setShowVilleSuggestions(true) }
    } catch (e) { console.error('Erreur recherche ville:', e) }
    setIsLoadingVille(false)
  }

  const handleVilleChange = (value: string) => {
    setFormData(prev => ({ ...prev, ville: value, region: '' }))
    if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
    if (villeDebounceRef.current) clearTimeout(villeDebounceRef.current)
    villeDebounceRef.current = setTimeout(() => searchVille(value), 250)
  }

  const selectVille = (suggestion: { municipalite: string; region_administrative: string; mrc: string }) => {
    setFormData(prev => ({ ...prev, ville: suggestion.municipalite, region: suggestion.region_administrative }))
    setRegionNonDetectee(false)
    setShowVilleSuggestions(false)
    setVilleSuggestions([])
    if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.prenom.trim()) errors.prenom = 'Le prénom est requis'
    if (!formData.nom.trim()) errors.nom = 'Le nom est requis'
    if (!formData.email.trim() || !formData.email.includes('@')) errors.email = 'Courriel invalide'
    if (!emailConfirm.trim()) {
      errors.emailConfirm = 'Veuillez confirmer votre courriel'
    } else if (formData.email.toLowerCase().trim() !== emailConfirm.toLowerCase().trim()) {
      errors.emailConfirm = 'Les courriels ne correspondent pas'
    }
    const phoneDigits = cleanPhoneForSave(formData.telephone)
    if (!phoneDigits || phoneDigits.length !== 11) errors.telephone = 'Numéro de téléphone invalide'
    if (!formData.adresse.trim()) errors.adresse = "L'adresse est requise"
    const codePostalRegex = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i
    if (!formData.code_postal.trim()) errors.code_postal = 'Le code postal est obligatoire'
    else if (!codePostalRegex.test(formData.code_postal.trim())) errors.code_postal = 'Format invalide (ex: J1H 1A1)'
    if (!formData.region) errors.region = 'La région est requise — sélectionnez votre ville ou choisissez-la manuellement'
    // Accepte "Aucune" comme option valide, ou au moins une organisation doit être sélectionnée
    if (selectedOrgIds.length === 0 && !newOrgName.trim()) errors.organisations = 'Veuillez sélectionner au moins une option'
    if (!formData.confirm_18) errors.confirm_18 = 'Vous devez confirmer avoir 18 ans ou plus'
    if (!formData.consent_photos) errors.consent_photos = 'Ce consentement est requis'
    if (!formData.consent_confidentialite) errors.consent_confidentialite = 'Ce consentement est requis'
    if (!formData.consent_antecedents) errors.consent_antecedents = 'Ce consentement est requis'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { setMessage({ type: 'error', text: 'Veuillez corriger les erreurs ci-dessous.' }); return }
    setLoading(true); setMessage(null)
    const emailClean = formData.email.toLowerCase().trim()
    const phoneClean = cleanPhoneForSave(formData.telephone)
    try {
      const { data: emailExists } = await supabase.from('reservistes').select('benevole_id').ilike('email', emailClean).maybeSingle()
      if (emailExists) { setFieldErrors(prev => ({ ...prev, email: 'Ce courriel est déjà enregistré' })); setMessage({ type: 'error', text: 'Ce courriel est déjà associé à un compte existant.' }); setLoading(false); return }

      const isTestPhone = phoneClean === '19999999999' || phoneClean === '9999999999'
      if (!isTestPhone) {
        const { data: phoneExists } = await supabase.from('reservistes').select('benevole_id').eq('telephone', phoneClean).maybeSingle()
        if (!phoneExists && phoneClean.startsWith('1')) {
          const { data: phoneExists2 } = await supabase.from('reservistes').select('benevole_id').eq('telephone', phoneClean.slice(1)).maybeSingle()
          if (phoneExists2) { setFieldErrors(prev => ({ ...prev, telephone: 'Ce numéro de téléphone est déjà enregistré' })); setMessage({ type: 'error', text: 'Ce numéro de téléphone est déjà associé à un compte existant.' }); setLoading(false); return }
        } else if (phoneExists) { setFieldErrors(prev => ({ ...prev, telephone: 'Ce numéro de téléphone est déjà enregistré' })); setMessage({ type: 'error', text: 'Ce numéro de téléphone est déjà associé à un compte existant.' }); setLoading(false); return }
      }

      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-inscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom: formData.prenom.trim(), nom: formData.nom.trim(), email: emailClean,
          telephone: isTestPhone ? null : phoneClean, adresse: formData.adresse,
          ville: formData.ville, code_postal: formData.code_postal.trim().toUpperCase(), region: formData.region, latitude: formData.latitude,
          longitude: formData.longitude,
          groupe_rs: formData.groupe_rs.length > 0 ? formData.groupe_rs.join(', ') : '',
          groupe: 'Nouveaux', commentaire: formData.commentaire, camp_id: campId || null
        })
      })
      if (!response.ok) throw new Error("Erreur lors de l'inscription. Veuillez réessayer.")

      // Récupérer le benevole_id directement de la réponse webhook
     const responseData = await response.json()

if (responseData.error === 'DOUBLON') {
  setFieldErrors(prev => ({ ...prev, email: 'Ce courriel est déjà enregistré' }))
  setMessage({ type: 'error', text: 'Ce courriel est déjà associé à un compte existant. Connectez-vous via la page de connexion.' })
  setLoading(false)
  return
}

const newBenevoleId = responseData.monday_item_id ? String(responseData.monday_item_id) : null
      // Attendre que le sync Monday → Supabase soit complété
      await new Promise(resolve => setTimeout(resolve, 1500))

      if (newBenevoleId) {
        // Sauvegarder le consentement antécédents judiciaires
        await supabase
          .from('reservistes')
          .update({ consentement_antecedents: formData.consent_antecedents })
          .eq('benevole_id', newBenevoleId)

        // Filtrer "AUCUNE" - ne pas la sauvegarder dans la base
        let orgIdsToLink = selectedOrgIds.filter(id => id !== AUCUNE_ORG_ID)
        
        if (newOrgName.trim()) {
          const { data: createdOrg, error: createError } = await supabase
            .from('organisations')
            .insert({ nom: newOrgName.trim(), created_by: newBenevoleId })
            .select('id')
            .single()
          if (createError) {
            const { data: existingOrg } = await supabase
              .from('organisations').select('id').ilike('nom', newOrgName.trim()).single()
            if (existingOrg) orgIdsToLink.push(existingOrg.id)
          } else if (createdOrg) {
            orgIdsToLink.push(createdOrg.id)
          }
        }
        // Ne sauvegarder que si il y a des organisations réelles (pas "Aucune")
        if (orgIdsToLink.length > 0) {
          await supabase.from('reserviste_organisations').insert(
            orgIdsToLink.map(organisation_id => ({ benevole_id: newBenevoleId, organisation_id }))
          )
        }
      }

      // Inscription au camp si sélectionné
      let campInscritSuccess = false
      let campNom = ''
      if (newBenevoleId && selectedSessionId && selectedSessionId !== 'PLUS_TARD') {
        const sessionSelectionnee = sessionsDisponibles.find(s => s.session_id === selectedSessionId)
        campNom = sessionSelectionnee?.nom || 'Camp sélectionné'
        
        try {
          // Mettre à jour les infos santé dans reservistes
          await supabase
            .from('reservistes')
            .update({
              allergies_alimentaires: allergiesAlimentaires || null,
              allergies_autres: autresAllergies || null
            })
            .eq('benevole_id', newBenevoleId)

          // Appeler l'API d'inscription au camp
          const sessionSel = sessionsDisponibles.find(s => s.session_id === selectedSessionId)
          const capInfo = sessionSel?.monday_id ? sessionCapacities[sessionSel.monday_id] : null
          const inscriptionStatut = capInfo?.statut === 'liste_attente' ? 'Liste d\'attente' : 'Inscrit'
          
          const campResponse = await fetch('https://n8n.aqbrs.ca/webhook/inscription-camp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              benevole_id: newBenevoleId,
              session_id: selectedSessionId, // ID fictif pour identifier le camp
              camp_nom: sessionSelectionnee?.nom,
              camp_dates: sessionSelectionnee?.dates,
              camp_site: sessionSelectionnee?.site,
              camp_location: sessionSelectionnee?.location,
              presence: 'confirme',
              statut: inscriptionStatut,
              courriel: emailClean,
              telephone: isTestPhone ? null : phoneClean,
              prenom_nom: `${formData.prenom.trim()} ${formData.nom.trim()}`
            })
          })

          if (campResponse.ok) {
            campInscritSuccess = true
          }
        } catch (error) {
          console.error('Erreur inscription camp:', error)
          // Ne pas bloquer si l'inscription camp échoue
        }
      }

      // Stocker l'info pour la page de succès
      setCampInscrit(campInscritSuccess)
      setNomCampInscrit(campNom)
      
      // Vérifier si c'est une liste d'attente
      if (selectedSessionId && selectedSessionId !== 'PLUS_TARD') {
        const sessionSel = sessionsDisponibles.find(s => s.session_id === selectedSessionId)
        const capInfo = sessionSel?.monday_id ? sessionCapacities[sessionSel.monday_id] : null
        setIsListeAttente(capInfo?.statut === 'liste_attente')
      }

      // Afficher la page de succès avec le bon message
      setStep('success')
    } catch (error: any) { console.error('Erreur inscription:', error); setMessage({ type: 'error', text: error.message || "Erreur lors de l'inscription. Veuillez réessayer." }) }
    setLoading(false)
  }

  // ─── Styles communs ──────────────────────────────────────────────────────────
  const inputStyle = { width: '100%', padding: '12px 14px', fontSize: '15px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' as const, color: '#111827', backgroundColor: 'white' }
  const inputErrorStyle = { ...inputStyle, border: '2px solid #dc2626' }
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' as const, color: '#374151' }
  const sectionStyle = { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
  const sectionTitleStyle = { color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' as const }
  const sectionDescStyle = { color: '#6b7280', fontSize: '13px', margin: '-12px 0 20px 0' }
  const checkboxRowStyle = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: selected ? '#eff6ff' : '#f9fafb',
    border: selected ? '1px solid #bfdbfe' : '1px solid transparent',
    transition: 'background-color 0.15s',
  })
  const requiredStar = <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>
  // ────────────────────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '48px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: '560px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>{isListeAttente ? '⏳' : '✅'}</div>
          <h2 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '24px' }}>Inscription réussie !</h2>
          
          <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px 0' }}>
            Bienvenue dans la RIUSC, <strong>{formData.prenom}</strong> ! Votre compte est en cours de création.
          </p>

          {campInscrit && nomCampInscrit && !isListeAttente && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '16px', margin: '0 0 16px 0' }}>
              <p style={{ margin: '0 0 8px 0', color: '#065f46', fontSize: '15px', fontWeight: '600' }}>
                🎓 Inscription au camp confirmée
              </p>
              <p style={{ margin: 0, color: '#059669', fontSize: '14px' }}>
                {nomCampInscrit}
              </p>
            </div>
          )}

          {campInscrit && nomCampInscrit && isListeAttente && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px', margin: '0 0 16px 0' }}>
              <p style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: '15px', fontWeight: '600' }}>
                ⏳ Vous êtes sur la liste d&apos;attente
              </p>
              <p style={{ margin: 0, color: '#b45309', fontSize: '14px' }}>
                {nomCampInscrit}
              </p>
              <p style={{ margin: '8px 0 0 0', color: '#92400e', fontSize: '13px', lineHeight: '1.5' }}>
                Les places sont actuellement toutes comblées. Nous vous contacterons si une place se libère.
              </p>
            </div>
          )}

          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            Un courriel de confirmation vous sera envoyé à <strong>{formData.email}</strong> avec les prochaines étapes.
          </p>

          <div style={{ backgroundColor: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '16px', borderRadius: '4px', margin: '0 0 24px 0', textAlign: 'left' }}>
            <p style={{ margin: '0 0 8px 0', color: '#1e40af', fontSize: '14px', fontWeight: '600' }}>
              📧 Vérifiez votre boîte email
            </p>
            <p style={{ margin: 0, color: '#1e40af', fontSize: '13px', lineHeight: '1.6' }}>
              Vous recevrez un lien de connexion (magic link) pour accéder à votre portail réserviste.
            </p>
          </div>

          <a href='/login' style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '16px', fontWeight: '600' }}>
            Aller à la page de connexion
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Inscription — Réserve d&apos;Intervention d&apos;Urgence</p>
            </div>
          </div>
          <a href={campId ? `/login?camp=${campId}` : '/login'} style={{ padding: '8px 16px', color: '#1e3a5f', fontSize: '14px', fontWeight: '500', textDecoration: 'none', border: '1px solid #1e3a5f', borderRadius: '6px' }}>Déjà inscrit ? Se connecter</a>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <h2 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Inscription à la RIUSC</h2>
        <p style={{ color: '#6b7280', fontSize: '15px', margin: '0 0 32px 0' }}>Remplissez le formulaire ci-dessous pour vous inscrire comme réserviste bénévole.</p>

        {message && (<div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', backgroundColor: message.type === 'success' ? '#d1fae5' : '#fef2f2', color: message.type === 'success' ? '#065f46' : '#dc2626', fontSize: '14px' }}>{message.text}</div>)}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── Informations personnelles ── */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Informations personnelles</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Prénom {requiredStar}</label>
                <input type="text" value={formData.prenom} onChange={(e) => handleInputChange('prenom', e.target.value)} style={fieldErrors.prenom ? inputErrorStyle : inputStyle} placeholder="Votre prénom" />
                {fieldErrors.prenom && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.prenom}</p>}
              </div>
              <div>
                <label style={labelStyle}>Nom de famille {requiredStar}</label>
                <input type="text" value={formData.nom} onChange={(e) => handleInputChange('nom', e.target.value)} style={fieldErrors.nom ? inputErrorStyle : inputStyle} placeholder="Votre nom de famille" />
                {fieldErrors.nom && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.nom}</p>}
              </div>
              <div>
                <label style={labelStyle}>Courriel {requiredStar}</label>
                <input type="email" value={formData.email} onChange={(e) => { handleInputChange('email', e.target.value); if (fieldErrors.emailConfirm) setFieldErrors(prev => ({ ...prev, emailConfirm: '' })) }} style={fieldErrors.email ? inputErrorStyle : inputStyle} placeholder="votre.nom@example.com" autoComplete="email" />
                {fieldErrors.email && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.email}</p>}
              </div>
              <div>
                <label style={labelStyle}>Confirmer le courriel {requiredStar}</label>
                <input
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => { setEmailConfirm(e.target.value); if (fieldErrors.emailConfirm) setFieldErrors(prev => ({ ...prev, emailConfirm: '' })) }}
                  onPaste={(e) => e.preventDefault()}
                  style={fieldErrors.emailConfirm ? inputErrorStyle : inputStyle}
                  placeholder="Répétez votre courriel"
                  autoComplete="off"
                />
                {fieldErrors.emailConfirm && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.emailConfirm}</p>}
              </div>
              <div>
                <label style={labelStyle}>Téléphone mobile {requiredStar}</label>
                <input type="tel" value={formData.telephone} onChange={(e) => handleInputChange('telephone', e.target.value)} onBlur={handlePhoneBlur} style={fieldErrors.telephone ? inputErrorStyle : inputStyle} placeholder="(514) 123-4567" />
                {fieldErrors.telephone && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.telephone}</p>}
              </div>
            </div>
          </div>

          {/* ── Localisation ── */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Localisation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
                <label style={labelStyle}>Adresse {requiredStar}</label>
                <input ref={addressInputRef} type="text" value={formData.adresse} onChange={(e) => handleAddressChange(e.target.value)} onFocus={() => formData.adresse.length >= 3 && setShowAddressSuggestions(true)} style={fieldErrors.adresse ? inputErrorStyle : inputStyle} placeholder="Commencez à taper votre adresse..." autoComplete="off" />
                {isLoadingAddress && <div style={{ position: 'absolute', right: '12px', top: '38px', fontSize: '12px', color: '#6b7280' }}>Recherche...</div>}
                {formData.latitude && formData.longitude && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#059669' }}>✓ Adresse validée</p>}
                {fieldErrors.adresse && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.adresse}</p>}
                {showAddressSuggestions && addressSuggestions.length > 0 && (
                  <div ref={addressDropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 1000, marginTop: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                    {addressSuggestions.map((suggestion, index) => (
                      <div key={index} onClick={() => selectAddress(suggestion)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: index < addressSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '14px', color: '#374151' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>{suggestion.place_name}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Ville</label>
                <input ref={villeInputRef} type="text" value={formData.ville} onChange={(e) => handleVilleChange(e.target.value)} onFocus={() => formData.ville.length >= 2 && villeSuggestions.length > 0 && setShowVilleSuggestions(true)} style={inputStyle} placeholder="Tapez votre ville..." autoComplete="off" />
                {isLoadingVille && <div style={{ position: 'absolute', right: '12px', top: '38px', fontSize: '12px', color: '#6b7280' }}>Recherche...</div>}
                {showVilleSuggestions && villeSuggestions.length > 0 && (
                  <div ref={villeDropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 1000, marginTop: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                    {villeSuggestions.map((s, i) => (
                      <div key={i} onClick={() => selectVille(s)} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: i < villeSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '14px', color: '#374151' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                        <div style={{ fontWeight: '500' }}>{s.municipalite}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{s.region_administrative}{s.mrc ? ` — ${s.mrc}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Code postal {requiredStar}</label>
                <input
                  type="text"
                  value={formData.code_postal}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, '').slice(0, 7)
                    setFormData(prev => ({ ...prev, code_postal: val }))
                    if (fieldErrors.code_postal) setFieldErrors(prev => ({ ...prev, code_postal: '' }))
                  }}
                  onBlur={(e) => {
                    const cp = e.target.value.trim()
                    if (cp.length >= 3 && !formData.region) {
                      const r = detecterRegionParFSA(cp)
                      if (r) {
                        setFormData(prev => ({ ...prev, region: r }))
                        setRegionNonDetectee(false)
                        if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
                      } else if (cp.length >= 6) {
                        setRegionNonDetectee(true)
                      }
                    }
                  }}
                  placeholder="Ex: J1H 1A1"
                  maxLength={7}
                  style={fieldErrors.code_postal ? { ...inputErrorStyle, textTransform: 'uppercase' } : { ...inputStyle, textTransform: 'uppercase' }}
                />
                {fieldErrors.code_postal && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.code_postal}</p>}
              </div>
              {/* Région — auto-détectée ou sélecteur manuel si non détectée */}
              {regionNonDetectee && !formData.region ? (
                <div>
                  <div style={{
                    background: '#fff8e1', border: '1px solid #ffd166', borderRadius: '6px',
                    padding: '7px 11px', marginBottom: '7px', fontSize: '12px', color: '#7a5c00',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <span>⚠️</span>
                    <span>Région non détectée automatiquement — veuillez la sélectionner.</span>
                  </div>
                  <label style={labelStyle}>Région administrative <span style={{ color: '#dc2626' }}>*</span></label>
                  <select
                    value={formData.region}
                    onChange={e => {
                      setFormData(prev => ({ ...prev, region: e.target.value }))
                      if (e.target.value) {
                        setRegionNonDetectee(false)
                        if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
                      }
                    }}
                    style={{
                      ...inputStyle,
                      border: '1.5px solid #e74c3c',
                      color: formData.region ? '#111827' : '#9ca3af',
                    }}
                  >
                    <option value="">— Sélectionner une région —</option>
                    {REGIONS_QUEBEC.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {fieldErrors.region && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.region}</p>}
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Région administrative {requiredStar}</label>
                  {formData.region ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ ...inputStyle, flex: 1, backgroundColor: '#f0fdf4', borderColor: '#86efac', color: '#111827', cursor: 'default' }}>
                        {formData.region}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setRegionNonDetectee(true); setFormData(prev => ({ ...prev, region: '' })) }}
                        style={{ padding: '8px 10px', fontSize: '12px', color: '#6b7280', background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}
                        title="Modifier la région"
                      >✏️ Modifier</button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={formData.region}
                      readOnly
                      style={{ ...inputStyle, backgroundColor: '#f3f4f6', cursor: 'not-allowed', borderColor: fieldErrors.region ? '#dc2626' : '#d1d5db', borderWidth: fieldErrors.region ? '2px' : '1px' }}
                      placeholder="Détectée automatiquement selon la ville"
                    />
                  )}
                  {formData.region && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#059669' }}>✓ Détectée automatiquement</p>}
                  {fieldErrors.region && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.region}</p>}
                </div>
              )}
            </div>
          </div>

          {/* ── Organisations ── */}
          <div style={{ ...sectionStyle, border: fieldErrors.organisations ? '2px solid #dc2626' : 'none' }}>
            <h3 style={sectionTitleStyle}>Organisation d&apos;appartenance {requiredStar}</h3>
            <p style={sectionDescStyle}>Sélectionnez toutes les organisations dont vous faites partie, ou choisissez &quot;Aucune&quot; si non applicable.</p>

            {fieldErrors.organisations && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
                {fieldErrors.organisations}
              </div>
            )}

            {loadingOrgs ? (
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Chargement des organisations...</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', maxHeight: '280px', overflowY: 'auto', padding: '2px 0' }}>
                  {/* Option "Aucune" en premier */}
                  <label key={AUCUNE_ORG_ID} style={checkboxRowStyle(selectedOrgIds.includes(AUCUNE_ORG_ID))}>
                    <input
                      type="checkbox"
                      checked={selectedOrgIds.includes(AUCUNE_ORG_ID)}
                      onChange={() => toggleOrg(AUCUNE_ORG_ID)}
                      style={{ accentColor: '#1e3a5f', width: '17px', height: '17px', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>Aucune</span>
                  </label>
                  
                  {/* Séparateur visuel */}
                  <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }}></div>
                  
                  {/* Organisations réelles */}
                  {allOrgs.map(org => (
                    <label key={org.id} style={checkboxRowStyle(selectedOrgIds.includes(org.id))}>
                      <input
                        type="checkbox"
                        checked={selectedOrgIds.includes(org.id)}
                        onChange={() => toggleOrg(org.id)}
                        style={{ accentColor: '#1e3a5f', width: '17px', height: '17px', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '14px', color: '#374151' }}>{org.nom}</span>
                    </label>
                  ))}
                </div>

                {!showNewOrgInput ? (
                  <button
                    onClick={() => setShowNewOrgInput(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: 'transparent', border: '1px dashed #9ca3af', borderRadius: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}
                  >
                    + Mon organisation n&apos;est pas dans la liste
                  </button>
                ) : (
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '8px' }}>Nom de votre organisation</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={newOrgName}
                        onChange={e => setNewOrgName(e.target.value)}
                        placeholder="Ex: Croix-Rouge canadienne"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => { setShowNewOrgInput(false); setNewOrgName('') }}
                        style={{ padding: '12px 14px', backgroundColor: 'transparent', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Annuler
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', marginBottom: 0 }}>
                      Cette organisation sera ajoutée à la liste globale pour tous les réservistes.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Groupe RS (conditionnel si AQBRS coché) ── */}
          {isAqbrsSelected && (
            <div style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Membre d&apos;un groupe de Recherche et Sauvetage de l&apos;AQBRS</h3>
              <p style={sectionDescStyle}>Sélectionnez votre groupe si applicable.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto', padding: '2px 0' }}>
                {GROUPES_RS.map(groupe => (
                  <label key={groupe} style={checkboxRowStyle(formData.groupe_rs.includes(groupe))}>
                    <input
                      type="checkbox"
                      checked={formData.groupe_rs.includes(groupe)}
                      onChange={() => toggleGroupeRS(groupe)}
                      style={{ accentColor: '#1e3a5f', width: '17px', height: '17px', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '14px', color: '#374151' }}>{groupe}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Camp de qualification ── */}
          <div style={{...sectionStyle, border: campId ? '2px solid #059669' : 'none', backgroundColor: campId ? '#f0fdf4' : 'white'}}>
            <h3 style={sectionTitleStyle}>Camp de qualification {campId && <span style={{color: '#059669', fontSize: '14px', fontWeight: 'normal'}}>• Recommandé</span>}</h3>
            <p style={sectionDescStyle}>
              {campId 
                ? "Vous êtes arrivé ici pour un camp spécifique. Sélectionnez-le ci-dessous ou choisissez un autre camp disponible." 
                : "Souhaitez-vous vous inscrire à un camp de qualification maintenant ? Vous pourrez aussi le faire plus tard depuis votre portail."}
            </p>

            {loadingSessions ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', backgroundColor: '#f9fafb', borderRadius: '8px' }}>Chargement des camps disponibles...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Option "Plus tard" */}
                <label style={{ display: 'block', padding: '16px', border: selectedSessionId === 'PLUS_TARD' ? '2px solid #1e3a5f' : '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', backgroundColor: selectedSessionId === 'PLUS_TARD' ? '#f0f4f8' : 'white', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <input
                      type="radio"
                      name="session"
                      value="PLUS_TARD"
                      checked={selectedSessionId === 'PLUS_TARD'}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      style={{ marginTop: '4px', accentColor: '#1e3a5f' }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '4px' }}>Je choisirai un camp plus tard</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>Vous pourrez vous inscrire à un camp depuis votre portail après avoir créé votre compte</div>
                    </div>
                  </div>
                </label>

                {/* Camps disponibles */}
                {sessionsDisponibles.length > 0 && (
                  <>
                    <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '8px 0' }}></div>
                    {sessionsDisponibles.sort((a, b) => a.nom.localeCompare(b.nom, 'fr-CA', { numeric: true })).map((session) => {
                      const cap = session.monday_id ? sessionCapacities[session.monday_id] : null
                      const isComplet = cap?.statut === 'complet'
                      const isAttente = cap?.statut === 'liste_attente'
                      const isDisabled = isComplet
                      
                      return (
                      <label
                        key={session.session_id}
                        style={{
                          display: 'block',
                          padding: '16px',
                          border: isDisabled ? '1px solid #e5e7eb' : selectedSessionId === session.session_id ? '2px solid #059669' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          backgroundColor: isDisabled ? '#f9fafb' : selectedSessionId === session.session_id ? '#f0fdf4' : 'white',
                          opacity: isDisabled ? 0.6 : 1,
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <input
                            type="radio"
                            name="session"
                            value={session.session_id}
                            checked={selectedSessionId === session.session_id}
                            onChange={(e) => !isDisabled && setSelectedSessionId(e.target.value)}
                            disabled={isDisabled}
                            style={{ marginTop: '4px', accentColor: '#059669' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                              <span style={{ fontWeight: '600', color: isDisabled ? '#9ca3af' : '#111827' }}>{session.nom}</span>
                              {loadingCapacities ? (
                                <span style={{ backgroundColor: '#f3f4f6', color: '#9ca3af', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>...</span>
                              ) : (
                                <>
                                  {isComplet && (
                                    <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Complet</span>
                                  )}
                                  {isAttente && (
                                    <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Liste d&apos;attente</span>
                                  )}
                                  {cap && !isComplet && !isAttente && cap.places_restantes <= 10 && (
                                    <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{cap.places_restantes} place{cap.places_restantes > 1 ? 's' : ''}</span>
                                  )}
                                </>
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
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Informations santé (conditionnel si camp sélectionné) ── */}
          {selectedSessionId && selectedSessionId !== 'PLUS_TARD' && (
            <div style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Informations santé pour le camp</h3>
              <p style={sectionDescStyle}>Ces informations aideront l&apos;équipe à mieux vous accompagner durant le camp.</p>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Allergies alimentaires</label>
                <textarea
                  value={allergiesAlimentaires}
                  onChange={(e) => setAllergiesAlimentaires(e.target.value)}
                  placeholder="Ex: Noix, arachides, fruits de mer, lactose..."
                  rows={3}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>Optionnel - Laissez vide si aucune allergie</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Autres allergies</label>
                <textarea
                  value={autresAllergies}
                  onChange={(e) => setAutresAllergies(e.target.value)}
                  placeholder="Ex: Latex, pollen, médicaments..."
                  rows={3}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>Optionnel - Laissez vide si aucune allergie</p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Problèmes de santé ou conditions médicales</label>
                <textarea
                  value={conditionsMedicales}
                  onChange={(e) => setConditionsMedicales(e.target.value)}
                  placeholder="Conditions dont l'équipe devrait être informée..."
                  rows={3}
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>Optionnel - Laissez vide si aucune condition</p>
              </div>
            </div>
          )}

          {/* ── Informations supplémentaires ── */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Informations supplémentaires</h3>
            <label style={labelStyle}>Commentaire</label>
            <textarea value={formData.commentaire} onChange={(e) => handleInputChange('commentaire', e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Optionnel" />
          </div>

          {/* ── Confirmations ── */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Confirmations requises</h3>
            {/* Avertissement liste d'attente */}
            {(() => {
              const sel = sessionsDisponibles.find(s => s.session_id === selectedSessionId)
              const cap = sel?.monday_id ? sessionCapacities[sel.monday_id] : null
              if (selectedSessionId && selectedSessionId !== 'PLUS_TARD' && cap?.statut === 'liste_attente') {
                return (
                  <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>⏳</span>
                    <div style={{ fontSize: '14px', color: '#92400e', lineHeight: '1.5' }}>
                      <strong>Ce camp est complet.</strong> Votre inscription sera placée sur la liste d&apos;attente. Vous serez contacté si une place se libère.
                    </div>
                  </div>
                )
              }
              return null
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: fieldErrors.confirm_18 ? '#fef2f2' : '#f9fafb', border: fieldErrors.confirm_18 ? '1px solid #fca5a5' : '1px solid transparent' }}>
                <input type="checkbox" checked={formData.confirm_18} onChange={(e) => handleInputChange('confirm_18', e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>Je confirme être âgé(e) de 18 ans ou plus au moment de mon inscription. {requiredStar}</span>
              </label>
              {fieldErrors.confirm_18 && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-8px 0 0 0' }}>{fieldErrors.confirm_18}</p>}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: fieldErrors.consent_photos ? '#fef2f2' : '#f9fafb', border: fieldErrors.consent_photos ? '1px solid #fca5a5' : '1px solid transparent' }}>
                <input type="checkbox" checked={formData.consent_photos} onChange={(e) => handleInputChange('consent_photos', e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>Je comprends que des photos ou vidéos peuvent être prises lors des activités de formation, d&apos;entraînement ou de déploiement et j&apos;autorise l&apos;AQBRS / RIUSC à utiliser les images captées par leurs représentants à des fins de communication. {requiredStar}</span>
              </label>
              {fieldErrors.consent_photos && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-8px 0 0 0' }}>{fieldErrors.consent_photos}</p>}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: fieldErrors.consent_confidentialite ? '#fef2f2' : '#f9fafb', border: fieldErrors.consent_confidentialite ? '1px solid #fca5a5' : '1px solid transparent' }}>
                <input type="checkbox" checked={formData.consent_confidentialite} onChange={(e) => handleInputChange('consent_confidentialite', e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>Je comprends et j&apos;accepte que mes informations soient utilisées conformément à la{' '}<a href="https://aqbrs.ca/wp-content/uploads/2026/02/Loi-25-Politique-AQBRS-fr.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>politique de confidentialité</a>. {requiredStar}</span>
              </label>
              {fieldErrors.consent_confidentialite && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-8px 0 0 0' }}>{fieldErrors.consent_confidentialite}</p>}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: fieldErrors.consent_antecedents ? '#fef2f2' : '#f9fafb', border: fieldErrors.consent_antecedents ? '1px solid #fca5a5' : '1px solid transparent' }}>
                <input type="checkbox" checked={formData.consent_antecedents} onChange={(e) => handleInputChange('consent_antecedents', e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>J&apos;autorise l&apos;AQBRS à procéder à la vérification de mes antécédents judiciaires dans le cadre de mon processus d&apos;adhésion à la Réserve d&apos;Intervention d&apos;Urgence en Sécurité Civile. {requiredStar}</span>
              </label>
              {fieldErrors.consent_antecedents && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-8px 0 0 0' }}>{fieldErrors.consent_antecedents}</p>}
            </div>
          </div>

          {/* ── Boutons ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <a href={campId ? `/login?camp=${campId}` : '/login'} style={{ padding: '12px 24px', color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>← Retour à la connexion</a>
            <button onClick={handleSubmit} disabled={loading} style={{ padding: '14px 40px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
              {loading ? 'Inscription en cours...' : "S'inscrire"}
            </button>
          </div>
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
