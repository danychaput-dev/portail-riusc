// Types partagés pour le wizard Operations (8 étapes)

export type StepStatus = 'locked' | 'active' | 'done'

export interface Sinistre {
  id: string
  nom: string
  type_incident?: string
  lieu?: string
  date_debut?: string
  statut: string
}

export interface Demande {
  id: string
  sinistre_id: string
  organisme: string
  type_mission?: string
  lieu?: string
  nb_personnes_requis?: number
  date_debut?: string
  date_fin_estimee?: string
  priorite: string
  statut: string
  identifiant?: string
  contact_nom?: string
  contact_telephone?: string
}

export interface Deployment {
  id: string
  identifiant: string
  nom: string
  lieu?: string
  date_debut?: string
  date_fin?: string
  nb_personnes_par_vague?: number
  statut: string
  point_rassemblement?: string
  notes_logistique?: string
}

export interface Ciblage {
  id: string
  benevole_id: string
  statut: string
  reservistes: { prenom: string; nom: string; telephone: string }
}

export interface DispoV2 {
  id: string
  benevole_id: string
  date_jour: string
  disponible: boolean
  commentaire?: string
  reservistes?: { prenom: string; nom: string }
}

export interface Vague {
  id: string
  identifiant?: string
  numero: number
  date_debut: string
  date_fin: string
  nb_personnes_requis?: number
  statut: string
}

// Constantes étapes
export const STEP_LABELS = [
  'Sinistre', 'Demandes', 'Déploiement', 'Ciblage',
  'Notification dispos', 'Disponibilités reçues', 'Rotation créée', 'Mobilisation confirmée',
]

export const STEP_SUBS = [
  'Créer ou sélectionner', 'Lier les demandes', 'Créer ou sélectionner', 'Réservistes ciblés',
  'Message éditable + envoi', 'Ciblés / Échéancier / Rotations', 'IA suggère les affectations', 'Confirmer + envoyer',
]

export const STEP_ICONS = ['🔥', '📋', '🚁', '🎯', '📨', '📊', '✦', '🚀']

// Constantes métier (locales à operations)
export const TYPES_INCIDENT = [
  'Inondation', 'Incendie', 'Glissement de terrain', 'Vague de froid',
  'Vague de chaleur', 'Tempête', 'Accident industriel',
  'Recherche et sauvetage', 'Vérification de bien-être', 'Évacuation', 'Autre',
]

export const ORGANISMES = ['SOPFEU', 'Croix-Rouge', 'Municipalité', 'Gouvernement du Québec', 'Autre']

export const TYPES_MISSION: Record<string, string[]> = {
  'SOPFEU': ['Construction de digues', 'Gestion des débris', 'Logistique terrain', 'Support opérationnel'],
  'Croix-Rouge': ['Centre de services aux sinistrés', "Hébergement d'urgence", 'Distribution de ressources', 'Soutien psychosocial', 'Inscription et référencement'],
  'default': ['Construction de digues', 'Gestion des débris', 'Centre de services aux sinistrés', "Hébergement d'urgence", 'Distribution de ressources', 'Soutien psychosocial', 'Recherche et sauvetage', 'Vérification de bien-être', 'Logistique', 'Support opérationnel', 'Autre'],
}
