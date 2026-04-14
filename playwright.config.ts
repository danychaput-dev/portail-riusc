import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'

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
  },

  projects: [
    // Setup : cree le storageState admin via magic link.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Tests publics (non authentifies).
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /auth\.setup\.ts/,
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
