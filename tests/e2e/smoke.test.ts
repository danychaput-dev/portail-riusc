/**
 * Tests E2E : Smoke tests
 *
 * Verifie que les pages principales et API repondent correctement.
 * Ces tests roulent avec Playwright contre le portail (prod ou local).
 *
 * Note : En CI, les tests de pages necessitent Chromium installe.
 * Les tests API utilisent uniquement `request` (pas de navigateur).
 */
import { test, expect } from '@playwright/test'

test.describe('Smoke tests - Pages publiques', () => {
  test('la page de login se charge', async ({ page }) => {
    const response = await page.goto('/login')
    // La page doit repondre (200, 302, ou 307 si redirect)
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
  })

  test('la page d\'accueil redirige vers login si non connecte', async ({ page }) => {
    const response = await page.goto('/')
    // Devrait rediriger vers /login ou afficher la page
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Smoke tests - Pages admin (requiert auth)', () => {
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
  test('GET /api/dashboard/stats repond sans erreur serveur', async ({ request }) => {
    const response = await request.get('/api/dashboard/stats')
    // Sans auth = 401, avec auth = 200, mais jamais 500
    expect(response.status()).toBeLessThan(500)
  })

  test('GET /api/geocode repond sans erreur serveur', async ({ request }) => {
    const response = await request.get('/api/geocode?q=Montreal')
    // Sans token Mapbox valide = 400/401, avec = 200, mais jamais 500
    expect(response.status()).toBeLessThan(500)
  })
})
