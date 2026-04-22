'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Sinistre  { id: string; nom: string; statut: string; lieu: string; date_debut: string }
interface Deployment { id: string; identifiant: string; nom: string; statut: string; nb_personnes_par_vague: number; date_debut: string; date_fin: string; lieu: string }
interface Vague     { id: string; identifiant: string; numero: number; date_debut: string; date_fin: string; nb_personnes_requis: number; statut: string }
interface Langue    { id: string; nom: string }

interface Candidat {
  benevole_id: string; prenom: string; nom: string; telephone: string
  region: string; ville: string; preference_tache: string
  deployable: boolean; en_deploiement_actif: boolean
  rotations_consecutives: number; repos_requis_jusqu: string | null
  raison_alerte: string | null; deja_cible: boolean
  latitude: number | null; longitude: number | null
  competence_rs: string[]; certificat_premiers_soins: string[]
  date_expiration_certificat: string | null
  vehicule_tout_terrain: string[]; navire_marin: string[]
  permis_conduire: string[]; satp_drone: string[]; equipe_canine: string[]
  competences_securite: string[]; competences_sauvetage: string[]
  communication: string[]; cartographie_sig: string[]; operation_urgence: string[]
  langues: string[]
  niveau_ressource: number
  distance_km?: number
  // Flags détaillés de déployabilité (renseignés par l'API pool)
  profil_complet?: boolean
  initiation_sc?: boolean
  camp_complete?: boolean
  bottes_ok?: boolean
  antecedents_ok?: boolean
}

interface Cible {
  id: string; benevole_id: string; niveau: string; reference_id: string
  statut: string; ajoute_par_ia: boolean
  reservistes: { prenom: string; nom: string; telephone: string; region: string; ville: string; preference_tache: string }
}

interface AISuggestion { benevole_id: string; raison: string }

// ── Constantes ────────────────────────────────────────────────
const C = '#1e3a5f'

const COMPETENCES = [
  { field: 'competence_rs',          label: 'Recherche & sauvetage' },
  { field: 'certificat_premiers_soins', label: 'Premiers soins' },
  { field: 'vehicule_tout_terrain',  label: 'Véhicule tout-terrain' },
  { field: 'navire_marin',           label: 'Navire / marin' },
  { field: 'permis_conduire',        label: 'Permis conduire' },
  { field: 'satp_drone',             label: 'Drone' },
  { field: 'equipe_canine',          label: 'Équipe canine' },
  { field: 'competences_securite',   label: 'Sécurité' },
  { field: 'competences_sauvetage',  label: 'Sauvetage' },
  { field: 'communication',          label: 'Communication' },
  { field: 'cartographie_sig',       label: 'Cartographie / SIG' },
  { field: 'operation_urgence',      label: 'Opérations urgence' },
]

// ── Sous-filtres par champ compétence ─────────────────────────
const SOUS_FILTRES: Record<string, {val: string; label: string}[]> = {
  competence_rs: [
    { val: '', label: 'Tous les niveaux' },
    { val: 'Niveau 1', label: 'Niveau 1 (Chercheur / Équipier)' },
    { val: 'Niveau 2', label: 'Niveau 2 — Chef d’équipe' },
    { val: 'Niveau 3', label: 'Niveau 3 — Gestionnaire / Responsable' },
  ],
  certificat_premiers_soins: [
    { val: '', label: 'Tous les types' },
    { val: 'a)', label: 'a) RCR / DEA (4-6h)' },
    { val: 'b)', label: 'b) Premiers soins standard (8-16h)' },
    { val: 'c)', label: 'c) Secourisme milieu de travail (16h)' },
    { val: 'd)', label: 'd) Secourisme milieu éloigné (20-40h)' },
    { val: 'e)', label: 'e) Premier répondant (80-120h)' },
  ],
  vehicule_tout_terrain: [
    { val: '', label: 'Tous' },
    { val: 'VTT', label: 'VTT' },
    { val: 'Motoneige', label: 'Motoneige' },
    { val: 'Argo', label: 'Argo' },
    { val: 'Côte à côte', label: 'Côte à côte / Side by side' },
  ],
  permis_conduire: [
    { val: '', label: 'Toutes les classes' },
    { val: 'Classe 5', label: 'Classe 5 — Voiture' },
    { val: 'Classe 4b', label: 'Classe 4b — Autobus (4-14 pass.)' },
    { val: 'Classe 4a', label: 'Classe 4a — Véhicule d’urgence' },
    { val: 'Classe 3', label: 'Classe 3 — Camions' },
    { val: 'Classe 2', label: 'Classe 2 — Autobus (24+ pass.)' },
    { val: 'Classe 1', label: 'Classe 1 — Véhicules lourds' },
    { val: 'Classe 6', label: 'Classe 6 — Motocyclette' },
  ],
  competences_securite: [
    { val: '', label: 'Toutes' },
    { val: 'chaîne', label: 'Scies à chaînes' },
    { val: 'circulation', label: 'Contrôle circulation routière' },
    { val: 'CNESST', label: 'Formateur certifié CNESST' },
  ],
  competences_sauvetage: [
    { val: '', label: 'Tous' },
    { val: 'eau vive', label: 'Eau vive' },
    { val: 'glace', label: 'Glace' },
    { val: 'corde', label: 'Corde' },
    { val: 'hauteur', label: 'Hauteur' },
  ],
  satp_drone: [
    { val: '', label: 'Tous' },
    { val: '250g', label: 'Petit drone < 250g' },
    { val: 'SATP de base', label: 'SATP de base / RPAS Basic' },
    { val: 'SATP Obs', label: 'SATP Obs / Visual Observer' },
    { val: 'Transport Canada', label: 'Licence Transport Canada' },
  ],
  communication: [
    { val: '', label: 'Tous' },
    { val: 'Radio amateur', label: 'Radio amateur' },
    { val: 'VHF marine', label: 'Radio VHF marine' },
    { val: 'satellite', label: 'Téléphonie satellite' },
    { val: 'radioamateur', label: 'Certificat radioamateur' },
    { val: 'mobile terrestre', label: 'Radio mobile terrestre' },
    { val: 'maritime', label: 'Radio maritime' },
    { val: 'réseau IP', label: 'Réseau IP / Networking' },
  ],
  cartographie_sig: [
    { val: '', label: 'Tous' },
    { val: 'topographiques', label: 'Lecture cartes topographiques' },
    { val: 'GPS', label: 'Utilisation GPS' },
    { val: 'SIG', label: 'SIG' },
    { val: 'ArcGIS', label: 'ArcGIS (Pro / Online / QuickCapture)' },
    { val: 'Caltopo', label: 'Caltopo / SARTopo' },
    { val: 'Sartrack', label: 'Sartrack' },
  ],
  navire_marin: [
    { val: '', label: 'Tous' },
    { val: 'embarcation de plaisance', label: 'Permis embarcation de plaisance' },
    { val: 'bateaux', label: 'Petits bateaux' },
  ],
  equipe_canine: [
    { val: '', label: 'Toutes les spécialités' },
    { val: 'Décombres', label: 'Décombres / USAR / Noyés' },
    { val: 'Pistage', label: 'Pistage / Track-Trail' },
    { val: 'Ratissage', label: 'Ratissage' },
  ],
}

// ── Haversine ─────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
}

// ── Helpers ───────────────────────────────────────────────────
function formatDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })
}

// Extrait toutes les compétences actives d'un candidat sous forme de labels courts
function getCompetencesBadges(c: any): { label: string; color: string; bg: string }[] {
  const badges: { label: string; color: string; bg: string }[] = []
  const add = (label: string, color: string, bg: string) => badges.push({ label, color, bg })

  if (c.competence_rs?.length > 0) {
    const max = c.competence_rs.reduce((a: string, b: string) => {
      const niv = (s: string) => s.includes('3') ? 3 : s.includes('2') ? 2 : 1
      return niv(b) > niv(a) ? b : a
    }, c.competence_rs[0])
    add(max.includes('3') ? 'RS Niv.3' : max.includes('2') ? 'RS Niv.2' : 'RS Niv.1', '#0f6e56', '#e1f5ee')
  }
  if (c.certificat_premiers_soins?.length > 0) {
    const best = c.certificat_premiers_soins.reduce((a: string, b: string) => {
      const ord = (s: string) => ['e)','d)','c)','b)','a)'].findIndex(x => s.startsWith(x))
      return ord(b) < ord(a) ? b : a
    }, c.certificat_premiers_soins[0])
    const lbl = best.startsWith('e)') ? 'Premier répondant' : best.startsWith('d)') ? 'Secourisme éloigné' :
                best.startsWith('c)') ? 'Secourisme travail' : best.startsWith('b)') ? 'Premiers soins std' : 'RCR/DEA'
    add(lbl, '#185fa5', '#e6f1fb')
  }
  if (c.vehicule_tout_terrain?.length > 0) add('VTT/Moto-neige', '#854f0b', '#faeeda')
  if (c.navire_marin?.length > 0) add('Navire/Marin', '#185fa5', '#e6f1fb')
  const permisSpec = (c.permis_conduire || []).filter((p: string) => /Classe [1-4]/.test(p))
  if (permisSpec.length > 0) {
    const cls = permisSpec.sort()[0].match(/Classe (\w+)/)?.[1] || ''
    add(`Permis Cl.${cls}`, '#3b6d11', '#eaf3de')
  }
  if (c.satp_drone?.length > 0) {
    const hasLicence = c.satp_drone.some((d: string) => d.includes('Transport Canada') || d.includes('SATP'))
    add(hasLicence ? 'Drone certifié' : 'Drone <250g', '#534ab7', '#eeedfe')
  }
  if (c.equipe_canine?.length > 0) add('Équipe canine', '#993c1d', '#faece7')
  if (c.competences_sauvetage?.length > 0) {
    const types = [...new Set(c.competences_sauvetage.map((s: string) =>
      s.includes('eau') ? 'Eau vive' : s.includes('glace') ? 'Glace' : s.includes('corde') ? 'Corde' : 'Hauteur'
    ))]
    types.forEach((t: any) => add(`Sauvetage ${t}`, '#3b6d11', '#eaf3de'))
  }
  if (c.competences_securite?.length > 0) {
    if (c.competences_securite.some((s: string) => s.includes('chaîne') || s.includes('chaine'))) add('Scie chaîne', '#993c1d', '#faece7')
    if (c.competences_securite.some((s: string) => s.includes('circulation'))) add('Contrôle circulation', '#854f0b', '#faeeda')
    if (c.competences_securite.some((s: string) => s.includes('CNESST'))) add('CNESST formateur', '#5f5e5a', '#f1efe8')
  }
  if (c.communication?.length > 0) {
    if (c.communication.some((s: string) => s.toLowerCase().includes('radio amateur'))) add('Radio amateur', '#534ab7', '#eeedfe')
    if (c.communication.some((s: string) => s.includes('VHF'))) add('Radio VHF', '#534ab7', '#eeedfe')
    if (c.communication.some((s: string) => s.includes('satellite'))) add('Tél. satellite', '#534ab7', '#eeedfe')
  }
  if (c.cartographie_sig?.length > 0) {
    if (c.cartographie_sig.some((s: string) => s.includes('ArcGIS'))) add('ArcGIS', '#0f6e56', '#e1f5ee')
    else if (c.cartographie_sig.some((s: string) => s.includes('SIG'))) add('SIG', '#0f6e56', '#e1f5ee')
    else if (c.cartographie_sig.some((s: string) => s.includes('GPS'))) add('GPS', '#0f6e56', '#e1f5ee')
    else add('Cartographie', '#0f6e56', '#e1f5ee')
  }
  if (c.operation_urgence?.length > 0) add('Exp. urgence', '#5f5e5a', '#f1efe8')
  return badges
}

function badgePref(p: string) {
  if (p === 'terrain')   return { label: 'Terrain',   bg: '#e8f0f8', color: C }
  if (p === 'sinistres') return { label: 'Sinistrés', bg: '#f3e8ff', color: '#7c3aed' }
  return { label: 'Générale', bg: '#f1f5f9', color: '#64748b' }
}

// ── Composant principal ───────────────────────────────────────
export default function CiblagePage() {
  // Sélection
  const [sinistres,            setSinistres]            = useState<Sinistre[]>([])
  const [selectedSinistreId,   setSelectedSinistreId]   = useState('')
  const [deployments,          setDeployments]          = useState<Deployment[]>([])
  const [selectedDeploymentId, setSelectedDeploymentId] = useState('')
  const [selectedDeployment,   setSelectedDeployment]   = useState<Deployment | null>(null)
  const [niveau,               setNiveau]               = useState<'rotation'|'deploiement'>('deploiement')
  const [vagues,               setVagues]               = useState<Vague[]>([])
  const [selectedVagueId,      setSelectedVagueId]      = useState('')
  const [selectedVague,        setSelectedVague]        = useState<Vague | null>(null)

  // Data
  const [pool,          setPool]          = useState<Candidat[]>([])
  const [cibles,        setCibles]        = useState<Cible[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [langues,       setLangues]       = useState<Langue[]>([])

  // Géolocalisation déploiement
  const [depCoords,       setDepCoords]       = useState<{ lat: number; lon: number } | null>(null)
  const [geocoding,       setGeocoding]       = useState(false)
  const [trierDistance,   setTrierDistance]   = useState(true)
  const [trierBadges,     setTrierBadges]     = useState(false)
  const [filtreNiveaux,   setFiltreNiveaux]   = useState<number[]>([1, 2, 3])

  // Filtres
  const [filtrePreference,  setFiltrePreference]  = useState('')
  const [filtreCompetences, setFiltreCompetences] = useState<string[]>([])
  const [filtreLangues,     setFiltreLangues]     = useState<string[]>([])
  const [recherche,         setRecherche]         = useState('')
  const [filtreSubComp,     setFiltreSubComp]     = useState<Record<string,string>>({})
  const [filtreBadges,      setFiltreBadges]      = useState<string[]>([])
  // Filtres déployabilité cliquables : null=off, 'has'=ont le critère, 'missing'=leur manque
  type ReadinessKey = 'profil' | 'initiation' | 'camp' | 'bottes' | 'antecedents' | 'deployable'
  const [filtresReadiness, setFiltresReadiness] = useState<Record<ReadinessKey, null | 'has' | 'missing'>>({
    profil: null, initiation: null, camp: null, bottes: null, antecedents: null, deployable: null,
  })

  // Loading
  const [loadingSinistres,   setLoadingSinistres]   = useState(true)
  const [loadingDeployments, setLoadingDeployments] = useState(false)
  const [loadingVagues,      setLoadingVagues]      = useState(false)
  const [loadingPool,        setLoadingPool]        = useState(false)
  const [loadingAI,          setLoadingAI]          = useState(false)
  const [loadingNotif,       setLoadingNotif]       = useState(false)
  const [ajoutEnCours,       setAjoutEnCours]       = useState<string[]>([])
  const [notifEnvoyees,      setNotifEnvoyees]      = useState(false)
  const [aiCochees,          setAiCochees]          = useState<string[]>([])
  const [erreur,             setErreur]             = useState<string | null>(null)

  // ── Computed ──────────────────────────────────────────────
  const referenceId = niveau === 'rotation' ? selectedVagueId : selectedDeploymentId
  const dateDeb = niveau === 'rotation' ? selectedVague?.date_debut : selectedDeployment?.date_debut
  const dateFinDeployment = selectedDeployment?.date_fin || (() => {
    if (!selectedDeployment?.date_debut) return undefined
    const d = new Date(selectedDeployment.date_debut + 'T00:00:00')
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })()
  const dateFin = niveau === 'rotation'
    ? (selectedVague?.date_fin || selectedVague?.date_debut)
    : dateFinDeployment

  const nbRequis    = niveau === 'rotation' ? (selectedVague?.nb_personnes_requis || 0) : (selectedDeployment?.nb_personnes_par_vague || 0)
  const ratioMin    = nbRequis * 3
  const ratioMax    = nbRequis * 4
  const pct         = ratioMax > 0 ? Math.min(100, Math.round((cibles.length / ratioMax) * 100)) : 0
  const dansLaFourchette = cibles.length >= ratioMin && cibles.length <= ratioMax
  const couleurJauge = dansLaFourchette ? '#22c55e' : cibles.length < ratioMin ? '#f59e0b' : '#3b82f6'
  const estPret = niveau === 'deploiement'
    ? !!selectedDeploymentId && !!selectedDeployment?.date_debut
    : !!selectedVagueId && !!selectedVague?.date_debut

  // Pool avec distance calculée
  const poolAvecDistance = pool.map(c => ({
    ...c,
    distance_km: (depCoords && c.latitude && c.longitude)
      ? haversine(depCoords.lat, depCoords.lon, c.latitude, c.longitude)
      : undefined
  }))

  // Pool non ciblé
  const poolNonCible = poolAvecDistance.filter(c => !c.deja_cible)

  // Filtres client-side
  const poolFiltre = poolNonCible.filter(c => {
    if (filtreNiveaux.length > 0 && filtreNiveaux.length < 3) {
      if (!filtreNiveaux.includes(c.niveau_ressource || 1)) return false
    }
    if (filtrePreference) {
      if (filtrePreference === 'terrain' && c.preference_tache !== 'terrain') return false
      if (filtrePreference === 'sinistres' && c.preference_tache !== 'sinistres') return false
    }
    if (filtreCompetences.length > 0) {
      for (const f of filtreCompetences) {
        const vals: string[] = (c as any)[f] || []
        if (vals.length === 0) return false
        const sub = filtreSubComp[f] || ''
        if (f === 'certificat_premiers_soins') {
          if (c.date_expiration_certificat && dateDeb) {
            if (c.date_expiration_certificat < dateDeb) return false
          }
          if (sub && !vals.some(v => v.startsWith(sub))) return false
        } else if (sub) {
          if (!vals.some(v => v.toLowerCase().includes(sub.toLowerCase()))) return false
        }
      }
    }
    if (filtreLangues.length > 0) {
      const hasAll = filtreLangues.every(l => c.langues.includes(l))
      if (!hasAll) return false
    }
    if (filtreBadges.length > 0) {
      const badges = getCompetencesBadges(c).map(b => b.label)
      if (!filtreBadges.every(fb => badges.includes(fb))) return false
    }
    if (recherche) {
      // Si l'utilisateur a collé des coordonnées GPS (format "lat, lon"),
      // on ne filtre pas par texte — c'est juste un point de référence pour
      // le tri par proximité (géré via un useEffect plus bas).
      const isCoords = /^\s*-?\d+\.?\d*\s*,\s*-?\d+\.?\d*\s*$/.test(recherche)
      if (!isCoords) {
        const q = recherche.toLowerCase()
        if (!`${c.prenom} ${c.nom}`.toLowerCase().includes(q) &&
            !c.ville?.toLowerCase().includes(q) &&
            !c.region?.toLowerCase().includes(q)) return false
      }
    }
    // Filtres déployabilité (pastilles cliquables)
    const rd: Record<string, boolean> = {
      profil: c.profil_complet === true,
      initiation: c.initiation_sc === true,
      camp: c.camp_complete === true,
      bottes: c.bottes_ok === true,
      antecedents: c.antecedents_ok === true,
      deployable: c.deployable === true,
    }
    for (const key of Object.keys(filtresReadiness) as (keyof typeof filtresReadiness)[]) {
      const state = filtresReadiness[key]
      if (state === 'has' && !rd[key]) return false
      if (state === 'missing' && rd[key]) return false
    }
    return true
  }).sort((a, b) => {
    if (a.deployable !== b.deployable) return a.deployable ? -1 : 1
    if (trierBadges) {
      const diff = getCompetencesBadges(b).length - getCompetencesBadges(a).length
      if (diff !== 0) return diff
    }
    if (trierDistance) {
      const aHas = a.distance_km !== undefined
      const bHas = b.distance_km !== undefined
      if (aHas && bHas) return a.distance_km! - b.distance_km!
      if (aHas) return -1
      if (bHas) return 1
    }
    return `${a.nom}${a.prenom}`.localeCompare(`${b.nom}${b.prenom}`)
  })

  // Badges présents dans le pool (sans le filtre badge) pour la barre de pastilles
  const poolPourBadges = poolNonCible.filter(c => {
    if (filtreNiveaux.length > 0 && filtreNiveaux.length < 3) {
      if (!filtreNiveaux.includes(c.niveau_ressource || 1)) return false
    }
    if (filtrePreference) {
      if (filtrePreference === 'terrain' && c.preference_tache !== 'terrain') return false
      if (filtrePreference === 'sinistres' && c.preference_tache !== 'sinistres') return false
    }
    if (filtreCompetences.length > 0) {
      for (const f of filtreCompetences) {
        const vals: string[] = (c as any)[f] || []
        if (vals.length === 0) return false
        const sub = filtreSubComp[f] || ''
        if (f === 'certificat_premiers_soins') {
          if (c.date_expiration_certificat && dateDeb) {
            if (c.date_expiration_certificat < dateDeb) return false
          }
          if (sub && !vals.some((v: string) => v.startsWith(sub))) return false
        } else if (sub) {
          if (!vals.some((v: string) => v.toLowerCase().includes(sub.toLowerCase()))) return false
        }
      }
    }
    if (filtreLangues.length > 0) {
      if (!filtreLangues.every(l => (c.langues || []).includes(l))) return false
    }
    return true
  })
  const badgesDisponibles = Array.from(new Set(
    poolPourBadges.flatMap(c => getCompetencesBadges(c).map(b => b.label))
  )).sort() as string[]

  const aiEnrichies = aiSuggestions
    .map(s => ({ ...s, candidat: poolAvecDistance.find(c => c.benevole_id === s.benevole_id) }))
    .filter(s => s.candidat && !s.candidat.deja_cible)

  // ── Géocodage Nominatim ───────────────────────────────────
  // Si l'utilisateur colle des coordonnées GPS dans le filtre texte, les
  // extraire et les utiliser comme point de référence pour le tri proximité.
  // Exemple accepté : "45.52550158777838, -73.87702674625037"
  useEffect(() => {
    const m = recherche.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
    if (!m) return
    const lat = parseFloat(m[1])
    const lon = parseFloat(m[2])
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      setDepCoords({ lat, lon })
    }
  }, [recherche])

  const geocoderLieu = useCallback(async (lieu: string) => {
    if (!lieu) return
    setGeocoding(true)
    try {
      const q = encodeURIComponent(`${lieu}, Québec, Canada`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'fr' }
      })
      const data = await res.json()
      if (data?.[0]) {
        setDepCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
      }
    } catch { /* silencieux */ }
    setGeocoding(false)
  }, [])

  // ── Chargements ───────────────────────────────────────────
  // Restaurer sélection depuis localStorage au montage
  useEffect(() => {
    const sinId = localStorage.getItem('ciblage_sinistre')
    const depId = localStorage.getItem('ciblage_deployment')
    if (sinId) setSelectedSinistreId(sinId)
    if (depId) setSelectedDeploymentId(depId)
  }, [])

  useEffect(() => {
    fetch('/api/admin/ciblage?action=sinistres').then(r => r.json()).then(d => { setSinistres(d || []); setLoadingSinistres(false) })
    fetch('/api/admin/ciblage?action=langues').then(r => r.json()).then(d => setLangues(d || []))
  }, [])

  const isFirstSinistreLoad = useRef(true)

  useEffect(() => {
    localStorage.setItem('ciblage_sinistre', selectedSinistreId)
    if (!selectedSinistreId) return
    setLoadingDeployments(true)
    // Ne pas effacer le déploiement lors du chargement initial (restauration localStorage)
    if (!isFirstSinistreLoad.current) {
      setSelectedDeploymentId(''); setSelectedDeployment(null)
      setSelectedVagueId(''); setSelectedVague(null)
      setPool([]); setCibles([]); setAiSuggestions([]); setDepCoords(null)
    }
    isFirstSinistreLoad.current = false
    fetch(`/api/admin/ciblage?action=deployments&sinistre_id=${selectedSinistreId}`)
      .then(r => r.json()).then(d => { setDeployments(d || []); setLoadingDeployments(false) })
  }, [selectedSinistreId])

  useEffect(() => {
    localStorage.setItem('ciblage_deployment', selectedDeploymentId)
    if (!selectedDeploymentId) return
    setLoadingVagues(true)
    setSelectedVagueId(''); setSelectedVague(null)
    setPool([]); setCibles([]); setAiSuggestions([]); setFiltrePreference(''); setFiltreCompetences([]); setFiltreSubComp({}); setFiltreLangues([]); setFiltreBadges([]); setTrierDistance(true); setTrierBadges(false); setFiltreNiveaux([1, 2, 3])
    const dep = deployments.find(d => d.id === selectedDeploymentId) || null
    setSelectedDeployment(dep)
    if (dep?.lieu) geocoderLieu(dep.lieu)
    fetch(`/api/admin/ciblage?action=vagues&deployment_id=${selectedDeploymentId}`)
      .then(r => r.json()).then(d => { setVagues(d || []); setLoadingVagues(false) })
  }, [selectedDeploymentId])

  // Quand deployments se charge, restaurer selectedDeployment si pas encore résolu
  useEffect(() => {
    if (deployments.length > 0 && selectedDeploymentId && !selectedDeployment) {
      const dep = deployments.find(d => d.id === selectedDeploymentId) || null
      if (dep) { setSelectedDeployment(dep); if (dep.lieu) geocoderLieu(dep.lieu) }
    }
  }, [deployments])

  const chargerPool = useCallback(async (refId: string, debut: string, fin: string, niv: string) => {
    setLoadingPool(true); setErreur(null); setAiSuggestions([])
    try {
      const [poolData, ciblagesData] = await Promise.all([
        fetch(`/api/admin/ciblage?action=pool&niveau=${niv}&reference_id=${refId}&date_debut=${debut}&date_fin=${fin}`).then(r => r.json()),
        fetch(`/api/admin/ciblage?action=ciblages&reference_id=${refId}`).then(r => r.json())
      ])
      if (poolData.error) setErreur(poolData.error)
      else { setPool(poolData || []); setCibles(ciblagesData || []) }
    } catch { setErreur('Erreur réseau') }
    setLoadingPool(false); setNotifEnvoyees(false)
  }, [])

  useEffect(() => {
    if (!referenceId || !dateDeb || !dateFin) return
    chargerPool(referenceId, dateDeb, dateFin, niveau)
  }, [referenceId, niveau, dateDeb])

  // Géocoder automatiquement dès que le lieu du déploiement est connu
  useEffect(() => {
    const lieu = niveau === 'deploiement' ? selectedDeployment?.lieu : selectedVague ? selectedDeployment?.lieu : null
    if (lieu) {
      setDepCoords(null)
      geocoderLieu(lieu)
    }
  }, [selectedDeployment?.lieu, niveau])

  // ── Actions ───────────────────────────────────────────────
  const ajouter = async (candidat: Candidat, parIA = false) => {
    if (ajoutEnCours.includes(candidat.benevole_id)) return
    setAjoutEnCours(p => [...p, candidat.benevole_id])
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ajouter', niveau, reference_id: referenceId, benevole_id: candidat.benevole_id, ajoute_par_ia: parIA })
    })
    const data = await res.json()
    if (!data.error) {
      setPool(p => p.map(c => c.benevole_id === candidat.benevole_id ? { ...c, deja_cible: true } : c))
      setCibles(p => [...p, {
        id: data.id, benevole_id: candidat.benevole_id, niveau, reference_id: referenceId,
        statut: 'cible', ajoute_par_ia: parIA,
        reservistes: { prenom: candidat.prenom, nom: candidat.nom, telephone: candidat.telephone, region: candidat.region, ville: candidat.ville, preference_tache: candidat.preference_tache }
      }])
      setAiSuggestions(p => p.filter(s => s.benevole_id !== candidat.benevole_id))
    }
    setAjoutEnCours(p => p.filter(id => id !== candidat.benevole_id))
  }

  const retirer = async (cible: Cible) => {
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retirer', ciblage_id: cible.id })
    })
    const data = await res.json()
    if (!data.error) {
      setCibles(p => p.filter(c => c.id !== cible.id))
      setPool(p => p.map(c => c.benevole_id === cible.benevole_id ? { ...c, deja_cible: false } : c))
    }
  }

  // Démobiliser une seule personne (statut mobilise/confirme → termine)
  const demobiliserPersonne = async (cible: Cible) => {
    if (!confirm(`Démobiliser ${cible.reservistes.prenom} ${cible.reservistes.nom} ?\n\nLe déploiement passera de ses mobilisations actives vers son historique.`)) return
    const res = await fetch('/api/admin/operations/demobiliser', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deployment_id: referenceId, benevole_id: cible.benevole_id })
    })
    const data = await res.json()
    if (!res.ok) {
      alert(`Erreur : ${data.error || 'inconnue'}`)
      return
    }
    // Mettre à jour l'état local
    setCibles(p => p.map(c => c.id === cible.id ? { ...c, statut: 'termine' } : c))
  }

  const demanderAI = async () => {
    if (loadingAI) return
    setLoadingAI(true)
    const contexte = niveau === 'rotation'
      ? `Rotation ${selectedVague?.identifiant} — ${selectedDeployment?.nom} (${formatDate(dateDeb)} au ${formatDate(dateFin)})`
      : `Déploiement ${selectedDeployment?.identifiant} — ${selectedDeployment?.nom} — À partir du ${formatDate(dateDeb)}`
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ai-suggestions', pool: [...poolNonCible].sort((a, b) => {
          if (a.deployable !== b.deployable) return a.deployable ? -1 : 1
          const aD = a.distance_km ?? 99999
          const bD = b.distance_km ?? 99999
          return aD - bD
        }).slice(0, 100), cibles_actuels: cibles.map(c => c.benevole_id), nb_cible: ratioMax, context: contexte })
    })
    const data = await res.json()
    setAiSuggestions(data.suggestions || [])
    setLoadingAI(false)
  }

  const toutAjouterIA = async () => {
    for (const s of aiEnrichies) { if (s.candidat) await ajouter(s.candidat, true) }
  }

  const envoyerNotifications = async () => {
    if (cibles.length === 0 || loadingNotif) return
    setLoadingNotif(true)
    const res = await fetch('/api/admin/ciblage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'notifier', reference_id: referenceId, niveau, ciblages: cibles })
    })
    const data = await res.json()
    setLoadingNotif(false)
    if (!data.error) { setNotifEnvoyees(true); setCibles(p => p.map(c => ({ ...c, statut: 'notifie' }))) }
  }

  const toggleComp = (f: string) => setFiltreCompetences(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f])
  const toggleLang = (n: string) => setFiltreLangues(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])

  // ── Rendu ─────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ backgroundColor: C, color: 'white', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', flexShrink: 0 }}>
        <a href={`/admin/operations${selectedDeploymentId ? `?dep=${selectedDeploymentId}${selectedSinistreId ? `&sin=${selectedSinistreId}` : ''}` : ''}`} style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '13px' }}>← Opérations</a>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '600' }}>Ciblage des réservistes</h1>
      </div>

      {/* Barre de sélection */}
      <div style={{ backgroundColor: 'white', padding: '12px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', flexShrink: 0 }}>
        <div>
          <label style={LS}>Sinistre</label>
          <select value={selectedSinistreId} onChange={e => setSelectedSinistreId(e.target.value)} style={{ ...SS, minWidth: '220px' }}>
            <option value="">— Sélectionner —</option>
            {sinistres.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>
        <div>
          <label style={LS}>Déploiement</label>
          <select value={selectedDeploymentId} onChange={e => setSelectedDeploymentId(e.target.value)} disabled={!selectedSinistreId} style={{ ...SS, minWidth: '260px', opacity: !selectedSinistreId ? 0.5 : 1 }}>
            <option value="">— Sélectionner —</option>
            {deployments.map(d => <option key={d.id} value={d.id}>{d.identifiant} — {d.nom}</option>)}
          </select>
        </div>
        {selectedDeploymentId && (
          <div>
            <label style={LS}>Niveau</label>
            <div style={{ display: 'flex', border: `1px solid ${C}`, borderRadius: '6px', overflow: 'hidden' }}>
              {(['deploiement', 'rotation'] as const).map(n => (
                <button key={n} onClick={() => { setNiveau(n); setPool([]); setCibles([]); setAiSuggestions([]) }} style={{
                  padding: '7px 14px', fontSize: '13px', border: 'none', cursor: 'pointer',
                  backgroundColor: niveau === n ? C : 'white', color: niveau === n ? 'white' : C,
                  fontWeight: niveau === n ? '600' : '400'
                }}>
                  {n === 'deploiement' ? 'Par déploiement' : 'Par rotation'}
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedDeploymentId && niveau === 'rotation' && (
          <div>
            <label style={LS}>Rotation</label>
            <select value={selectedVagueId} onChange={e => { const id = e.target.value; setSelectedVagueId(id); setSelectedVague(vagues.find(v => v.id === id) || null); setPool([]); setCibles([]); setAiSuggestions([]) }} disabled={loadingVagues} style={{ ...SS, minWidth: '240px' }}>
              <option value="">— Sélectionner —</option>
              {vagues.map(v => <option key={v.id} value={v.id}>{v.identifiant} · {formatDate(v.date_debut)}→{formatDate(v.date_fin)} · {v.nb_personnes_requis} pers.</option>)}
            </select>
          </div>
        )}
        {estPret && (
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={demanderAI} disabled={loadingAI || loadingPool} style={{
              padding: '7px 16px', borderRadius: '6px', border: `2px solid ${C}`,
              backgroundColor: 'white', color: C, fontSize: '13px', fontWeight: '600',
              cursor: (loadingAI || loadingPool) ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              opacity: (loadingAI || loadingPool) ? 0.7 : 1
            }}>
              {loadingAI ? '⟳ Analyse en cours…' : '✦ Compléter avec l\'IA'}
            </button>
          </div>
        )}
      </div>

      {erreur && <div style={{ margin: '12px 24px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>⚠ {erreur}</div>}

      {estPret ? (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: '16px', padding: '16px 24px', flex: 1, minHeight: 0 }}>

          {/* ── COLONNE GAUCHE : Filtres ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', overflowY: 'auto', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

            {/* Recherche — accepte aussi des coordonnées GPS (lat, lon) comme point de référence */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <input type="text" placeholder="Nom, ville, région OU lat, lon (ex: 45.525, -73.877)" value={recherche} onChange={e => setRecherche(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' as const }} />
              {(() => {
                const m = recherche.trim().match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
                if (!m) return null
                const lat = parseFloat(m[1]), lon = parseFloat(m[2])
                const valid = lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
                return (
                  <div style={{ marginTop: 6, fontSize: 11, color: valid ? '#16a34a' : '#ef4444' }}>
                    {valid ? `✓ Coordonnées GPS : ${lat.toFixed(5)}, ${lon.toFixed(5)} — point de référence pour tri proximité` : '✗ Coordonnées hors plage'}
                  </div>
                )
              })()}
            </div>

            {/* Tri */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px', letterSpacing: '0.05em' }}>TRIER PAR</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '6px' }}>
                <input type="checkbox" checked={trierDistance} onChange={e => setTrierDistance(e.target.checked)} />
                📍 Proximité
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input type="checkbox" checked={trierBadges} onChange={e => setTrierBadges(e.target.checked)} />
                ⭐ Plus de compétences
              </label>
              <div style={{ marginTop: '6px', fontSize: '11px', color: geocoding ? '#f59e0b' : depCoords ? '#22c55e' : '#94a3b8' }}>
                {geocoding ? '⟳ Géolocalisation...' : depCoords ? '✓ Lieu géolocalisé' : '⚠ Lieu non trouvé'}
                {depCoords && <span style={{ display: 'block', color: '#94a3b8', marginTop: '2px' }}>Vol d'oiseau</span>}
              </div>
            </div>

            {/* Préférence */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px', letterSpacing: '0.05em' }}>PRÉFÉRENCE</div>
              {[{ val: '', label: 'Tous' }, { val: 'terrain', label: '🏔 Terrain' }, { val: 'sinistres', label: '🤝 Sinistrés' }].map(o => (
                <label key={o.val} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '4px' }}>
                  <input type="radio" name="pref" checked={filtrePreference === o.val} onChange={() => setFiltrePreference(o.val)} />
                  {o.label}
                </label>
              ))}
            </div>

            {/* Niveau ressource */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px', letterSpacing: '0.05em' }}>NIVEAU RESSOURCE</div>
              {[1, 2, 3].map(n => (
                <label key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '4px' }}>
                  <input type="checkbox" checked={filtreNiveaux.includes(n)}
                    onChange={() => setFiltreNiveaux(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n].sort())} />
                  {n === 1 ? '⚪ Niveau 1 — Tous' : n === 2 ? '🔵 Niveau 2 — Spécialités' : '🔴 Niveau 3 — Chef d’équipe'}
                </label>
              ))}
            </div>

            {/* Compétences */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.05em' }}>COMPÉTENCES</div>
                {(filtreCompetences.length > 0) && <button onClick={() => { setFiltreCompetences([]); setFiltreSubComp({}) }} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Effacer</button>}
              </div>
              {COMPETENCES.map(comp => {
                const actif = filtreCompetences.includes(comp.field)
                return (
                  <div key={comp.field} style={{ marginBottom: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px',
                      color: actif ? C : '#374151', fontWeight: actif ? '600' : '400' }}>
                      <input type="checkbox" checked={actif} onChange={() => {
                        toggleComp(comp.field)
                        setFiltreSubComp(p => { const n = {...p}; delete n[comp.field]; return n })
                      }} />
                      {comp.label}
                    </label>
                    {actif && SOUS_FILTRES[comp.field] && (
                      <div style={{ marginLeft: '20px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {SOUS_FILTRES[comp.field].map(o => (
                          <label key={o.val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px',
                            color: (filtreSubComp[comp.field]||'') === o.val ? C : '#64748b',
                            fontWeight: (filtreSubComp[comp.field]||'') === o.val ? '600' : '400' }}>
                            <input type="radio" name={`sub_${comp.field}`}
                              checked={(filtreSubComp[comp.field]||'') === o.val}
                              onChange={() => setFiltreSubComp(p => ({...p, [comp.field]: o.val}))} />
                            {o.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Langues */}
            {langues.length > 0 && (
              <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.05em' }}>LANGUES</div>
                  {filtreLangues.length > 0 && <button onClick={() => setFiltreLangues([])} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Effacer</button>}
                </div>
                {langues.map(l => (
                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', marginBottom: '4px',
                    color: filtreLangues.includes(l.nom) ? C : '#374151', fontWeight: filtreLangues.includes(l.nom) ? '600' : '400' }}>
                    <input type="checkbox" checked={filtreLangues.includes(l.nom)} onChange={() => toggleLang(l.nom)} />
                    {l.nom}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── COLONNE CENTRE : Pool ── */}
          <div style={{ ...carteStyle, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: C }}>Pool de candidats</h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {loadingPool ? 'Chargement...' : `${poolFiltre.length} affiché(s)`}
                </span>
              </div>

              {/* Ligne résumé déployabilité — pastilles cliquables */}
              {!loadingPool && poolFiltre.length > 0 && (() => {
                const total = poolFiltre.length
                const deployables = poolFiltre.filter(c => c.deployable).length
                const profil = poolFiltre.filter(c => c.profil_complet === true).length
                const initiation = poolFiltre.filter(c => c.initiation_sc === true).length
                const camp = poolFiltre.filter(c => c.camp_complete === true).length
                const bottes = poolFiltre.filter(c => c.bottes_ok === true).length
                const antecedents = poolFiltre.filter(c => c.antecedents_ok === true).length
                const steps: Array<{ key: ReadinessKey; icon: string; label: string; count: number }> = [
                  { key: 'profil',      icon: '👤', label: 'Profil complet',          count: profil },
                  { key: 'initiation',  icon: '🎓', label: 'Initiation SC complétée', count: initiation },
                  { key: 'camp',        icon: '⛺', label: 'Camp de qualification',    count: camp },
                  { key: 'bottes',      icon: '🥾', label: 'Bottes remboursées',       count: bottes },
                  { key: 'antecedents', icon: '🔍', label: 'Antécédents vérifiés',    count: antecedents },
                ]
                const cycle = (cur: null | 'has' | 'missing'): null | 'has' | 'missing' =>
                  cur === null ? 'has' : cur === 'has' ? 'missing' : null
                const toggle = (key: ReadinessKey) => setFiltresReadiness(p => ({ ...p, [key]: cycle(p[key]) }))
                const stateDeploy = filtresReadiness.deployable
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: badgesDisponibles.length > 0 ? 8 : 0, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    <span style={{ color: '#475569' }}>Déployabilité :</span>
                    <button
                      onClick={() => toggle('deployable')}
                      title={`${deployables}/${total} déployables`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        border: `1px solid ${stateDeploy === 'has' ? '#16a34a' : stateDeploy === 'missing' ? '#ef4444' : '#bbf7d0'}`,
                        backgroundColor: stateDeploy === 'has' ? '#f0fdf4' : stateDeploy === 'missing' ? '#fef2f2' : '#f0fdf4',
                        color: stateDeploy === 'has' ? '#16a34a' : stateDeploy === 'missing' ? '#ef4444' : '#16a34a',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {stateDeploy === 'has' ? '✓ ' : stateDeploy === 'missing' ? '✗ ' : ''}
                      {stateDeploy === 'missing' ? (total - deployables) : deployables} / {total} déployables
                    </button>
                    <span style={{ color: '#e2e8f0' }}>|</span>
                    {steps.map(s => {
                      const state = filtresReadiness[s.key]
                      const missing = total - s.count
                      const colors = state === 'has'
                        ? { border: '#16a34a', bg: '#f0fdf4', text: '#16a34a', badgeBg: '#16a34a', badgeCount: s.count }
                        : state === 'missing'
                        ? { border: '#ef4444', bg: '#fef2f2', text: '#ef4444', badgeBg: '#ef4444', badgeCount: missing }
                        : { border: '#e2e8f0', bg: 'white', text: '#64748b', badgeBg: '#16a34a', badgeCount: s.count }
                      return (
                        <button key={s.key}
                          onClick={() => toggle(s.key)}
                          title={`${s.count}/${total} ${s.label.toLowerCase()}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            border: `1px solid ${colors.border}`, backgroundColor: colors.bg, color: colors.text,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {state === 'has' && '✓ '}{state === 'missing' && '✗ '}{s.icon} {s.label}
                          <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, fontWeight: 700, backgroundColor: colors.badgeBg, color: 'white' }}>
                            {colors.badgeCount}
                          </span>
                        </button>
                      )
                    })}
                    {Object.values(filtresReadiness).some(v => v !== null) && (
                      <button
                        onClick={() => setFiltresReadiness({ profil: null, initiation: null, camp: null, bottes: null, antecedents: null, deployable: null })}
                        style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
                        ✕ Réinitialiser
                      </button>
                    )}
                  </div>
                )
              })()}
              {badgesDisponibles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {filtreBadges.length > 0 && (
                    <button onClick={() => setFiltreBadges([])} style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '8px',
                      border: '1px solid #ef4444', backgroundColor: '#fef2f2',
                      color: '#dc2626', cursor: 'pointer', fontWeight: '600'
                    }}>✕ Effacer ({filtreBadges.length})</button>
                  )}
                  {badgesDisponibles.map((label: string) => {
                    const actif = filtreBadges.includes(label)
                    return (
                      <button key={label} onClick={() => setFiltreBadges(p => actif ? p.filter(x => x !== label) : [...p, label])} style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '8px',
                        border: `1px solid ${actif ? C : '#d1d5db'}`,
                        backgroundColor: actif ? C : 'white',
                        color: actif ? 'white' : '#374151',
                        cursor: 'pointer', fontWeight: actif ? '600' : '400'
                      }}>{label}</button>
                    )
                  })}
                </div>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingPool ? (
                <div style={videStyle}>Chargement du pool…</div>
              ) : poolFiltre.length === 0 ? (
                <div style={videStyle}>Aucun candidat avec ces filtres</div>
              ) : poolFiltre.map(c => {
                const pref  = badgePref(c.preference_tache)
                const enCours = ajoutEnCours.includes(c.benevole_id)
                return (
                  <div key={c.benevole_id} style={{
                    display: 'flex', alignItems: 'center', padding: '9px 14px',
                    borderBottom: '1px solid #f1f5f9', gap: '10px',
                    backgroundColor: !c.deployable ? '#fffbeb' : 'white'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{c.prenom} {c.nom}</span>
                        {(c.niveau_ressource || 1) > 1 && (
                          <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px',
                            backgroundColor: (c.niveau_ressource || 1) === 3 ? '#fef2f2' : '#eff6ff',
                            color: (c.niveau_ressource || 1) === 3 ? '#dc2626' : '#1d4ed8', fontWeight: '700' }}>
                            Niv.{c.niveau_ressource}
                          </span>
                        )}
                        {c.en_deploiement_actif  && <span style={badge('#f59e0b')}>⚠ Déployé</span>}
                        {c.repos_requis_jusqu    && <span style={badge('#ef4444')}>⛔ Repos</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{c.ville}{c.ville && c.region ? ', ' : ''}{c.region}</span>
                        {depCoords && c.distance_km !== undefined && (
                          <span style={{ color: c.distance_km < 50 ? '#22c55e' : c.distance_km < 150 ? '#f59e0b' : '#94a3b8', fontWeight: '600' }}>
                            📍 {c.distance_km} km
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '3px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: pref.bg, color: pref.color }}>{pref.label}</span>
                        {getCompetencesBadges(c).map((b, i) => (
                          <span key={i} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: b.bg, color: b.color, fontWeight: '500' }}>{b.label}</span>
                        ))}
                        {(c.langues || []).filter((l: string) => l !== 'Français').map((l: string) => (
                          <span key={l} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: '#f3e8ff', color: '#7c3aed' }}>{l}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => ajouter(c)} disabled={enCours} style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      border: `2px solid ${C}`, backgroundColor: enCours ? '#e2e8f0' : 'white',
                      color: C, fontSize: '20px', cursor: enCours ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, paddingBottom: '1px'
                    }}>
                      {enCours ? '…' : '+'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── COLONNE DROITE : IA + Ciblés ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>

            {/* Suggestions IA */}
            {aiEnrichies.length > 0 && (() => {
              const badgesIA_dispo = Array.from(new Set(
                aiEnrichies.flatMap(s => s.candidat ? getCompetencesBadges(s.candidat).map(b => b.label) : [])
              )).sort() as string[]
              const aiFiltrees = aiEnrichies.filter(s => {
                if (filtreBadges.length === 0) return true
                const bl = s.candidat ? getCompetencesBadges(s.candidat).map(b => b.label) : []
                return filtreBadges.every(fb => bl.includes(fb))
              })
              const toutCoches = aiCochees.length === aiFiltrees.length && aiFiltrees.length > 0
              return (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: badgesIA_dispo.length > 0 ? '6px' : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" checked={toutCoches} onChange={() => setAiCochees(toutCoches ? [] : aiFiltrees.map(s => s.benevole_id))} />
                        <span style={{ fontWeight: '600', fontSize: '13px', color: '#15803d' }}>✦ Suggestions IA ({aiFiltrees.length})</span>
                      </div>
                      <button onClick={async () => {
                        const aAjouter = aiCochees.length > 0
                          ? aiEnrichies.filter(s => aiCochees.includes(s.benevole_id))
                          : aiFiltrees
                        for (const s of aAjouter) { if (s.candidat) await ajouter(s.candidat, true) }
                        setAiCochees([])
                      }} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: '1px solid #16a34a', backgroundColor: 'white', color: '#16a34a', cursor: 'pointer', fontWeight: '600' }}>
                        {aiCochees.length > 0 ? `Ajouter (${aiCochees.length})` : 'Tout ajouter'}
                      </button>
                    </div>
                    {badgesIA_dispo.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {filtreBadges.length > 0 && (
                          <button onClick={() => setFiltreBadges([])} style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>✕</button>
                        )}
                        {badgesIA_dispo.map((label: string) => {
                          const actif = filtreBadges.includes(label)
                          return (
                            <button key={label} onClick={() => setFiltreBadges(p => actif ? p.filter(x => x !== label) : [...p, label])} style={{
                              fontSize: '9px', padding: '1px 6px', borderRadius: '8px',
                              border: `1px solid ${actif ? C : '#d1d5db'}`,
                              backgroundColor: actif ? C : 'white',
                              color: actif ? 'white' : '#374151', cursor: 'pointer'
                            }}>{label}</button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {aiFiltrees.map(s => {
                      const badgesS = s.candidat ? getCompetencesBadges(s.candidat) : []
                      const distS = s.candidat?.distance_km
                      const cochee = aiCochees.includes(s.benevole_id)
                      return (
                        <div key={s.benevole_id} onClick={() => setAiCochees(p => cochee ? p.filter(x => x !== s.benevole_id) : [...p, s.benevole_id])}
                          style={{ padding: '7px 12px', borderBottom: '1px solid #dcfce7', display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', backgroundColor: cochee ? '#dcfce7' : 'transparent' }}>
                          <input type="checkbox" checked={cochee} onChange={() => {}} style={{ marginTop: '3px', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '500', fontSize: '13px', color: '#1e293b' }}>{s.candidat?.prenom} {s.candidat?.nom}</span>
                              {depCoords && distS !== undefined && (
                                <span style={{ fontSize: '10px', fontWeight: '600', color: distS < 50 ? '#22c55e' : distS < 150 ? '#f59e0b' : '#94a3b8' }}>📍 {distS} km</span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{s.candidat?.ville}{s.candidat?.ville && s.candidat?.region ? ', ' : ''}{s.candidat?.region}</div>
                            <div style={{ fontSize: '11px', color: '#16a34a', fontStyle: 'italic' }}>{s.raison}</div>
                            {badgesS.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '3px' }}>
                                {badgesS.map((b, i) => (
                                  <span key={i} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: b.bg, color: b.color, fontWeight: '500' }}>{b.label}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Carte ciblés */}
            <div style={{ ...carteStyle, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: C }}>Réservistes ciblés</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {cibles.length > 0 && (
                      <button
                        onClick={() => {
                          try {
                            localStorage.setItem('riusc_ops_step4_done', selectedDeploymentId)
                            // Sauvegarder les ciblages pour restauration immédiate dans le wizard
                            localStorage.setItem('riusc_ops_ciblages_cache', JSON.stringify({
                              depId: selectedDeploymentId,
                              data: cibles.map(c => ({
                                id: c.id,
                                benevole_id: c.benevole_id,
                                statut: c.statut,
                                reservistes: c.reservistes,
                              }))
                            }))
                          } catch {}
                          const url = `/admin/operations?dep=${selectedDeploymentId}${selectedSinistreId ? `&sin=${selectedSinistreId}` : ''}`
                          window.location.href = url
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: '6px', border: 'none',
                          backgroundColor: dansLaFourchette ? '#065f46' : '#1e3a5f',
                          color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                        }}
                      >
                        ✓ Terminé → Opérations
                      </button>
                    )}
                    <span style={{ fontSize: '24px', fontWeight: '700', color: couleurJauge, lineHeight: 1 }}>
                      {cibles.length}<span style={{ fontSize: '13px', fontWeight: '400', color: '#94a3b8' }}> / {ratioMax}</span>
                    </span>
                  </div>
                </div>
                <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '5px' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: couleurJauge, borderRadius: '3px', transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Objectif {ratioMin}–{ratioMax} ({nbRequis} × 3-4)</span>
                  {dansLaFourchette && <span style={{ color: '#22c55e', fontWeight: '600' }}>✓ OK</span>}
                  {notifEnvoyees && <span style={{ color: '#3b82f6', fontWeight: '600' }}>✓ Notifiés</span>}
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {cibles.length === 0 ? (
                  <div style={videStyle}>Aucun réserviste ciblé</div>
                ) : cibles.map(cible => (
                  <div key={cible.id} style={{ padding: '8px 14px', borderBottom: '1px solid #f1f5f9', backgroundColor: cible.statut === 'notifie' ? '#f0fdf4' : 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '500', fontSize: '13px' }}>{cible.reservistes.prenom} {cible.reservistes.nom}</span>
                          {cible.ajoute_par_ia && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a', fontWeight: '700' }}>IA</span>}
                          {cible.statut === 'notifie' && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: '700' }}>✓ notifié</span>}
                          {cible.statut === 'mobilise' && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: '700' }}>🚀 mobilisé</span>}
                          {cible.statut === 'confirme' && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#bbf7d0', color: '#15803d', fontWeight: '700' }}>✅ confirmé</span>}
                          {cible.statut === 'termine' && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '8px', backgroundColor: '#e5e7eb', color: '#374151', fontWeight: '700' }}>🏁 terminé</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{cible.reservistes.ville}{cible.reservistes.ville && cible.reservistes.region ? ', ' : ''}{cible.reservistes.region}</span>
                          {(() => {
                            const candidat = pool.find(p => p.benevole_id === cible.benevole_id)
                            const dist = candidat?.distance_km
                            if (!depCoords || dist === undefined) return null
                            return <span style={{ color: dist < 50 ? '#22c55e' : dist < 150 ? '#f59e0b' : '#94a3b8', fontWeight: '600' }}>📍 {dist} km</span>
                          })()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {(cible.statut === 'mobilise' || cible.statut === 'confirme') && (
                          <button
                            onClick={() => demobiliserPersonne(cible)}
                            title="Démobiliser (déploiement passe à son historique)"
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: '1px solid #a7f3d0', backgroundColor: '#ecfdf5', color: '#065f46', cursor: 'pointer' }}>
                            🏁
                          </button>
                        )}
                        {(cible.statut === 'cible' || cible.statut === 'termine') && (
                          <button onClick={() => retirer(cible)} title="Retirer du ciblage"
                            style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #fca5a5', backgroundColor: 'white', color: '#ef4444', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const candidat = pool.find(p => p.benevole_id === cible.benevole_id)
                      if (!candidat) return null
                      const badges = getCompetencesBadges(candidat)
                      if (badges.length === 0) return null
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                          {badges.map((b, i) => (
                            <span key={i} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', backgroundColor: b.bg, color: b.color, fontWeight: '500' }}>{b.label}</span>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div style={{ padding: '80px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '48px', marginBottom: '14px' }}>🎯</div>
          <p style={{ fontSize: '15px', margin: 0, color: '#64748b' }}>
            Sélectionnez un sinistre et un déploiement pour démarrer le ciblage
          </p>
          {!selectedSinistreId && sinistres.length === 0 && !loadingSinistres && (
            <p style={{ fontSize: '13px', color: '#f59e0b', marginTop: '10px' }}>Aucun sinistre actif trouvé</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles partagés ────────────────────────────────────────
const LS: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const SS: React.CSSProperties = { padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: 'white', color: '#1e293b' }
const carteStyle: React.CSSProperties = { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }
const videStyle: React.CSSProperties = { padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }
const badge = (color: string): React.CSSProperties => ({ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: `${color}20`, color, fontWeight: '600' })
