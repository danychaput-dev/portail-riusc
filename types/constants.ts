// ─── Constantes métier — Portail RIUSC ──────────────────────────────────────
// Source unique pour toutes les valeurs hardcodées du domaine.
// Importer avec : import { TYPES_INCIDENT, ORGANISMES, ... } from '@/types/constants'

// ─── Sinistres ──────────────────────────────────────────────────────────────

export const TYPES_INCIDENT = [
  'Inondation',
  'Incendie',
  'Glissement de terrain',
  'Vague de froid',
  'Vague de chaleur',
  'Tempête',
  'Accident industriel',
  'Recherche et sauvetage',
  'Vérification de bien-être',
  'Évacuation',
  'Autre',
] as const

// ─── Organismes ─────────────────────────────────────────────────────────────

export const ORGANISMES = [
  'SOPFEU',
  'Croix-Rouge',
  'Municipalité',
  'Gouvernement du Québec',
  'Autre',
] as const

/** ID de l'organisation AQBRS dans Supabase */
export const AQBRS_ORG_ID = 'bb948f22-a29e-42db-bdd9-aabab8a95abd'

// ─── Types de mission par organisme ─────────────────────────────────────────

export const TYPES_MISSION: Record<string, string[]> = {
  'SOPFEU': [
    'Construction de digues',
    'Gestion des débris',
    'Logistique terrain',
    'Support opérationnel',
  ],
  'Croix-Rouge': [
    'Centre de services aux sinistrés',
    "Hébergement d'urgence",
    'Distribution de ressources',
    'Soutien psychosocial',
    'Inscription et référencement',
  ],
  'default': [
    'Construction de digues',
    'Gestion des débris',
    'Centre de services aux sinistrés',
    "Hébergement d'urgence",
    'Distribution de ressources',
    'Soutien psychosocial',
    'Recherche et sauvetage',
    'Vérification de bien-être',
    'Logistique',
    'Support opérationnel',
    'Autre',
  ],
}

// ─── Abréviations organismes ────────────────────────────────────────────────

export const ORGANISME_ABBR: Record<string, string> = {
  'Croix-Rouge': 'CR',
  'Municipalité': 'MUN',
  'SOPFEU': 'SPF',
  'Gouvernement du Québec': 'GQC',
}

export function orgAbbr(organisme: string): string {
  return ORGANISME_ABBR[organisme] || organisme.slice(0, 3).toUpperCase()
}

// ─── Wizard opérations (8 étapes) ───────────────────────────────────────────

export const STEP_LABELS = [
  'Sinistre',
  'Demandes',
  'Déploiement',
  'Ciblage',
  'Notification dispos',
  'Disponibilités reçues',
  'Rotation créée',
  'Mobilisation confirmée',
] as const

export const STEP_SUBS = [
  'Créer ou sélectionner',
  'Lier les demandes',
  'Créer ou sélectionner',
  'Réservistes ciblés',
  'Message éditable + envoi',
  'Ciblés / Échéancier / Rotations',
  'IA suggère les affectations',
  'Confirmer + envoyer',
] as const

// ─── Groupes sanguins ───────────────────────────────────────────────────────

export const GROUPES_SANGUIN = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu'] as const

export const GROUPE_SANGUIN_MAP: Record<string, number> = {
  'A+': 1, 'B+': 2, 'A-': 3, 'A−': 3,
  'B-': 4, 'B−': 4, 'AB+': 5,
  'AB-': 6, 'AB−': 6, 'O+': 7, 'O-': 8, 'O−': 8,
}

export const GROUPE_SANGUIN_REVERSE: Record<number, string> = {
  1: 'A+', 2: 'B+', 3: 'A-', 4: 'B-',
  5: 'AB+', 6: 'AB-', 7: 'O+', 8: 'O-',
}

// ─── Statuts ───────────────────────────────────────────────────────────────

export const STATUTS_SINISTRE = ['Actif', 'En veille', 'Fermé'] as const
export const STATUTS_DEMANDE = ['Nouvelle', 'En traitement', 'Complétée', 'Annulée'] as const
export const PRIORITES = ['Urgente', 'Haute', 'Normale', 'Basse'] as const
export const STATUTS_DEPLOIEMENT = ['Planifié', 'Demande disponibilités', 'En cours', 'Complété', 'Annulé'] as const
export const STATUTS_ROTATION = ['Planifiée', 'Notifications envoyées', 'En cours', 'Complétée', 'Annulée'] as const

// ─── Couleurs statuts / priorités ──────────────────────────────────────────

export const STATUT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Actif':                   { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  'En veille':               { bg: '#fffbeb', border: '#fcd34d', text: '#d97706' },
  'Fermé':                   { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
  'Nouvelle':                { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
  'En traitement':           { bg: '#fffbeb', border: '#fcd34d', text: '#d97706' },
  'Complétée':               { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  'Annulée':                 { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
  'Planifié':                { bg: '#f5f3ff', border: '#ddd6fe', text: '#7c3aed' },
  'Demande disponibilités':  { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
  'En cours':                { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  'Complété':                { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  'Annulé':                  { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
  'Planifiée':               { bg: '#f5f3ff', border: '#ddd6fe', text: '#7c3aed' },
  'Notifications envoyées':  { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
}

export const PRIORITE_COLORS: Record<string, string> = {
  'Urgente': '#dc2626', 'Haute': '#d97706', 'Normale': '#2563eb', 'Basse': '#6b7280'
}

// ─── Helpers de nommage automatique ────────────────────────────────────────

const MOIS_COURT = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

export function dateCourtFr(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MOIS_COURT[d.getMonth()]}`
}

export function slugCourt(s: string, max = 15): string {
  return (s || '').trim().slice(0, max).trim()
}

export function genNomSinistre(type: string, lieu: string, date: string): string {
  const d = date || new Date().toISOString().slice(0, 10)
  const t = slugCourt(type.replace(/\s+/g, '-'), 20)
  const l = slugCourt(lieu.split(',')[0].trim().replace(/\s+/g, '-'), 20)
  return [d, t, l].filter(Boolean).join('-')
}

export function genNomDemande(organisme: string, date: string, mission: string): string {
  const org = orgAbbr(organisme)
  const d = dateCourtFr(date)
  const m = slugCourt(mission, 12)
  return [org, d, m].filter(Boolean).join('-')
}

export function genNomDeployment(demandes: { organisme: string; type_mission?: string }[], lieu: string): string {
  const orgs = [...new Set(demandes.map(d => orgAbbr(d.organisme)))].join('+')
  const missions = [...new Set(demandes.map(d => slugCourt(d.type_mission || '', 10)))].filter(Boolean).join('/')
  const l = slugCourt(lieu.split(',')[0].trim(), 25)
  return [orgs, missions, l].filter(Boolean).join(' - ')
}

export function genNomRotation(demandes: { organisme: string; type_mission?: string }[], date: string, nb?: string): string {
  const orgs = [...new Set(demandes.map(d => orgAbbr(d.organisme)))].join('+')
  const missions = [...new Set(demandes.map(d => slugCourt(d.type_mission || '', 8)))].filter(Boolean).join('/')
  const d = dateCourtFr(date)
  const n = nb ? `(${nb} pers)` : ''
  return [orgs, missions, d, n].filter(Boolean).join(' - ')
}

export function previewDemande(organisme: string, date: string, mission: string): string {
  if (!organisme) return '— remplir les champs —'
  const org = orgAbbr(organisme)
  const d = dateCourtFr(date)
  const m = slugCourt(mission, 12)
  return `DEM-### - ${[org, d, m].filter(Boolean).join('-')}`
}

export function previewDeployment(demandes: { organisme: string; type_mission?: string }[], lieu: string): string {
  if (!demandes.length) return '— sélectionner les demandes —'
  const orgs = [...new Set(demandes.map(d => orgAbbr(d.organisme)))].join('+')
  const missions = [...new Set(demandes.map(d => slugCourt(d.type_mission || '', 10)))].filter(Boolean).join('/')
  const l = slugCourt(lieu.split(',')[0].trim(), 20)
  return `DEP-### - ${[orgs, missions, l].filter(Boolean).join(' - ')}`
}

export function getMissions(organisme: string): string[] {
  return TYPES_MISSION[organisme] || TYPES_MISSION['default']
}

// ─── Helpers de date ────────────────────────────────────────────────────────

/** Convertit une date ISO (YYYY-MM-DD) en format français (DD/MM/YYYY) */
export function dateFr(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
