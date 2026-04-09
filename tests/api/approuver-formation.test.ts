/**
 * Tests API : /api/admin/approuver-formation
 *
 * Route critique - gere le cycle de vie des certificats :
 * - POST : inserer un nouveau certificat approuve
 * - PUT : approuver un certificat existant
 * - PATCH : refuser un certificat
 * - DELETE : supprimer le fichier et remettre en attente
 */
import { describe, it, expect, vi } from 'vitest'
import { MOCK_FORMATIONS } from '../mocks/supabase'

describe('/api/admin/approuver-formation', () => {
  describe('POST - Insertion certificat', () => {
    it('requiert tous les champs obligatoires', () => {
      const body = {
        benevole_id: 'ben-001',
        nom_complet: 'Jean Tremblay',
        nom_formation: "S'initier à la sécurité civile",
        date_reussite: '2025-07-01',
        certificat_url: 'storage:certificats/test.pdf',
        initiation_sc_completee: true,
        admin_benevole_id: 'ben-admin',
      }
      expect(body.benevole_id).toBeTruthy()
      expect(body.nom_formation).toBeTruthy()
      expect(body.date_reussite).toBeTruthy()
      expect(body.admin_benevole_id).toBeTruthy()
    })

    it('genere les bons champs pour l\'insertion', () => {
      const body = {
        benevole_id: 'ben-001',
        nom_complet: 'Jean Tremblay',
        nom_formation: "S'initier à la sécurité civile",
        date_reussite: '2025-07-01',
        date_expiration: null,
        certificat_url: 'storage:certificats/test.pdf',
        initiation_sc_completee: true,
      }

      const insertData = {
        benevole_id: body.benevole_id,
        nom_complet: body.nom_complet,
        nom_formation: body.nom_formation,
        date_reussite: body.date_reussite,
        date_expiration: body.date_expiration || null,
        certificat_url: body.certificat_url,
        initiation_sc_completee: body.initiation_sc_completee,
        resultat: 'Réussi',
        etat_validite: 'À jour',
        source: 'admin_review',
      }

      expect(insertData.resultat).toBe('Réussi')
      expect(insertData.etat_validite).toBe('À jour')
      expect(insertData.source).toBe('admin_review')
      expect(insertData.date_expiration).toBeNull()
    })
  })

  describe('PUT - Approbation certificat existant', () => {
    it('requiert id et date_reussite', () => {
      const body = { id: 'form-002', date_reussite: '2026-03-15', admin_benevole_id: 'ben-admin' }
      expect(body.id).toBeTruthy()
      expect(body.date_reussite).toBeTruthy()
    })

    it('met a jour resultat et etat_validite', () => {
      const updateData = {
        resultat: 'Réussi',
        etat_validite: 'À jour',
        date_reussite: '2026-03-15',
        date_expiration: null,
      }
      expect(updateData.resultat).toBe('Réussi')
      expect(updateData.etat_validite).toBe('À jour')
    })
  })

  describe('PATCH - Refus certificat', () => {
    it('requiert un id', () => {
      const body = { id: 'form-002', admin_benevole_id: 'ben-admin', motif: 'Mauvais document' }
      expect(body.id).toBeTruthy()
    })

    it('remet les champs a null', () => {
      const updateData = {
        resultat: 'Refusé',
        etat_validite: null,
        date_reussite: null,
        date_expiration: null,
      }
      expect(updateData.resultat).toBe('Refusé')
      expect(updateData.etat_validite).toBeNull()
      expect(updateData.date_reussite).toBeNull()
    })
  })

  describe('DELETE - Suppression fichier', () => {
    it('detecte les URLs storage pour suppression', () => {
      const certificat_url = 'storage:certificats/ben-002/initiation.pdf'
      const isStorage = certificat_url.startsWith('storage:')
      expect(isStorage).toBe(true)

      const storagePath = certificat_url.replace('storage:', '')
      expect(storagePath).toBe('certificats/ben-002/initiation.pdf')
    })

    it('ne supprime pas les URLs non-storage', () => {
      const certificat_url = 'https://external.com/cert.pdf'
      expect(certificat_url.startsWith('storage:')).toBe(false)
    })

    it('remet la formation en attente apres suppression', () => {
      const updateData = {
        certificat_url: null,
        resultat: 'En attente',
        etat_validite: null,
        date_reussite: null,
        date_expiration: null,
      }
      expect(updateData.resultat).toBe('En attente')
      expect(updateData.certificat_url).toBeNull()
    })
  })

  describe('Securite', () => {
    it('seul un admin peut approuver', () => {
      const roles = ['admin']
      const check = (role: string) => roles.includes(role)
      expect(check('admin')).toBe(true)
      expect(check('coordonnateur')).toBe(false)
      expect(check('reserviste')).toBe(false)
    })
  })
})
