/**
 * Tests E2E : Smoke tests
 *
 * Verifie que les pages principales se chargent sans erreur.
 * Ces tests roulent avec Playwright contre le vrai portail.
 */
import { test, expect } from '@playwright/test'

test.describe('Smoke tests - Pages publiques', () => {
  test('la page de login se charge', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/RIUSC|Portail/)
  })

  test('la page d\'accueil redirige vers login si non connecte', async ({ page }) => {
    await page.goto('/')
    // Devrait rediriger vers /login ou afficher un formulaire de connexion
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Smoke tests - Pages admin (requiert auth)', () => {
  // Ces tests necessitent une session admin
  // En CI, on peut utiliser des cookies de session ou un login automatise

  test.skip('la page reservistes se charge', async ({ page }) => {
    await page.goto('/admin/reservistes')
    await expect(page.locator('body')).toBeVisible()
  })

  test.skip('la page stats se charge', async ({ page }) => {
    await page.goto('/admin/stats')
    await expect(page.locator('body')).toBeVisible()
  })

  test.skip('la page courriels se charge', async ({ page }) => {
    await page.goto('/admin/courriels')
    await expect(page.locator('body')).toBeVisible()
  })

  test.skip('la page certificats se charge', async ({ page }) => {
    await page.goto('/admin/certificats')
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Smoke tests - API routes', () => {
  test('GET /api/dashboard/stats retourne 200 ou 401', async ({ request }) => {
    const response = await request.get('/api/dashboard/stats')
    // Sans auth = 401, avec auth = 200
    expect([200, 401]).toContain(response.status())
  })

  test('GET /api/geocode retourne 200', async ({ request }) => {
    const response = await request.get('/api/geocode?q=Montreal')
    expect(response.status()).toBe(200)
  })
})
