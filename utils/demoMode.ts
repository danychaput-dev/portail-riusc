// utils/demoMode.ts — Mode démonstration RIUSC
// Ce fichier fournit les données fictives pour le mode démo

export function isDemoActive(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('demo_mode') === 'true'
}

export function getDemoGroupe(): 'Intérêt' | 'Approuvé' {
  if (typeof window === 'undefined') return 'Intérêt'
  return (localStorage.getItem('demo_groupe') || 'Intérêt') as 'Intérêt' | 'Approuvé'
}

export const DEMO_RESERVISTE = {
  benevole_id: 'DEMO-001',
  prenom: 'Marie-Ève',
  nom: 'Tremblay',
  email: 'marie-eve.tremblay@example.com',
  telephone: '4185551234',
  photo_url: undefined as string | undefined,
  groupe: 'Approuvé', // sera overridé dynamiquement
  date_naissance: '1988-06-15',
  adresse: '123 rue des Érables',
  ville: 'Sherbrooke',
  region: 'Estrie',
  contact_urgence_nom: 'Jean Tremblay',
  contact_urgence_telephone: '4185559876',
  allergies_alimentaires: 'Arachides',
  allergies_autres: '',
  conditions_medicales: '',
  consent_photo: true,
  consent_photos: true,
}

export const DEMO_USER = { id: 'demo_user', email: DEMO_RESERVISTE.email }

export const DEMO_MESSAGES = [
  {
    id: 'demo-msg-1',
    user_id: 'demo-user-2',
    benevole_id: 'DEMO-002',
    auteur_nom: 'Jean-François Lavoie',
    auteur_photo: null,
    contenu: 'Bonjour à tous ! Quelqu\'un a des nouvelles sur le prochain camp de qualification ?',
    canal: 'general',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'demo-msg-2',
    user_id: 'demo-user-3',
    benevole_id: 'DEMO-003',
    auteur_nom: 'Sophie Bergeron',
    auteur_photo: null,
    contenu: 'Oui ! La cohorte 8 est prévue pour avril à Nicolet. Les inscriptions sont ouvertes sur le portail.',
    canal: 'general',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'demo-msg-3',
    user_id: 'demo-user-4',
    benevole_id: 'DEMO-004',
    auteur_nom: 'Martin Gagnon',
    auteur_photo: null,
    contenu: 'Super expérience lors du dernier déploiement à Gatineau. L\'équipe était vraiment soudée. 💪',
    canal: 'general',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'demo-msg-4',
    user_id: 'demo-user-2',
    benevole_id: 'DEMO-002',
    auteur_nom: 'Jean-François Lavoie',
    auteur_photo: null,
    contenu: 'N\'oubliez pas de mettre vos disponibilités à jour pour les prochaines semaines !',
    canal: 'general',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'demo-msg-5',
    user_id: 'demo-user-5',
    benevole_id: 'DEMO-005',
    auteur_nom: 'Isabelle Roy',
    auteur_photo: null,
    contenu: 'Merci pour le rappel ! C\'est fait de mon côté. 👍',
    canal: 'general',
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
]

export const DEMO_FORMATIONS = [
  {
    id: 'demo-f1',
    nom: "S'initier à la sécurité civile",
    catalogue: "S'initier à la sécurité civile",
    session: "S'initier à la sécurité civile",
    role: 'Participant',
    resultat: 'Réussi',
    etat_validite: 'Valide',
    date_reussite: '2025-11-20',
    date_expiration: null,
    commentaire: '',
    has_fichier: true,
    fichiers: [{ name: 'Certificat_Sinitier.pdf', url: null }],
  },
  {
    id: 'demo-f2',
    nom: 'Le bénévole en sécurité civile (AQBRS)',
    catalogue: 'Le bénévole en sécurité civile (AQBRS)',
    session: 'Le bénévole en sécurité civile (AQBRS)',
    role: 'Participant',
    resultat: 'Réussi',
    etat_validite: 'Valide',
    date_reussite: '2025-12-05',
    date_expiration: null,
    commentaire: '',
    has_fichier: false,
    fichiers: [],
  },
  {
    id: 'demo-f3',
    nom: 'Cohorte 7 - Camp de qualification - TR',
    catalogue: 'Cohorte 7 - Camp de qualification - TR',
    session: 'Cohorte 7 - Camp de qualification - TR',
    role: 'Participant',
    resultat: 'Réussi',
    etat_validite: 'Valide',
    date_reussite: '2026-01-18',
    date_expiration: null,
    commentaire: '',
    has_fichier: true,
    fichiers: [{ name: 'Attestation_Camp_Cohorte7.pdf', url: null }],
  },
]

export const DEMO_DEPLOIEMENTS = [
  {
    id: 'demo-dep-1',
    deploiement_id: 'demo-dep-1',
    nom_deploiement: 'Inondations printanières - Gatineau',
    nom_sinistre: 'Inondations printanières 2026',
    nom_demande: 'Demande MSP-2026-045',
    organisme: 'Ville de Gatineau',
    date_debut: '2026-03-15',
    date_fin: '2026-03-22',
    lieu: 'Gatineau, secteur Hull',
    statut: 'actif',
    type_incident: 'Inondation',
  },
  {
    id: 'demo-dep-2',
    deploiement_id: 'demo-dep-1',
    nom_deploiement: 'Inondations printanières - Laval',
    nom_sinistre: 'Inondations printanières 2026',
    nom_demande: 'Demande MSP-2026-045',
    organisme: 'Ville de Laval',
    date_debut: '2026-03-18',
    date_fin: '2026-03-25',
    lieu: 'Laval, secteur Sainte-Rose',
    statut: 'actif',
    type_incident: 'Inondation',
  },
]

export const DEMO_DISPONIBILITES = [
  {
    id: 'demo-dispo-1',
    monday_item_id: 'demo-mi-1',
    benevole_id: 'DEMO-001',
    deploiement_id: 'demo-dep-1',
    nom_deploiement: 'Inondations printanières - Gatineau',
    nom_sinistre: 'Inondations printanières 2026',
    date_debut: '2026-03-16',
    date_fin: '2026-03-19',
    statut: 'Disponible',
    statut_version: 'Active',
    transport: 'autonome',
    commentaire: 'Disponible jour et nuit',
    envoye_le: '2026-03-10',
    repondu_le: '2026-03-10',
    user_id: 'demo_user',
  },
]
