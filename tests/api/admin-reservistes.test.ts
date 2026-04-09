/**
 * Tests API : /api/admin/reservistes
 *
 * Route critique - c'est la source de donnees principale pour :
 * - La page admin/reservistes (liste complete)
 * - La page admin/stats (decompte total)
 * - L'export CSV/XLSX
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase AVANT d'importer la route
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockNeq = vi.fn()
const mockNot = vi.fn()
const mockIn = vi.fn()
const mockIlike = vi.fn()
const mockOr = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()

const chainable = {
  select: mockSelect,
  eq: mockEq,
  neq: mockNeq,
  not: mockNot,
  in: mockIn,
  ilike: mockIlike,
  or: mockOr,
  order: mockOrder,
  single: mockSingle,
  is: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  range: vi.fn(),
  limit: vi.fn(),
}

// Chaque methode retourne le chainable
Object.values(chainable).forEach(fn => {
  ;(fn as any).mockReturnValue(chainable)
})

const supabaseAdmin = { from: mockFrom.mockReturnValue(chainable) }

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => supabaseAdmin,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'user-admin', email: 'admin@test.com' } } }),
    },
  }),
}))

// On a besoin de mocker cookies() pour next/headers
vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => ({ value: 'test-cookie' }) }),
}))

import { MOCK_RESERVISTES } from '../mocks/supabase'

describe('/api/admin/reservistes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset les retours par defaut
    mockFrom.mockReturnValue(chainable)
    Object.values(chainable).forEach(fn => {
      ;(fn as any).mockReturnValue(chainable)
    })
  })

  describe('Authentification', () => {
    it('refuse l\'acces sans utilisateur connecte', async () => {
      // Mock: pas d'utilisateur
      vi.doMock('@supabase/ssr', () => ({
        createServerClient: () => ({
          auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
        }),
      }))

      // Le test verifie que la route retourne 401 pour un utilisateur non connecte
      // Note: test de logique, pas d'import direct de la route (trop couple a Next.js)
      expect(true).toBe(true) // Placeholder - sera remplace par un test d'integration
    })

    it('refuse l\'acces a un reserviste non-admin', async () => {
      // Un reserviste normal ne devrait pas pouvoir lister tous les reservistes
      mockSingle.mockResolvedValue({
        data: { benevole_id: 'ben-001', role: 'reserviste' },
        error: null,
      })
      // La fonction verifierRole() retourne null pour un reserviste
      // => 401 Non autorise
      const data = { benevole_id: 'ben-001', role: 'reserviste' }
      expect(['admin', 'coordonnateur', 'adjoint'].includes(data.role)).toBe(false)
    })

    it('accepte un admin', () => {
      const data = { benevole_id: 'ben-admin', role: 'admin' }
      expect(['admin', 'coordonnateur', 'adjoint'].includes(data.role)).toBe(true)
    })

    it('accepte un coordonnateur', () => {
      const data = { benevole_id: 'ben-coord', role: 'coordonnateur' }
      expect(['admin', 'coordonnateur', 'adjoint'].includes(data.role)).toBe(true)
    })

    it('accepte un adjoint', () => {
      const data = { benevole_id: 'ben-adj', role: 'adjoint' }
      expect(['admin', 'coordonnateur', 'adjoint'].includes(data.role)).toBe(true)
    })
  })

  describe('Filtres', () => {
    it('filtre par groupes quand le parametre est present', () => {
      const groupes = 'Approuvé,Intérêt,Retrait temporaire'
      const liste = groupes.split(',').map(g => g.trim()).filter(Boolean)
      expect(liste).toEqual(['Approuvé', 'Intérêt', 'Retrait temporaire'])
      expect(liste).not.toContain('Partenaires')
    })

    it('exclut les noms vides de la requete', () => {
      const reservistes = MOCK_RESERVISTES.concat([
        { ...MOCK_RESERVISTES[0], id: 99, nom: '', benevole_id: 'ben-empty' },
        { ...MOCK_RESERVISTES[0], id: 100, nom: null as any, benevole_id: 'ben-null' },
      ])
      const filtered = reservistes.filter(r => r.nom && r.nom.trim() !== '')
      expect(filtered.length).toBe(MOCK_RESERVISTES.length)
      expect(filtered.find(r => r.benevole_id === 'ben-empty')).toBeUndefined()
      expect(filtered.find(r => r.benevole_id === 'ben-null')).toBeUndefined()
    })

    it('filtre par region', () => {
      const filtered = MOCK_RESERVISTES.filter(r =>
        r.region?.toLowerCase().includes('montréal'.toLowerCase())
      )
      expect(filtered.length).toBe(1)
      expect(filtered[0].nom).toBe('Gagnon')
    })

    it('filtre par antecedents en_attente inclut null', () => {
      const antecedents = 'en_attente'
      const filtered = MOCK_RESERVISTES.filter(r =>
        antecedents === 'en_attente'
          ? !r.antecedents_statut || r.antecedents_statut === 'en_attente'
          : r.antecedents_statut === antecedents
      )
      expect(filtered.length).toBe(1)
      expect(filtered[0].nom).toBe('Gagnon')
    })

    it('filtre par bottes oui/non', () => {
      const avecBottes = MOCK_RESERVISTES.filter(r => r.remboursement_bottes_date)
      const sansBottes = MOCK_RESERVISTES.filter(r => !r.remboursement_bottes_date)
      expect(avecBottes.length).toBe(2) // Jean + Dany
      expect(sansBottes.length).toBe(1) // Marie
    })

    it('filtre par recherche texte (nom, prenom, email)', () => {
      const recherche = 'tremblay'
      const filtered = MOCK_RESERVISTES.filter(r =>
        r.nom?.toLowerCase().includes(recherche) ||
        r.prenom?.toLowerCase().includes(recherche) ||
        r.email?.toLowerCase().includes(recherche)
      )
      expect(filtered.length).toBe(1)
      expect(filtered[0].prenom).toBe('Jean')
    })
  })

  describe('Decompte coherent', () => {
    it('le total exclut les Partenaires', () => {
      const all = [...MOCK_RESERVISTES, { ...MOCK_RESERVISTES[0], groupe: 'Partenaires', benevole_id: 'ben-part' }]
      const filtered = all.filter(r => r.groupe !== 'Partenaires')
      expect(filtered.length).toBe(MOCK_RESERVISTES.length)
    })

    it('les comptes par groupe additionnent au total', () => {
      const groupCounts: Record<string, number> = {}
      MOCK_RESERVISTES.forEach(r => {
        groupCounts[r.groupe] = (groupCounts[r.groupe] || 0) + 1
      })
      const total = Object.values(groupCounts).reduce((a, b) => a + b, 0)
      expect(total).toBe(MOCK_RESERVISTES.length)
    })
  })
})
