/**
 * Tests E2E : setup d'authentification.
 *
 * Strategie : on contourne l'UI de login (flow OTP a 2 etapes) et on genere
 * une session Supabase directement en Node.js, puis on injecte les cookies
 * dans le contexte Playwright. Les cookies sont formates par la meme librairie
 * (@supabase/ssr) que l'app utilise, donc 100% compatibles.
 *
 * Flow :
 *   1. supabaseAdmin.auth.admin.generateLink() -> retourne un email_otp sans
 *      envoyer de courriel (service_role = privilegie).
 *   2. createServerClient(@supabase/ssr) avec un cookie jar local.
 *   3. supabase.auth.verifyOtp() redeem l'OTP -> remplit le cookie jar avec
 *      les cookies de session dans le format exact de @supabase/ssr.
 *   4. On injecte ces cookies dans le contexte Playwright.
 *   5. On sauvegarde le storageState pour les tests dependants.
 *
 * Variables d'env requises (dans .env.local ou CI) :
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - E2E_ADMIN_EMAIL   (ex: dany.chaput@aqbrs.ca)
 *   - E2E_BASE_URL      (defaut: http://localhost:3000)
 *
 * Le storageState est ecrit dans tests/e2e/.auth/admin.json
 * (ignore par git, voir .gitignore).
 */
import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import * as path from 'path'

const adminFile = path.join(__dirname, '.auth/admin.json')

type CookieEntry = { name: string; value: string; options?: CookieOptions }

setup('authenticate admin', async ({ page }) => {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ADMIN_EMAIL  = process.env.E2E_ADMIN_EMAIL
  const E2E_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !ADMIN_EMAIL) {
    throw new Error(
      'Variables E2E manquantes : NEXT_PUBLIC_SUPABASE_URL, ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ' +
      'E2E_ADMIN_EMAIL doivent etre definies.'
    )
  }

  // Etape 1 : admin genere un OTP pour l'email (aucun courriel envoye).
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: ADMIN_EMAIL,
    })
  if (linkErr || !linkData?.properties?.email_otp) {
    throw new Error(
      `generateLink a echoue : ${linkErr?.message || 'pas de email_otp dans la reponse'}`
    )
  }
  const emailOtp = linkData.properties.email_otp

  // Etape 2 : cookie jar local qui capture les Set-Cookie de @supabase/ssr.
  const cookieJar: CookieEntry[] = []
  const setCookie = (name: string, value: string, options?: CookieOptions) => {
    const idx = cookieJar.findIndex(c => c.name === name)
    if (idx >= 0) cookieJar[idx] = { name, value, options }
    else cookieJar.push({ name, value, options })
  }
  const removeCookie = (name: string) => {
    const idx = cookieJar.findIndex(c => c.name === name)
    if (idx >= 0) cookieJar.splice(idx, 1)
  }

  // Etape 3 : client Supabase SSR avec le cookie jar (meme lib que l'app).
  const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return cookieJar.map(c => ({ name: c.name, value: c.value }))
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          if (value === '') removeCookie(name)
          else setCookie(name, value, options)
        }
      },
    },
  })

  // Etape 4 : redeem l'OTP -> remplit le cookie jar.
  const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
    email: ADMIN_EMAIL,
    token: emailOtp,
    type: 'email',
  })
  if (otpErr || !otpData?.session) {
    throw new Error(
      `verifyOtp a echoue : ${otpErr?.message || 'pas de session'}. ` +
      `Verifie que E2E_ADMIN_EMAIL (${ADMIN_EMAIL}) existe dans auth.users.`
    )
  }

  if (cookieJar.length === 0) {
    throw new Error(
      'Aucun cookie produit par @supabase/ssr apres verifyOtp. ' +
      'Incompatibilite possible avec la version de @supabase/ssr utilisee.'
    )
  }

  // Etape 5 : injecter les cookies dans le contexte Playwright.
  // IMPORTANT : forcer httpOnly=false car @supabase/ssr's createBrowserClient
  // lit les cookies via document.cookie qui ne voit pas les httpOnly cookies.
  // Dans le flow normal (user + UI), les cookies sont poses par le browser JS
  // donc jamais httpOnly. On reproduit ce comportement ici.
  const host = new URL(E2E_BASE_URL).hostname
  const isHttps = E2E_BASE_URL.startsWith('https://')
  await page.context().addCookies(
    cookieJar.map(c => ({
      name: c.name,
      value: c.value,
      domain: host,
      path: c.options?.path ?? '/',
      httpOnly: false,
      secure: isHttps,
      sameSite: 'Lax' as 'Strict' | 'Lax' | 'None',
    }))
  )

  // Etape 6 : sauvegarder IMMEDIATEMENT le storageState, sans visite de page
  // intermediaire. Une visite de page declencherait un auto-refresh du token
  // Supabase (les access_token expirent vite), ce qui peut invalider le
  // refresh_token rotatif avant que storageState ne capture l'etat final.
  await page.context().storageState({ path: adminFile })
})
