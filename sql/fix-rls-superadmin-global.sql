-- =====================================================================
-- Fix global: ajouter 'superadmin' aux RLS policies qui checkent
-- reservistes.role mais oublient 'superadmin'.
--
-- Rationale: le rôle superadmin a été créé après ces policies et jamais
-- rétro-ajouté. Les users superadmin (comme Dany) se font donc refuser
-- silencieusement l'accès même en ayant plus de privilèges qu'un admin.
--
-- Patchés ici (20 policies sur 12 tables) :
--   - courriel_campagnes (2)
--   - courriel_events (1)
--   - courriel_reponses (4)
--   - courriels (3)
--   - formations_benevoles_audit (1)
--   - groupes_recherche (1)
--   - inscriptions_camps (1)
--   - inscriptions_camps_logs (2)
--   - notes_fichiers (3)
--   - notes_reservistes (2)
--   - support_chats (1)
--   - templates_courriels (1)
--
-- NON touché (faux positifs ou ciblage volontaire):
--   - Tout ce qui utilise auth.role() ou auth.jwt() (c'est le rôle JWT
--     Postgres, pas reservistes.role)
--   - inscriptions_camps "Partenaires read" (ciblage volontaire sur
--     partenaire/partenaire_lect, superadmin passe par une autre policy)
-- =====================================================================

BEGIN;

-- ─── courriel_campagnes ───────────────────────────────────────────────
DROP POLICY IF EXISTS "campagnes_admin_insert" ON public.courriel_campagnes;
CREATE POLICY "campagnes_admin_insert" ON public.courriel_campagnes
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "campagnes_admin_select" ON public.courriel_campagnes;
CREATE POLICY "campagnes_admin_select" ON public.courriel_campagnes
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

-- ─── courriel_events ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_admin_select" ON public.courriel_events;
CREATE POLICY "events_admin_select" ON public.courriel_events
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

-- ─── courriel_reponses (4 policies, dont 2 paires doublons) ──────────
DROP POLICY IF EXISTS "admin_coord_select_reponses" ON public.courriel_reponses;
CREATE POLICY "admin_coord_select_reponses" ON public.courriel_reponses
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id = auth.uid()
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "admin_coord_update_reponses" ON public.courriel_reponses;
CREATE POLICY "admin_coord_update_reponses" ON public.courriel_reponses
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id = auth.uid()
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "reponses_admin_select" ON public.courriel_reponses;
CREATE POLICY "reponses_admin_select" ON public.courriel_reponses
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "reponses_admin_update" ON public.courriel_reponses;
CREATE POLICY "reponses_admin_update" ON public.courriel_reponses
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

-- ─── courriels ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "courriels_admin_insert" ON public.courriels;
CREATE POLICY "courriels_admin_insert" ON public.courriels
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "courriels_admin_select" ON public.courriels;
CREATE POLICY "courriels_admin_select" ON public.courriels
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "courriels_admin_update" ON public.courriels;
CREATE POLICY "courriels_admin_update" ON public.courriels
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

-- ─── formations_benevoles_audit ───────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_audit" ON public.formations_benevoles_audit;
CREATE POLICY "admin_read_audit" ON public.formations_benevoles_audit
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id = auth.uid()
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

-- ─── groupes_recherche (seul role='admin' avant, pas un array) ───────
DROP POLICY IF EXISTS "Admin gère groupes_recherche" ON public.groupes_recherche;
CREATE POLICY "Admin gère groupes_recherche" ON public.groupes_recherche
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id = auth.uid()
      AND reservistes.role = ANY (ARRAY['admin'::text, 'superadmin'::text])
  ));

-- ─── inscriptions_camps ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read all inscriptions" ON public.inscriptions_camps;
CREATE POLICY "Admin can read all inscriptions" ON public.inscriptions_camps
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id = auth.uid()
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'adjoint'::text, 'superadmin'::text])
  ));

-- ─── inscriptions_camps_logs ──────────────────────────────────────────
DROP POLICY IF EXISTS "Admins peuvent insérer des logs" ON public.inscriptions_camps_logs;
CREATE POLICY "Admins peuvent insérer des logs" ON public.inscriptions_camps_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id = auth.uid()
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'adjoint'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "Admins peuvent lire les logs" ON public.inscriptions_camps_logs;
CREATE POLICY "Admins peuvent lire les logs" ON public.inscriptions_camps_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id = auth.uid()
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'adjoint'::text, 'superadmin'::text])
  ));

-- ─── notes_fichiers ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "notes_fichiers_admin_delete" ON public.notes_fichiers;
CREATE POLICY "notes_fichiers_admin_delete" ON public.notes_fichiers
  FOR DELETE TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "notes_fichiers_admin_insert" ON public.notes_fichiers;
CREATE POLICY "notes_fichiers_admin_insert" ON public.notes_fichiers
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "notes_fichiers_admin_select" ON public.notes_fichiers;
CREATE POLICY "notes_fichiers_admin_select" ON public.notes_fichiers
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

-- ─── notes_reservistes ────────────────────────────────────────────────
DROP POLICY IF EXISTS "notes_admin_insert" ON public.notes_reservistes;
CREATE POLICY "notes_admin_insert" ON public.notes_reservistes
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

DROP POLICY IF EXISTS "notes_admin_select" ON public.notes_reservistes;
CREATE POLICY "notes_admin_select" ON public.notes_reservistes
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

-- ─── support_chats ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_support_chats" ON public.support_chats;
CREATE POLICY "admin_read_support_chats" ON public.support_chats
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id = auth.uid()
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

-- ─── templates_courriels ──────────────────────────────────────────────
DROP POLICY IF EXISTS "templates_own_insert" ON public.templates_courriels;
CREATE POLICY "templates_own_insert" ON public.templates_courriels
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE reservistes.user_id::text = auth.uid()::text
      AND reservistes.role = ANY (ARRAY['admin'::text, 'coordonnateur'::text, 'superadmin'::text])
  ));

COMMIT;

-- ─── Vérification post-migration ─────────────────────────────────────
-- Devrait retourner 0 rows (plus aucune policy sans superadmin)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%reservistes.role = ANY%' OR with_check LIKE '%reservistes.role = ANY%'
       OR qual LIKE '%reservistes.role = ''admin''%' OR with_check LIKE '%reservistes.role = ''admin''%')
  AND COALESCE(qual, '') NOT LIKE '%superadmin%'
  AND COALESCE(with_check, '') NOT LIKE '%superadmin%'
ORDER BY tablename;
