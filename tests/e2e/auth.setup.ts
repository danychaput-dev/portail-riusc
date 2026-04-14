/**
 * Tests E2E : setup d'authentification.
 *
 * Se connecte en tant qu'admin via magic link genere cote admin API
 * (service_role) et sauvegarde la session dans un storageState reutilise
 * par les tests authentifies.
 *
 * Variables d'env requises (dans .env.local ou CI) :
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - E2E_ADMIN_EMAIL  (ex: dany.chaput@aqbrs.ca)
 *   - E2E_BASE_URL     (ex: http://localhost:3000 en dev, ou prod)
 *
 * Le storageState est ecrit dans tests/e2e/.auth/admin.json
 * (ignore par git, voir .gitignore).
 */
import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

const adminFile = path.join(__dirname, '.auth/admin.json')

setup('authenticate admin', async ({ page }) => {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ADMIN_EMAIL  = process.env.E2E_ADMIN_EMAIL

  if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_EMAIL) {
    throw new Error(
      'Variables E2E manquantes : NEXT_PUBLIC_SUPABASE_URL, ' +
      'SUPABASE_SERVICE_ROLE_KEY, E2E_ADMIN_EMAIL doivent etre definies.'
    )
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Generer un magic link qui, une fois visite, cree une session.
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: ADMIN_EMAIL,
  })

  if (error || !data?.properties?.action_link) {
    throw new Error(`generateLink a echoue : ${error?.message || 'pas d\'action_link'}`)
  }

  // Visiter le lien pour que Supabase pose le cookie de session sur le domaine.
  await page.goto(data.properties.action_link)

  // Attendre la redirection vers l'app et s'assurer qu'on est connecte.
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15000 })
  await expect(page.locator('body')).toBeVisible()

  // Sauvegarder le state pour les tests authentifies.
  await page.context().storageState({ path: adminFile })
})
