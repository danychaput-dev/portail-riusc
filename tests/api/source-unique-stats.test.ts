/**
 * Tests de regression : Verification que les fichiers critiques
 * contiennent les bons patterns de code.
 *
 * Ces tests lisent le code source REEL des fichiers et verifient
 * que les corrections ne sont pas perdues lors d'un refactoring.
 *
 * Si un de ces tests echoue, ca veut dire qu'une regression
 * a ete introduite dans le code.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, '../../', relativePath), 'utf-8')
}

describe('Page stats - source unique de donnees', () => {
  const statsSource = readSource('app/admin/stats/page.tsx')

  it('utilise /api/dashboard/stats pour les KPI', () => {
    expect(statsSource).toContain('/api/dashboard/stats')
  })

  it('stocke les donnees dashboard dans dashStats', () => {
    expect(statsSource).toContain('dashStats')
  })

  it('affiche dashStats.totalReservistes dans le header (pas resStats.total seul)', () => {
    // Le total doit venir de dashStats, pas de resStats.total directement
    expect(statsSource).toContain('dashStats?.totalReservistes')
  })

  it('affiche dashStats.totalApprouves dans le header', () => {
    expect(statsSource).toContain('dashStats?.totalApprouves')
  })

  it('affiche dashStats.totalInteret dans le header', () => {
    expect(statsSource).toContain('dashStats?.totalInteret')
  })
})

describe('API dashboard/stats - filtres critiques', () => {
  const dashApiSource = readSource('app/api/dashboard/stats/route.ts')

  it('filtre par statut Actif', () => {
    expect(dashApiSource).toContain("eq('statut', 'Actif')")
  })

  it('exclut les noms vides', () => {
    expect(dashApiSource).toContain("not('nom', 'is', null)")
    expect(dashApiSource).toContain("neq('nom', '')")
  })

  it('utilise COUNT exact (pas affecte par limite 1000)', () => {
    expect(dashApiSource).toContain("count: 'exact'")
  })

  it('calcule totalReservistes = approuves + interet seulement', () => {
    expect(dashApiSource).toContain('exactApprouves + exactInteret')
  })
})

describe('API admin/reservistes - filtres critiques', () => {
  const adminApiSource = readSource('app/api/admin/reservistes/route.ts')

  it('exclut les noms vides', () => {
    expect(adminApiSource).toContain("not('nom', 'is', null)")
    expect(adminApiSource).toContain("neq('nom', '')")
  })
})

describe('Health-check - verification de coherence', () => {
  const healthSource = readSource('app/api/admin/health-check/route.ts')

  it('verifie la coherence dashboard vs SQL exact', () => {
    expect(healthSource).toContain('Dashboard vs SQL exact')
  })

  it('verifie la coherence du click-through', () => {
    expect(healthSource).toContain('Dashboard click-through coherence')
  })

  it('verifie les reservistes sans nom', () => {
    expect(healthSource).toContain('Reservistes sans nom')
  })

  it('filtre par statut Actif dans tous ses checks', () => {
    // Le health-check doit utiliser le meme filtre que le dashboard
    const actifCount = (healthSource.match(/eq\('statut', 'Actif'\)/g) || []).length
    expect(actifCount).toBeGreaterThanOrEqual(3) // baseCount + dashQuery + adminQuery + clickQuery
  })
})
