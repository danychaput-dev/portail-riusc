import { vi } from 'vitest'

// Helper pour creer un mock de query Supabase chainable
export function createMockQuery(resolveData: any = null, resolveError: any = null) {
  const query: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: resolveData, error: resolveError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveData, error: resolveError }),
  }

  // Si pas de .single() appele, la query elle-meme resolve les donnees
  query.then = (resolve: any) => resolve({ data: resolveData, error: resolveError })

  return query
}

// Reservistes fictifs pour les tests
export const MOCK_RESERVISTES = [
  {
    id: 1,
    benevole_id: 'ben-001',
    prenom: 'Jean',
    nom: 'Tremblay',
    email: 'jean.tremblay@test.com',
    telephone: '418-555-0001',
    groupe: 'Approuvé',
    region: 'Capitale-Nationale',
    statut: 'Actif',
    user_id: 'user-001',
    role: 'reserviste',
    created_at: '2025-06-01T00:00:00Z',
    monday_created_at: null,
    antecedents_statut: 'verifie',
    remboursement_bottes_date: '2025-08-01',
  },
  {
    id: 2,
    benevole_id: 'ben-002',
    prenom: 'Marie',
    nom: 'Gagnon',
    email: 'marie.gagnon@test.com',
    telephone: '514-555-0002',
    groupe: 'Intérêt',
    region: 'Montréal',
    statut: 'Actif',
    user_id: 'user-002',
    role: 'reserviste',
    created_at: '2026-03-15T00:00:00Z',
    monday_created_at: null,
    antecedents_statut: 'en_attente',
    remboursement_bottes_date: null,
  },
  {
    id: 3,
    benevole_id: 'ben-admin',
    prenom: 'Dany',
    nom: 'Chaput',
    email: 'chaputdany@gmail.com',
    telephone: '514-555-0003',
    groupe: 'Approuvé',
    region: 'Montérégie',
    statut: 'Actif',
    user_id: 'user-admin',
    role: 'admin',
    created_at: '2024-01-01T00:00:00Z',
    monday_created_at: null,
    antecedents_statut: 'verifie',
    remboursement_bottes_date: '2024-06-01',
  },
]

export const MOCK_FORMATIONS = [
  {
    id: 'form-001',
    benevole_id: 'ben-001',
    nom_formation: "S'initier à la sécurité civile",
    resultat: 'Réussi',
    etat_validite: 'À jour',
    date_reussite: '2025-07-01',
    date_expiration: null,
    certificat_url: 'storage:certificats/ben-001/initiation.pdf',
    source: 'admin_review',
    initiation_sc_completee: true,
    certificat_requis: true,
  },
  {
    id: 'form-002',
    benevole_id: 'ben-002',
    nom_formation: "S'initier à la sécurité civile",
    resultat: 'En attente',
    etat_validite: null,
    date_reussite: null,
    date_expiration: null,
    certificat_url: 'storage:certificats/ben-002/initiation.pdf',
    source: 'upload',
    initiation_sc_completee: false,
    certificat_requis: true,
  },
]

export const MOCK_SINISTRE = {
  id: 'sin-001',
  nom: 'Inondation Beauce 2026',
  type_incident: 'Inondation',
  lieu: 'Saint-Georges',
  date_debut: '2026-04-01',
  statut: 'actif',
}
