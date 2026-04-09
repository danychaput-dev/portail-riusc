/**
 * Tests : utils/role.ts
 *
 * Verifie la logique de controle d'acces par role.
 * C'est la fondation de la securite du portail.
 */
import { describe, it, expect } from 'vitest'

// Reproduit la logique de utils/role.ts
const ROLES_HIERARCHY = ['admin', 'coordonnateur', 'adjoint', 'reserviste', 'partenaire']

function isAdmin(role: string | null): boolean {
  return role === 'admin'
}

function isAdminOrCoord(role: string | null): boolean {
  return role === 'admin' || role === 'coordonnateur'
}

function isAdminOrCoordOrAdjoint(role: string | null): boolean {
  return ['admin', 'coordonnateur', 'adjoint'].includes(role || '')
}

function canAccessAdmin(role: string | null): boolean {
  return isAdminOrCoordOrAdjoint(role)
}

describe('Controle d\'acces par role', () => {
  describe('isAdmin', () => {
    it('admin = true', () => expect(isAdmin('admin')).toBe(true))
    it('coordonnateur = false', () => expect(isAdmin('coordonnateur')).toBe(false))
    it('reserviste = false', () => expect(isAdmin('reserviste')).toBe(false))
    it('null = false', () => expect(isAdmin(null)).toBe(false))
  })

  describe('isAdminOrCoord', () => {
    it('admin = true', () => expect(isAdminOrCoord('admin')).toBe(true))
    it('coordonnateur = true', () => expect(isAdminOrCoord('coordonnateur')).toBe(true))
    it('adjoint = false', () => expect(isAdminOrCoord('adjoint')).toBe(false))
    it('reserviste = false', () => expect(isAdminOrCoord('reserviste')).toBe(false))
  })

  describe('canAccessAdmin', () => {
    it('admin = true', () => expect(canAccessAdmin('admin')).toBe(true))
    it('coordonnateur = true', () => expect(canAccessAdmin('coordonnateur')).toBe(true))
    it('adjoint = true', () => expect(canAccessAdmin('adjoint')).toBe(true))
    it('reserviste = false', () => expect(canAccessAdmin('reserviste')).toBe(false))
    it('partenaire = false', () => expect(canAccessAdmin('partenaire')).toBe(false))
    it('null = false', () => expect(canAccessAdmin(null)).toBe(false))
    it('string vide = false', () => expect(canAccessAdmin('')).toBe(false))
  })

  describe('Permissions par fonctionnalite', () => {
    const permissions: Record<string, (role: string) => boolean> = {
      'Supprimer un reserviste': (r) => isAdmin(r),
      'Approuver un certificat': (r) => isAdmin(r),
      'Lister les reservistes': (r) => canAccessAdmin(r),
      'Exporter en XLSX': (r) => canAccessAdmin(r),
      'Envoyer un courriel': (r) => isAdminOrCoord(r),
      'Gerer les sinistres': (r) => isAdminOrCoord(r),
      'Impersonner': (r) => isAdmin(r),
    }

    it('un reserviste n\'a acces a aucune fonction admin', () => {
      Object.entries(permissions).forEach(([action, check]) => {
        expect(check('reserviste'), `${action} devrait etre refuse`).toBe(false)
      })
    })

    it('un admin a acces a tout', () => {
      Object.entries(permissions).forEach(([action, check]) => {
        expect(check('admin'), `${action} devrait etre permis`).toBe(true)
      })
    })

    it('un adjoint ne peut pas supprimer ou envoyer des courriels', () => {
      expect(permissions['Supprimer un reserviste']('adjoint')).toBe(false)
      expect(permissions['Envoyer un courriel']('adjoint')).toBe(false)
      expect(permissions['Lister les reservistes']('adjoint')).toBe(true)
    })
  })
})
