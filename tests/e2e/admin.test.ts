/**
 * Tests E2E : pages admin (requiert auth).
 *
 * Ces tests utilisent le storageState cree par auth.setup.ts (voir
 * playwright.config.ts -> project chromium-admin). Ils ne tournent
 * que si E2E_ADMIN_EMAIL est defini.
 */
import { test, expect } from '@playwright/test'

test.describe('Pages admin authentifiees', () => {
  test('la page reservistes se charge', async ({ page }) => {
    const response = await page.goto('/admin/reservistes')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
    // On doit voir le contenu admin, pas une redirection vers login
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('la page stats se charge', async ({ page }) => {
    const response = await page.goto('/admin/stats')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('la page courriels se charge', async ({ page }) => {
    const response = await page.goto('/admin/courriels')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('la page certificats se charge', async ({ page }) => {
    const response = await page.goto('/admin/certificats')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/)
  })
})
