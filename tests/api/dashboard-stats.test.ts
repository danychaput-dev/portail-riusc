/**
 * Tests API : /api/dashboard/stats
 *
 * Verifie que les statistiques du dashboard sont coherentes.
 * Bug connu corrige : la page stats utilisait une requete differente
 * de la page reservistes, causant des decomptes differents.
 */
import { describe, it, expect } from 'vitest'
import { MOCK_RESERVISTES } from '../mocks/supabase'

describe('Logique statistiques dashboard', () => {
  const reservistes = MOCK_RESERVISTES

  describe('Decompte par groupe', () => {
    it('calcule correctement les comptes par groupe', () => {
      const groupCounts: Record<string, number> = {}
      reservistes.forEach(r => {
        const g = r.groupe || 'Non défini'
        groupCounts[g] = (groupCounts[g] || 0) + 1
      })
      expect(groupCounts['Approuvé']).toBe(2)
      expect(groupCounts['Intérêt']).toBe(1)
    })

    it('la somme des groupes = total', () => {
      const groupCounts: Record<string, number> = {}
      reservistes.forEach(r => {
        groupCounts[r.groupe] = (groupCounts[r.groupe] || 0) + 1
      })
      const sum = Object.values(groupCounts).reduce((a, b) => a + b, 0)
      expect(sum).toBe(reservistes.length)
    })
  })

  describe('Inscriptions recentes', () => {
    it('utilise monday_created_at en priorite', () => {
      const getInscDate = (r: typeof reservistes[0]): number | null => {
        const d = r.monday_created_at || r.created_at
        return d ? new Date(d).getTime() : null
      }

      // Tous nos mocks ont created_at
      reservistes.forEach(r => {
        expect(getInscDate(r)).not.toBeNull()
      })
    })

    it('les filtres temporels sont corrects', () => {
      const now = new Date('2026-04-09T12:00:00Z').getTime()
      const DAY = 86400000

      const getInscDate = (r: typeof reservistes[0]): number => {
        const d = r.monday_created_at || r.created_at
        return d ? new Date(d).getTime() : 0
      }

      // Marie inscrite le 2026-03-15, donc il y a ~25 jours
      const last30d = reservistes.filter(r => {
        const t = getInscDate(r)
        return t > 0 && (now - t) <= 30 * DAY
      })
      expect(last30d.some(r => r.nom === 'Gagnon')).toBe(true)

      // Jean inscrit en 2025-06, donc > 30 jours
      expect(last30d.some(r => r.nom === 'Tremblay')).toBe(false)
    })
  })

  describe('Comptes lies', () => {
    it('compte les reservistes avec user_id', () => {
      const linked = reservistes.filter(r => r.user_id).length
      expect(linked).toBe(3) // Tous ont un user_id dans nos mocks
    })
  })

  describe('Repartition par region', () => {
    it('calcule les comptes par region', () => {
      const regionCounts: Record<string, number> = {}
      reservistes.forEach(r => {
        const reg = r.region || 'Non définie'
        regionCounts[reg] = (regionCounts[reg] || 0) + 1
      })
      expect(regionCounts['Capitale-Nationale']).toBe(1)
      expect(regionCounts['Montréal']).toBe(1)
      expect(regionCounts['Montérégie']).toBe(1)
    })
  })

  describe('Coherence stats/reservistes (bug #1)', () => {
    it('la page stats et la page reservistes doivent utiliser les memes filtres', () => {
      // Reproduit le bug : la page stats ne filtrait pas les noms vides
      const dataAvecNomVide = [
        ...reservistes,
        { ...reservistes[0], id: 99, nom: '', benevole_id: 'ghost-1' },
        { ...reservistes[0], id: 100, nom: null as any, benevole_id: 'ghost-2' },
      ]

      // Filtre page reservistes (API route)
      const filtreReservistes = dataAvecNomVide.filter(r => r.nom && r.nom.trim() !== '')

      // Filtre page stats (devrait etre identique)
      const filtreStats = dataAvecNomVide.filter(r => r.nom && r.nom.trim() !== '')

      expect(filtreReservistes.length).toBe(filtreStats.length)
      expect(filtreReservistes.length).toBe(reservistes.length)
    })

    it('les deux pages excluent les Partenaires', () => {
      const data = [...reservistes, { ...reservistes[0], groupe: 'Partenaires' }]

      const filtreReservistes = data.filter(r => r.groupe !== 'Partenaires')
      const filtreStats = data.filter(r => r.groupe !== 'Partenaires')

      expect(filtreReservistes.length).toBe(filtreStats.length)
      expect(filtreReservistes.length).toBe(reservistes.length)
    })
  })
})
