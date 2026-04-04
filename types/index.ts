// ─── Types centralisés — Portail RIUSC ──────────────────────────────────────
// Source unique pour toutes les interfaces du projet.
// Importer avec : import { Reserviste, Sinistre, ... } from '@/types'

// ─── Réserviste ─────────────────────────────────────────────────────────────

/** Profil complet d'un réserviste (table `reservistes`) */
export interface Reserviste {
  id?: number
  benevole_id: string
  user_id?: string
  role?: string
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
  statut?: string
  photo_url?: string
  consent_photos?: boolean
  consentement_antecedents?: boolean
  allergies_alimentaires?: string
  allergies_autres?: string
  conditions_medicales?: string
  problemes_sante?: string
  antecedents_statut?: string
  antecedents_date_verification?: string
  antecedents_date_expiration?: string
  monday_created_at?: string
  remboursement_bottes_date?: string
  groupe_sanguin?: string
}

// ─── Opérations (sinistres, demandes, déploiements) ─────────────────────────

/** Sinistre / incident (table `sinistres`) */
export interface Sinistre {
  id: string
  monday_id?: string
  nom: string
  type_incident?: string
  lieu?: string
  date_debut?: string
  date_fin?: string
  statut: string
  created_at?: string
  updated_at?: string
  demandes?: Demande[]
}

/** Demande d'un organisme partenaire (table `demandes`) */
export interface Demande {
  id: string
  monday_id?: string
  sinistre_id: string
  organisme: string
  type_mission?: string
  description?: string
  lieu?: string
  nb_personnes_requis?: number
  date_debut?: string
  date_fin_estimee?: string
  priorite: string
  statut: string
  date_reception?: string
  identifiant?: string
  organisme_detail?: string
  type_mission_detail?: string
  contact_nom?: string
  contact_titre?: string
  contact_telephone?: string
  contact_email?: string
}

/** Plan de déploiement (table `deployments`) */
export interface Deployment {
  id: string
  monday_id?: string
  demande_id?: string
  identifiant: string
  nom: string
  lieu?: string
  date_debut?: string
  date_fin?: string
  nb_personnes_par_vague?: number
  statut: string
  point_rassemblement?: string
  transport?: string
  hebergement?: string
  notes_logistique?: string
  created_at?: string
  rotations?: Vague[]
  demandes_ids?: string[]
}

/** Vue déploiement actif (table `deploiements_actifs`) */
export interface DeploiementActif {
  id: string
  deploiement_id: string
  nom_deploiement: string
  nom_sinistre?: string
  nom_demande?: string
  organisme?: string
  date_debut: string
  date_fin: string | null
  lieu?: string
  statut: string
  type_incident?: string
}

/** Vague / rotation d'un déploiement (table `vagues`) */
export interface Vague {
  id: string
  monday_id?: string
  identifiant?: string
  deployment_id?: string
  numero: number
  date_debut: string
  date_fin: string
  nb_personnes_requis?: number
  statut: string
  created_at?: string
}

// ─── Disponibilités et ciblage ──────────────────────────────────────────────

/** Disponibilité soumise (table `disponibilites_v2`) */
export interface DisponibiliteV2 {
  id: string
  benevole_id: string
  deployment_id?: string
  date_jour: string
  disponible: boolean
  a_confirmer?: boolean
  commentaire?: string
  reservistes?: { prenom: string; nom: string }
}

/** Disponibilité legacy (table `disponibilites`) */
export interface Disponibilite {
  id: string
  monday_item_id?: string
  benevole_id: string
  deploiement_id: string
  nom_deploiement: string
  nom_sinistre?: string
  nom_demande?: string
  organisme_demande?: string
  date_debut: string
  date_fin: string
  statut: string
  statut_version?: string
  commentaire?: string
  transport?: string
  envoye_le?: string
  repondu_le?: string
  user_id?: string
}

/** Ciblage d'un réserviste pour un déploiement (table `ciblages`) */
export interface Ciblage {
  id: string
  benevole_id: string
  deploiement_id?: string
  statut: string
  reservistes?: { prenom: string; nom: string; telephone: string }
}

/** Réponse de ciblage (table `ciblages_reponses`) */
export interface CiblageReponse {
  id: string
  benevole_id: string
  deploiement_id: string
  statut_envoi?: string
  date_disponible_debut?: string
  date_disponible_fin?: string
  transport?: string
  commentaires?: string
}

/** Assignation à une vague */
export interface Assignation {
  id: string
  vague_id: string
  benevole_id: string
  statut?: string
}

// ─── Formations et certificats ──────────────────────────────────────────────

/** Formation / certification d'un réserviste (table `formations_benevoles`) */
export interface Formation {
  id: string
  benevole_id?: string
  nom: string
  catalogue: string
  session?: string
  role?: string
  resultat: string
  etat_validite?: string
  date_reussite: string | null
  date_expiration: string | null
  commentaire?: string
  has_fichier?: boolean
  fichiers?: CertificatFile[]
  source?: string
  certificat_requis?: boolean
  certificat_url?: string
}

/** Fichier de certificat */
export interface CertificatFile {
  id?: string
  name: string
  url?: string | null
}

/** Document officiel (table `documents_officiels`) */
export interface DocumentOfficiel {
  id: number
  benevole_id: string
  type_document: string
  titre: string
  nom_fichier: string
  chemin_storage: string
}

// ─── Camps ──────────────────────────────────────────────────────────────────

/** Information d'un camp */
export interface CampInfo {
  nom: string
  dates: string
  site: string
  location: string
}

/** Statut d'inscription à un camp */
export interface CampStatus {
  is_certified: boolean
  has_inscription: boolean
  session_id: string | null
  camp: CampInfo | null
  lien_inscription: string | null
}

/** Session de camp disponible */
export interface SessionCamp {
  session_id: string
  nom: string
  dates: string
  site: string
  location: string
}

// ─── Communauté ─────────────────────────────────────────────────────────────

/** Message communautaire (table `messages`) */
export interface Message {
  id: string
  user_id: string
  benevole_id: string
  auteur_nom: string
  auteur_photo: string | null
  contenu: string
  canal: string
  created_at: string
  reply_to_id?: string | null
  image_url?: string | null
  file_name?: string | null
  edited_at?: string | null
  is_deleted?: boolean
}

/** Réaction à un message (table `message_reactions`) */
export interface Reaction {
  id: string
  message_id: string
  user_id: string
  benevole_id: string
  emoji?: string
  reaction_type?: string
}

// ─── Sélection / Mobilisation ───────────────────────────────────────────────

/** Statut de sélection pour un réserviste */
export interface SelectionStatus {
  statut: 'Sélectionné' | 'Non sélectionné' | 'En attente' | null
  deploiement: {
    nom: string
    lieu: string
    date_depart: string
    heure_rassemblement: string
    point_rassemblement: string
    duree: string
    consignes: string[]
  } | null
}

/** Vague de mobilisation confirmée */
export interface MobilisationVague {
  mobilisation_item_id: string
  vague_id: string
  deploiement_nom: string
  tache: string
  ville: string
  date_debut: string
  date_fin: string | null
  horaire: string | null
  statut_confirmation: string
}

// ─── Référentiels ───────────────────────────────────────────────────────────

/** Organisation partenaire (table `organisations`) */
export interface Organisation {
  id: string
  nom: string
}

/** Langue (table `langues`) */
export interface Langue {
  id: string
  nom: string
}

// ─── Profil / Dossier ───────────────────────────────────────────────────────

/** Données du dossier réserviste (formulaire profil) */
export interface DossierData {
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
  experience_urgence_detail: string
  autres_competences: string
  commentaire: string
  confidentialite: boolean
  consentement_antecedents: boolean
  preference_tache: string
  preference_tache_commentaire: string
}

// ─── Geocodage ──────────────────────────────────────────────────────────────

/** Feature Mapbox pour l'autocomplétion d'adresses */
export interface MapboxFeature {
  place_name: string
  center: [number, number]
  context?: Array<{ id: string; text: string }>
}

// ─── Courriels (Resend) ─────────────────────────────────────────────────────

/** Courriel envoyé à un réserviste (table `courriels`) */
export interface Courriel {
  id: string
  campagne_id?: string | null
  benevole_id: string
  from_email: string
  from_name: string
  to_email: string
  subject: string
  body_html: string
  resend_id?: string | null
  statut: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  ouvert_at?: string | null
  clics_count: number
  envoye_par: string
  created_at: string
}

/** Campagne d'envoi de masse (table `courriel_campagnes`) */
export interface CourrielCampagne {
  id: string
  nom: string
  subject: string
  body_html: string
  total_envoyes: number
  envoye_par: string
  created_at: string
}

/** Événement webhook Resend (table `courriel_events`) */
export interface CourrielEvent {
  id: string
  courriel_id: string
  event_type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
  metadata: Record<string, unknown>
  created_at: string
}

/** Configuration email d'un admin (table `admin_email_config`) */
export interface AdminEmailConfig {
  id: string
  user_id: string
  from_name: string
  from_email: string
  signature_html: string
  reply_to?: string | null
  created_at: string
  updated_at: string
}
