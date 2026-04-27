/**
 * Tests E2E : setup d'authentification admin.
 *
 * Strategie : on fait le vrai flow UI (le meme qu'un vrai user) pour garantir
 * que les cookies sont ecrits par le browser client Supabase dans le format
 * exact que l'app utilise.
 *
 * Flow :
 *   1. Naviguer vers /login
 *   2. Remplir l'email E2E_ADMIN_EMAIL, cliquer "Recevoir un code de connexion"
 *   3. Attendre que le formulaire OTP apparaisse
 *   4. Generer un nouvel OTP via l'admin API (invalide le precedent envoye par
 *      l'app, et nous evite de devoir lire un courriel)
 *   5. Remplir le code OTP, cliquer "Valider le code"
 *   6. Attendre la redirection vers une page non-/login
 *   7. Sauvegarder le storageState pour les tests admin dependants
 *
 * Prerequis :
 *   - Un user Supabase existe pour E2E_ADMIN_EMAIL (email confirme)
 *   - Une entree dans la table reservistes avec role='admin' (ou superadmin)
 *     liee a ce user.id
 *   - Le user n'a pas de telephone (sinon l'app essaie SMS en premier)
 *
 * Variables d'env :
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - E2E_ADMIN_EMAIL
 *   - E2E_BASE_URL (defaut: http://localhost:3000)
 */
import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

const adminFile = path.join(__dirname, '.auth/admin.json')

setup('authenticate admin', async ({ page }) => {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ADMIN_EMAIL  = process.env.E2E_ADMIN_EMAIL
  const E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'

  if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_EMAIL) {
    throw new Error(
      'Variables E2E manquantes : NEXT_PUBLIC_SUPABASE_URL, ' +
      'SUPABASE_SERVICE_ROLE_KEY, E2E_ADMIN_EMAIL doivent etre definies.'
    )
  }

  // Client admin pour generer un OTP valide (sans envoi de courriel).
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Capture des logs console pour diagnostic en cas d'echec.
  const consoleLogs: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', err => {
    consoleLogs.push(`[pageerror] ${err.message}`)
  })

  // Etape 1 : navigate vers /login et attendre que l'app React soit hydratee
  // (en CI contre prod, Cloudflare peut servir un challenge avant la vraie page,
  // et Next.js en prod SSR peut prendre quelques secondes a hydrater)
  await page.goto(`${E2E_BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 })
  } catch {
    // networkidle peut ne pas arriver si polling, on continue
  }
  await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 20000 })

  // Etape 2 : remplir l'email et declencher signInWithOtp
  await page.fill('input[name="email"]', ADMIN_EMAIL)
  await page.getByRole('button', { name: /recevoir un code/i }).click()

  // Etape 3 : attendre le formulaire OTP (input maxLength=6).
  // Si l'app a essaye SMS en premier et qu'un fallback email existe, cliquer dessus.
  const otpInput = page.locator('input[maxLength="6"]')
  try {
    await otpInput.waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    // Peut-etre l'app a choisi SMS pour ce user - cliquer le fallback courriel
    const fallback = page.getByRole('button', { name: /recevoir par courriel/i })
    if (await fallback.isVisible().catch(() => false)) {
      await fallback.click()
      await otpInput.waitFor({ state: 'visible', timeout: 15000 })
    } else {
      // Tenter de lire un message d'erreur visible pour diagnostic (rate limit, etc)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      const errorHint = bodyText.match(/Erreur[^\n]{0,200}/)?.[0]
        || bodyText.match(/Vérification en cours/)?.[0]
        || bodyText.slice(0, 300)
      throw new Error(
        `Formulaire OTP non affiche apres clic "Recevoir un code". ` +
        `Etat page : ${errorHint}. ` +
        `Console (${consoleLogs.length}) : ${consoleLogs.slice(-5).join(' | ')}`
      )
    }
  }

  // Etape 4 : generer un OTP frais via admin API (rend le precedent caduc)
  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: ADMIN_EMAIL,
    })
  if (linkErr || !linkData?.properties?.email_otp) {
    throw new Error(
      `generateLink a echoue : ${linkErr?.message || 'pas de email_otp'}`
    )
  }

  // Etape 5 : remplir le code et soumettre
  await otpInput.fill(linkData.properties.email_otp)
  await page.getByRole('button', { name: /valider le code/i }).click()

  // Etape 6 : attendre la redirection hors de /login (session creee)
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 })
  await expect(page.locator('body')).toBeVisible()

  // Sanity check : verifier qu'un cookie de session Supabase est bien pose.
  const cookies = await page.context().cookies()
  const hasSession = cookies.some(c => c.name.startsWith('sb-'))
  if (!hasSession) {
    throw new Error('Aucun cookie de session Supabase apres verifyOtp UI')
  }

  // Etape 7 : sauvegarder le storageState pour les tests dependants
  await page.context().storageState({ path: adminFile })
})
