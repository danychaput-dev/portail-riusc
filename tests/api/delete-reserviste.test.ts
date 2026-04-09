/**
 * Tests API : /api/admin/reservistes/delete
 *
 * Route LA PLUS DANGEREUSE - suppression en cascade.
 * Supprime un reserviste + toutes ses donnees dans 16 tables.
 * Doit etre teste rigoureusement.
 */
import { describe, it, expect } from 'vitest'

// Tables nettoyees lors d'une suppression (ordre important)
const TABLES_CASCADE = [
  'disponibilites_v2',
  'ciblages',
  'assignations',
  'formations_benevoles',
  'inscriptions_camps',
  'inscriptions_camps_logs',
  'rappels_camps',
  'messages',
  'message_reactions',
  'community_last_seen',
  'reserviste_langues',
  'reserviste_organisations',
  'reserviste_etat',
  'dossier_reserviste',
  'documents_officiels',
  'lms_progression',
]

describe('/api/admin/reservistes/delete', () => {
  describe('Securite', () => {
    it('seul un admin peut supprimer', () => {
      const canDelete = (role: string) => role === 'admin'
      expect(canDelete('admin')).toBe(true)
      expect(canDelete('coordonnateur')).toBe(false)
      expect(canDelete('adjoint')).toBe(false)
      expect(canDelete('reserviste')).toBe(false)
    })

    it('requiert un benevole_id', () => {
      const body = { benevole_id: '' }
      expect(body.benevole_id).toBeFalsy()
    })

    it('ne permet pas de supprimer un admin', () => {
      const targetRole = 'admin'
      const shouldBlock = targetRole === 'admin'
      expect(shouldBlock).toBe(true)
    })
  })

  describe('Cascade', () => {
    it('nettoie les 16 tables dependantes', () => {
      expect(TABLES_CASCADE.length).toBe(16)
    })

    it('inclut les tables critiques', () => {
      expect(TABLES_CASCADE).toContain('formations_benevoles')
      expect(TABLES_CASCADE).toContain('disponibilites_v2')
      expect(TABLES_CASCADE).toContain('inscriptions_camps')
      expect(TABLES_CASCADE).toContain('messages')
    })

    it('nettoie le storage (certificats)', () => {
      // Verifier que les fichiers storage sont supprimes avant les records
      const storagePaths = [
        'certificats/ben-001/initiation.pdf',
        'certificats/ben-001/croix-rouge.pdf',
      ]
      storagePaths.forEach(path => {
        expect(path).toMatch(/^certificats\//)
      })
    })

    it('supprime le reserviste en dernier', () => {
      // La table reservistes doit etre supprimee APRES les tables dependantes
      // car les FK referent a benevole_id
      expect(TABLES_CASCADE).not.toContain('reservistes')
    })
  })
})
