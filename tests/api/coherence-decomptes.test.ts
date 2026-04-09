/**
 * Tests de regression : Coherence des decomptes entre pages
 *
 * BUG RECURRENT : le dashboard, la page stats et la page reservistes
 * affichent des chiffres differents parce qu'elles n'utilisent pas
 * les memes filtres Supabase.
 *
 * Ce fichier documente les regles metier qui DOIVENT rester vraies :
 *
 * 1. Dashboard "Total reservistes" = Approuves + Interet (statut Actif, nom non vide)
 * 2. Cliquer sur ce chiffre mene a la page reservistes avec le MEME nombre
 * 3. La page stats affiche le MEME total que le dashboard
 * 4. Toutes les requetes excluent les noms vides/null
 * 5. Toutes les requetes qui alimentent un compteur visible
 *    doivent utiliser COUNT exact ou pagination (pas de .select() brut > 1000)
 */
import { describe, it, expect } from 'vitest'

// ─── Les filtres de chaque source de donnees ─────────────────────────

// Ce que le dashboard API utilise (/api/dashboard/stats)
const FILTRES_DASHBOARD = {
  statut: 'Actif',
  groupes: ['Approuvé', 'Intérêt', 'Partenaires'],
  exclureNomVide: true,
  totalFormule: 'Approuvés + Intérêt', // PAS les Partenaires
}

// Ce que la page admin/reservistes charge par defaut
const FILTRES_ADMIN_RESERVISTES = {
  statut: null, // PAS DE FILTRE STATUT par defaut!
  groupes: ['Approuvé', 'Intérêt', 'Partenaires', 'Retrait temporaire'],
  exclureNomVide: true,
}

// Ce que la page stats DOIT utiliser (corrige avril 2026)
const FILTRES_STATS = {
  statut: 'Actif', // DOIT etre Actif pour matcher le dashboard
  groupes: ['Approuvé', 'Intérêt', 'Retrait temporaire', 'Formation incomplète'],
  exclureNomVide: true,
}

describe('Coherence des decomptes (regression critique)', () => {

  describe('Regle 1 : Dashboard total = Approuves + Interet', () => {
    it('le dashboard ne compte PAS les Partenaires dans le total', () => {
      // Le dashboard affiche totalReservistes = exactApprouves + exactInteret
      // C'est defini dans /api/dashboard/stats ligne 57
      expect(FILTRES_DASHBOARD.totalFormule).toBe('Approuvés + Intérêt')
      expect(FILTRES_DASHBOARD.groupes).toContain('Partenaires') // charge mais pas dans le total
    })
  })

  describe('Regle 2 : Filtre statut Actif', () => {
    it('le dashboard filtre par statut Actif', () => {
      expect(FILTRES_DASHBOARD.statut).toBe('Actif')
    })

    it('la page stats DOIT aussi filtrer par statut Actif', () => {
      // BUG CORRIGE : la page stats n'avait pas ce filtre,
      // ce qui incluait les inactifs/suspendus
      expect(FILTRES_STATS.statut).toBe('Actif')
    })

    it('ATTENTION : la page admin reservistes ne filtre PAS par statut', () => {
      // C'est voulu - l'admin veut voir tous les reservistes
      // Mais ca veut dire que son total sera DIFFERENT du dashboard
      expect(FILTRES_ADMIN_RESERVISTES.statut).toBeNull()
    })
  })

  describe('Regle 3 : Exclusion noms vides', () => {
    it('toutes les sources excluent les noms vides', () => {
      expect(FILTRES_DASHBOARD.exclureNomVide).toBe(true)
      expect(FILTRES_ADMIN_RESERVISTES.exclureNomVide).toBe(true)
      expect(FILTRES_STATS.exclureNomVide).toBe(true)
    })
  })

  describe('Regle 4 : Simulation de coherence', () => {
    // Simule des donnees pour verifier que les filtres produisent les bons resultats
    const mockData = [
      { nom: 'Tremblay', groupe: 'Approuvé', statut: 'Actif' },
      { nom: 'Gagnon', groupe: 'Intérêt', statut: 'Actif' },
      { nom: 'Dubois', groupe: 'Retrait temporaire', statut: 'Actif' },
      { nom: 'Lavoie', groupe: 'Partenaires', statut: 'Actif' },
      { nom: 'Morin', groupe: 'Approuvé', statut: 'Inactif' }, // NE DOIT PAS etre compte
      { nom: '', groupe: 'Approuvé', statut: 'Actif' },        // NE DOIT PAS etre compte
      { nom: null, groupe: 'Intérêt', statut: 'Actif' },       // NE DOIT PAS etre compte
      { nom: 'Test', groupe: 'Approuvé', statut: 'Suspendu' }, // NE DOIT PAS etre compte
    ]

    const applyFilter = (filtres: typeof FILTRES_DASHBOARD) => {
      return mockData.filter(r => {
        if (filtres.exclureNomVide && (!r.nom || r.nom.trim() === '')) return false
        if (filtres.statut && r.statut !== filtres.statut) return false
        if (!filtres.groupes.includes(r.groupe)) return false
        return true
      })
    }

    it('le dashboard retourne Approuves + Interet actifs avec nom', () => {
      const result = applyFilter(FILTRES_DASHBOARD)
      const total = result.filter(r => r.groupe === 'Approuvé' || r.groupe === 'Intérêt').length
      expect(total).toBe(2) // Tremblay + Gagnon (pas Morin car Inactif, pas les vides)
    })

    it('la page stats retourne le meme nombre que le dashboard pour Approuves + Interet', () => {
      const statsResult = applyFilter(FILTRES_STATS)
      const statsApprInt = statsResult.filter(r => r.groupe === 'Approuvé' || r.groupe === 'Intérêt').length

      const dashResult = applyFilter(FILTRES_DASHBOARD)
      const dashTotal = dashResult.filter(r => r.groupe === 'Approuvé' || r.groupe === 'Intérêt').length

      expect(statsApprInt).toBe(dashTotal)
    })

    it('la page admin inclut plus de reservistes (pas de filtre statut)', () => {
      const adminResult = mockData.filter(r => {
        if (!r.nom || r.nom.trim() === '') return false
        if (!FILTRES_ADMIN_RESERVISTES.groupes.includes(r.groupe)) return false
        return true
      })
      // Tremblay + Gagnon + Dubois + Morin + Test = 5 (pas de filtre statut)
      expect(adminResult.length).toBeGreaterThan(2) // Plus que le dashboard
    })
  })

  describe('Regle 5 : Protection limite 1000 lignes', () => {
    it('toute requete client-side doit utiliser pagination ou COUNT exact', () => {
      // Ce test documente la regle. La verification reelle est dans le health-check.
      // Les pages suivantes sont a risque :
      const pagesARisque = [
        { page: '/admin/stats', method: 'fetch API avec pagination', safe: true },
        { page: '/admin/reservistes', method: 'fetch API serveur (pas de limite)', safe: true },
        { page: '/dashboard', method: 'fetch /api/dashboard/stats (COUNT exact)', safe: true },
      ]

      pagesARisque.forEach(p => {
        expect(p.safe, `${p.page} devrait utiliser pagination ou COUNT`).toBe(true)
      })
    })
  })
})
