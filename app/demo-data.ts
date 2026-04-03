import type {
  Reserviste, DeploiementActif, CampStatus, CertificatFile, SelectionStatus,
} from '@/types'

// ─── Données démo pour le dashboard réserviste ──────────────────────────────

export const DEMO_RESERVISTE_INTERET: Reserviste = {
  benevole_id: 'DEMO-001',
  prenom: 'Marie-Ève',
  nom: 'Tremblay',
  email: 'marie-eve.tremblay@example.com',
  telephone: '4185551234',
  groupe: 'Intérêt',
}

export const DEMO_RESERVISTE_APPROUVE: Reserviste = {
  ...DEMO_RESERVISTE_INTERET,
  groupe: 'Approuvé',
}

export const DEMO_DEPLOIEMENTS: DeploiementActif[] = [
  {
    id: 'demo-dep-1',
    deploiement_id: 'demo-dep-1',
    nom_deploiement: 'Inondations printanières - Gatineau',
    nom_sinistre: 'Inondations printanières 2026',
    organisme: 'Ville de Gatineau',
    date_debut: '2026-03-15',
    date_fin: null,
    lieu: 'Gatineau, secteur Hull',
    statut: 'actif',
    type_incident: 'Inondation',
  },
]

export const DEMO_CAMP_STATUS: CampStatus = {
  is_certified: false,
  has_inscription: false,
  session_id: null,
  camp: null,
  lien_inscription: null,
}

export const DEMO_CAMP_STATUS_INSCRIT: CampStatus = {
  is_certified: true,
  has_inscription: false,
  session_id: null,
  camp: null,
  lien_inscription: null,
}

export const DEMO_CERTIFICATS: CertificatFile[] = [
  {
    id: 'demo-cert-1',
    name: 'Certificat_Sinitier_Tremblay_Marie-Eve.pdf',
    url: '#',
  },
]

export const DEMO_SELECTION_APPROUVE: SelectionStatus = {
  statut: null,
  deploiement: null,
}

export const DEMO_SESSIONS = [
  { session_id: 'demo-s1', nom: 'Cohorte 8 - Camp de qualification', dates: '12-13 avril 2026', site: 'Centre de formation de Nicolet', location: 'Nicolet, Québec' },
  { session_id: 'demo-s2', nom: 'Cohorte 9 - Camp de qualification', dates: '24-25 mai 2026', site: 'Base de plein air de Val-Cartier', location: 'Shannon, Québec' },
]

export const DEMO_SESSION_CAPACITIES = {
  'demo-s1': { inscrits: 18, capacite: 25, attente: 0, attente_max: 5, places_restantes: 7, statut: 'ouvert' },
  'demo-s2': { inscrits: 24, capacite: 25, attente: 2, attente_max: 5, places_restantes: 1, statut: 'ouvert' },
}
