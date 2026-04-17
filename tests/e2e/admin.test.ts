/**
 * Tests E2E : pages admin (requiert auth).
 *
 * Ces tests utilisent le storageState cree par auth.setup.ts. Ils verifient
 * que chaque page admin :
 *   1. Se charge sans erreur serveur (status < 500)
 *   2. Ne redirige pas vers /login (session admin active)
 *   3. Affiche son contenu specifique (heading H1 attendu)
 *
 * L'assertion sur le H1 est la plus importante - elle detecte un crash
 * silencieux (white screen) ou un re-render avortee qui n'afficherait plus
 * le contenu attendu.
 */
import { test, expect, type Page } from '@playwright/test'

/** Navigue vers une URL admin et laisse les useEffect client tourner. */
async function gotoAdmin(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  // Laisser 1s pour que le useEffect d'auth check ait le temps de rouler
  // (supabase.auth.getUser + potentielle redirection).
  await page.waitForTimeout(1000)
  return response
}

test.describe('Pages admin authentifiees', () => {
  test('la page reservistes se charge avec le titre et la session admin', async ({ page }) => {
    const response = await gotoAdmin(page, '/admin/reservistes')
    expect(response?.status()).toBeLessThan(500)
    await expect(page).not.toHaveURL(/\/login/)
    // Contenu specifique : heading "Réservistes"
    await expect(page.getByRole('heading', { name: /réservistes/i, level: 1 }))
      .toBeVisible({ timeout: 10000 })
  })

  test('la page stats se charge avec le dashboard', async ({ page }) => {
    const response = await gotoAdmin(page, '/admin/stats')
    expect(response?.status()).toBeLessThan(500)
    await expect(page).not.toHaveURL(/\/login/)
    // Contenu specifique : heading "Statistiques du portail"
    await expect(page.getByRole('heading', { name: /statistiques du portail/i }))
      .toBeVisible({ timeout: 10000 })
  })

  test('la page courriels se charge avec le formulaire', async ({ page }) => {
    const response = await gotoAdmin(page, '/admin/courriels')
    expect(response?.status()).toBeLessThan(500)
    await expect(page).not.toHaveURL(/\/login/)
    // Contenu specifique : heading "Courriels"
    await expect(page.getByRole('heading', { name: /^courriels$/i, level: 1 }))
      .toBeVisible({ timeout: 10000 })
  })

  test('la page certificats se charge avec le titre de validation', async ({ page }) => {
    const response = await gotoAdmin(page, '/admin/certificats')
    expect(response?.status()).toBeLessThan(500)
    await expect(page).not.toHaveURL(/\/login/)
    // Contenu specifique : heading "Validation des certificats"
    await expect(page.getByRole('heading', { name: /validation des certificats/i }))
      .toBeVisible({ timeout: 10000 })
  })
})
