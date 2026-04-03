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

// ─── Helpers de date ────────────────────────────────────────────────────────

/** Convertit une date ISO (YYYY-MM-DD) en format français (DD/MM/YYYY) */
export function dateFr(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
