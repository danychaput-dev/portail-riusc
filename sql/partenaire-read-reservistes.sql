-- =====================================================================
-- Policy RLS: permettre au role 'partenaire' de lire la table reservistes
-- =====================================================================
--
-- Contexte (13 avril 2026):
-- La page /admin/inscriptions-camps affiche pour les partenaires (role
-- 'partenaire', pas 'partenaire_lect') les details complets d'une
-- inscription: nom, courriel, telephone (depuis inscriptions_camps) plus
-- region, groupe, bottes, allergies, conditions (depuis reservistes).
--
-- IMPORTANT: la premiere version utilisait une sous-requete directe dans
-- le USING de la policy, ce qui a cause une recursion infinie (policy
-- sur reservistes qui fait SELECT FROM reservistes => retrigger la policy
-- => 500 Internal Server Error sur toutes les requetes reservistes).
--
-- Solution: fonction SECURITY DEFINER is_partenaire() qui contourne RLS
-- pour verifier le role, meme pattern que is_admin_or_coord() deja en
-- place.
-- =====================================================================

-- Nettoyer l'ancienne policy recursive si elle existe
DROP POLICY IF EXISTS "Partenaires read reservistes" ON reservistes;

-- Fonction helper SECURITY DEFINER pour casser la recursion RLS
CREATE OR REPLACE FUNCTION public.is_partenaire()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM reservistes
    WHERE user_id = auth.uid() AND role = 'partenaire'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_partenaire() TO authenticated;

-- Policy: lecture complete reservistes pour le role 'partenaire' seulement.
-- 'partenaire_lect' reste sans acces (principe de minimisation loi 25).
CREATE POLICY "Partenaires read reservistes"
  ON reservistes
  FOR SELECT
  TO authenticated
  USING (is_partenaire());

-- Verification post-deploiement:
-- SELECT policyname, cmd, roles FROM pg_policies
-- WHERE tablename = 'reservistes' ORDER BY policyname;
