-- =============================================================
-- Fix Supabase Security Advisor: 2 erreurs + 2 warnings
-- Exécuter dans Supabase SQL Editor
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- ERREUR 1 & 2 : inscriptions_camps_logs
-- RLS Disabled + Sensitive Columns Exposed
-- ─────────────────────────────────────────────────────────────

-- Activer RLS
ALTER TABLE public.inscriptions_camps_logs ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : seuls les admins/coordonnateurs/adjoints peuvent lire les logs
-- (via l'app admin, le client anon n'a pas besoin de SELECT sur cette table,
--  mais on le permet pour les utilisateurs authentifiés qui sont admin)
CREATE POLICY "Admins peuvent lire les logs"
  ON public.inscriptions_camps_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('admin', 'coordonnateur', 'adjoint')
    )
  );

-- Politique INSERT : seuls les admins/coordonnateurs peuvent insérer des logs
CREATE POLICY "Admins peuvent insérer des logs"
  ON public.inscriptions_camps_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('admin', 'coordonnateur', 'adjoint')
    )
  );

-- Pas de UPDATE ni DELETE — les logs d'audit ne doivent jamais être modifiés


-- ─────────────────────────────────────────────────────────────
-- WARNING 1 & 2 : rappels_camps
-- RLS Policy Always True (USING (true) / WITH CHECK (true))
-- ─────────────────────────────────────────────────────────────

-- D'abord, supprimer les politiques trop permissives existantes
-- (ajuster les noms si différents — vérifier avec :
--   SELECT policyname FROM pg_policies WHERE tablename = 'rappels_camps';
-- )
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'rappels_camps'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.rappels_camps', pol.policyname);
  END LOOP;
END $$;

-- Politique SELECT : admins seulement
CREATE POLICY "Admins peuvent lire les rappels"
  ON public.rappels_camps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('admin', 'coordonnateur', 'adjoint')
    )
  );

-- Politique INSERT : admins seulement (envoi de rappels SMS)
CREATE POLICY "Admins peuvent créer des rappels"
  ON public.rappels_camps
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('admin', 'coordonnateur')
    )
  );

-- Politique UPDATE : admins + service_role (le webhook Twilio utilise service_role)
CREATE POLICY "Admins peuvent modifier les rappels"
  ON public.rappels_camps
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('admin', 'coordonnateur')
    )
  );

-- Note : le webhook Twilio (/api/webhooks/twilio-reponse) utilise supabaseAdmin
-- (service_role key) qui bypass RLS, donc pas besoin de politique pour le webhook.
