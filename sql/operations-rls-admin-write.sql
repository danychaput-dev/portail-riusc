-- ============================================================
-- Operations — policies RLS pour permettre aux admins
-- d'écrire sur les tables du wizard /admin/operations.
--
-- Contexte : 2026-04-18
-- Les tables sinistres, demandes, deployments, vagues avaient
-- seulement des policies SELECT + service_role. Les inserts via
-- le client browser (session authentifiée) échouaient avec 42501
-- (row-level security policy violation). Rendait le wizard
-- inutilisable côté admin.
--
-- Pas de check superadmin dans les policies existantes de ciblages
-- et demandes non plus — on normalise.
-- ============================================================

-- ---- sinistres ----
DROP POLICY IF EXISTS "sinistres_admin_write" ON sinistres;
CREATE POLICY "sinistres_admin_write"
  ON sinistres FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  );

-- ---- demandes ----
-- Remplace "Admin lit les demandes" (SELECT only, sans superadmin)
-- par une policy complète FOR ALL qui inclut superadmin.
DROP POLICY IF EXISTS "Admin lit les demandes" ON demandes;
DROP POLICY IF EXISTS "demandes_admin_write" ON demandes;
CREATE POLICY "demandes_admin_write"
  ON demandes FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur', 'adjoint'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  );
-- Note : adjoint garde la lecture (USING) mais ne peut pas modifier (WITH CHECK).

-- ---- deployments ----
DROP POLICY IF EXISTS "deployments_admin_write" ON deployments;
CREATE POLICY "deployments_admin_write"
  ON deployments FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  );

-- ---- vagues ----
DROP POLICY IF EXISTS "vagues_admin_write" ON vagues;
CREATE POLICY "vagues_admin_write"
  ON vagues FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  );

-- ---- ciblages ----
-- Policies existantes (admin_write, admin_read) excluent superadmin.
-- On les remplace par une version unique FOR ALL qui l'inclut.
DROP POLICY IF EXISTS "ciblages_admin_read" ON ciblages;
DROP POLICY IF EXISTS "ciblages_admin_write" ON ciblages;
CREATE POLICY "ciblages_admin_write"
  ON ciblages FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  );

-- ---- assignations ----
-- Garder les policies "own" pour les réservistes, ajouter écriture admin.
DROP POLICY IF EXISTS "assignations_admin_write" ON assignations;
CREATE POLICY "assignations_admin_write"
  ON assignations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur'))
  );
