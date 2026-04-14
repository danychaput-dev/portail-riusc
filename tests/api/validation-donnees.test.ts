import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase (hoisted pour eviter ReferenceError) ────────────────────

const { mockFrom, mockSelect, mockIn, mockRange } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockIn: vi.fn(),
  mockRange: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
    },
  })),
}))

// Import apres les mocks
import { validerDonnees, genererRapportHtml } from '@/app/api/admin/validation-donnees/route'

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupMockReservistes(reservistes: Record<string, unknown>[]) {
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ in: mockIn })
  mockIn.mockReturnValue({ range: mockRange })
  mockRange.mockResolvedValue({ data: reservistes, error: null })
}

const baseReserviste = {
  benevole_id: 'b-001',
  prenom: 'Jean',
  nom: 'Tremblay',
  email: 'jean@test.com',
  telephone: '514-555-0001',
  date_naissance: '1990-01-01',
  adresse: '123 Rue Test',
  ville: 'Montreal',
  region: 'Montreal',
  groupe: 'Approuvé',
  statut: 'Actif',
  contact_urgence_nom: 'Marie Tremblay',
  contact_urgence_telephone: '514-555-0002',
}

// ─── Tests: Doublons par email ─────────────────────────────────────────────

describe('Validation donnees - Doublons email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detecte les doublons par email', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', email: 'doublon@test.com' },
      { ...baseReserviste, benevole_id: 'b-002', prenom: 'Pierre', email: 'doublon@test.com' },
      { ...baseReserviste, benevole_id: 'b-003', email: 'unique@test.com' },
    ])

    const result = await validerDonnees()
    expect(result.doublons_email).toHaveLength(1)
    expect(result.doublons_email[0].cle).toBe('doublon@test.com')
    expect(result.doublons_email[0].items).toHaveLength(2)
  })

  it('ignore la casse pour les emails', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', email: 'Jean@Test.com' },
      { ...baseReserviste, benevole_id: 'b-002', prenom: 'Pierre', email: 'jean@test.com' },
    ])

    const result = await validerDonnees()
    expect(result.doublons_email).toHaveLength(1)
  })

  it('ignore les reservistes sans email', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', email: '' },
      { ...baseReserviste, benevole_id: 'b-002', prenom: 'Pierre', email: '' },
    ])

    const result = await validerDonnees()
    expect(result.doublons_email).toHaveLength(0)
  })

  it('retourne zero doublon quand tout est unique', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', email: 'a@test.com' },
      { ...baseReserviste, benevole_id: 'b-002', email: 'b@test.com' },
      { ...baseReserviste, benevole_id: 'b-003', email: 'c@test.com' },
    ])

    const result = await validerDonnees()
    expect(result.doublons_email).toHaveLength(0)
  })
})

// ─── Tests: Doublons par nom ───────────────────────────────────────────────

describe('Validation donnees - Doublons nom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detecte les doublons par nom quand meme ville', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', email: 'a@test.com', ville: 'Quebec' },
      { ...baseReserviste, benevole_id: 'b-002', email: 'b@test.com', ville: 'Quebec' },
    ])

    const result = await validerDonnees()
    expect(result.doublons_nom).toHaveLength(1)
    expect(result.doublons_nom[0].cle).toBe('jean tremblay')
  })

  it('detecte les doublons par nom quand meme email', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', email: 'same@test.com', ville: 'Montreal' },
      { ...baseReserviste, benevole_id: 'b-002', email: 'same@test.com', ville: 'Quebec' },
    ])

    const result = await validerDonnees()
    expect(result.doublons_nom).toHaveLength(1)
  })

  it('ne detecte PAS de doublon si meme nom mais ville et email differents', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', email: 'a@test.com', ville: 'Montreal' },
      { ...baseReserviste, benevole_id: 'b-002', email: 'b@test.com', ville: 'Quebec' },
    ])

    const result = await validerDonnees()
    expect(result.doublons_nom).toHaveLength(0)
  })

  it('ignore la casse pour la ville', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', email: 'a@test.com', ville: 'Québec' },
      { ...baseReserviste, benevole_id: 'b-002', email: 'b@test.com', ville: 'québec' },
    ])

    const result = await validerDonnees()
    expect(result.doublons_nom).toHaveLength(1)
  })
})

// ─── Tests: Champs manquants ───────────────────────────────────────────────

describe('Validation donnees - Champs manquants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('detecte les champs manquants pour les reservistes approuves', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', telephone: '', date_naissance: '' },
    ])

    const result = await validerDonnees()
    expect(result.champs_manquants).toHaveLength(1)
    expect(result.champs_manquants[0].champs_manquants).toContain('Telephone')
    expect(result.champs_manquants[0].champs_manquants).toContain('Date de naissance')
  })

  it('ne verifie PAS les champs manquants pour le groupe Interet', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', groupe: 'Intérêt', telephone: '', adresse: '' },
    ])

    const result = await validerDonnees()
    expect(result.champs_manquants).toHaveLength(0)
  })

  it('retourne zero quand tous les champs sont remplis', async () => {
    setupMockReservistes([
      { ...baseReserviste },
    ])

    const result = await validerDonnees()
    expect(result.champs_manquants).toHaveLength(0)
  })

  it('detecte les champs avec espaces comme manquants', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', telephone: '   ' },
    ])

    const result = await validerDonnees()
    expect(result.champs_manquants).toHaveLength(1)
    expect(result.champs_manquants[0].champs_manquants).toContain('Telephone')
  })

  it('detecte contact urgence manquant', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', contact_urgence_nom: '', contact_urgence_telephone: '' },
    ])

    const result = await validerDonnees()
    expect(result.champs_manquants).toHaveLength(1)
    expect(result.champs_manquants[0].champs_manquants).toContain('Contact urgence (nom)')
    expect(result.champs_manquants[0].champs_manquants).toContain('Contact urgence (telephone)')
  })
})

// ─── Tests: Compteurs ──────────────────────────────────────────────────────

describe('Validation donnees - Compteurs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('compte correctement total et approuves', async () => {
    setupMockReservistes([
      { ...baseReserviste, benevole_id: 'b-001', groupe: 'Approuvé' },
      { ...baseReserviste, benevole_id: 'b-002', email: 'b@test.com', groupe: 'Approuvé' },
      { ...baseReserviste, benevole_id: 'b-003', email: 'c@test.com', groupe: 'Intérêt' },
    ])

    const result = await validerDonnees()
    expect(result.total_reservistes).toBe(3)
    expect(result.total_approuves).toBe(2)
  })

  it('gere une base vide', async () => {
    setupMockReservistes([])

    const result = await validerDonnees()
    expect(result.total_reservistes).toBe(0)
    expect(result.total_approuves).toBe(0)
    expect(result.doublons_email).toHaveLength(0)
    expect(result.doublons_nom).toHaveLength(0)
    expect(result.champs_manquants).toHaveLength(0)
  })
})

// ─── Tests: Rapport HTML ───────────────────────────────────────────────────

describe('Validation donnees - Rapport HTML', () => {
  it('genere un rapport positif quand aucun probleme', () => {
    const { html, subject } = genererRapportHtml({
      doublons_email: [],
      doublons_nom: [],
      champs_manquants: [],
      total_reservistes: 100,
      total_approuves: 80,
      date_validation: '2026-04-13T08:00:00.000Z',
    })

    expect(subject).toContain('Aucun probleme')
    expect(html).toContain('Aucun probleme')
    expect(html).toContain('100')
  })

  it('genere un rapport avec doublons et champs manquants', () => {
    const { html, subject } = genererRapportHtml({
      doublons_email: [{
        cle: 'doublon@test.com',
        items: [
          { benevole_id: 'b-001', prenom: 'Jean', nom: 'T', email: 'doublon@test.com', ville: 'MTL', groupe: 'Approuvé' },
          { benevole_id: 'b-002', prenom: 'Pierre', nom: 'T', email: 'doublon@test.com', ville: 'MTL', groupe: 'Approuvé' },
        ]
      }],
      doublons_nom: [],
      champs_manquants: [{
        benevole_id: 'b-003',
        prenom: 'Marie',
        nom: 'L',
        email: 'marie@test.com',
        groupe: 'Approuvé',
        champs_manquants: ['Telephone'],
      }],
      total_reservistes: 100,
      total_approuves: 80,
      date_validation: '2026-04-13T08:00:00.000Z',
    })

    expect(subject).toContain('2 probleme')
    expect(html).toContain('doublon@test.com')
    expect(html).toContain('Marie')
    expect(html).toContain('Telephone')
  })

  it('inclut le nombre de problemes dans le sujet', () => {
    const { subject } = genererRapportHtml({
      doublons_email: Array(6).fill({
        cle: 'x',
        items: [{ benevole_id: 'b', prenom: 'A', nom: 'B', email: 'x', ville: '', groupe: '' }]
      }),
      doublons_nom: [],
      champs_manquants: [],
      total_reservistes: 100,
      total_approuves: 80,
      date_validation: '2026-04-13T08:00:00.000Z',
    })

    expect(subject).toContain('6 probleme')
  })
})

// ─── Tests: Erreur Supabase ────────────────────────────────────────────────

describe('Validation donnees - Erreurs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lance une erreur si Supabase echoue', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockReturnValue({ range: mockRange })
    mockRange.mockResolvedValue({ data: null, error: { message: 'connection failed' } })

    await expect(validerDonnees()).rejects.toThrow('Erreur Supabase: connection failed')
  })
})
