import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Charger .env.local pour que auth.setup.ts voie SUPABASE_SERVICE_ROLE_KEY, etc.
dotenv.config({ path: path.resolve(__dirname, '.env.local') })
dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30000,

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // En CI contre prod, Cloudflare bloque Playwright (Bot Fight Mode) sans
    // ce header. Une regle WAF "E2E Tests Bypass" cote Cloudflare reconnait
    // ce token et skip Bot Fight + managed rules pour les requetes du test.
    // Le token est inoffensif pour les requetes locales (localhost sans WAF).
    extraHTTPHeaders: process.env.E2E_BYPASS_TOKEN
      ? { 'x-e2e-bypass': process.env.E2E_BYPASS_TOKEN }
      : undefined,
  },

  projects: [
    // Setup : cree le storageState admin via magic link.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Tests publics (non authentifies). Ignore aussi admin.test.ts car il
    // requiert le storageState - seul le projet chromium-admin doit le faire.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/auth\.setup\.ts/, /admin\.test\.ts/],
    },
    // Tests authentifies (admin). Depend de 'setup'.
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'tests/e2e/.auth/admin.json'),
      },
      dependencies: ['setup'],
      testMatch: /admin\.test\.ts/,
    },
  ],

  // Lancer le serveur Next.js en dev pour les tests locaux
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60000,
      },
})
