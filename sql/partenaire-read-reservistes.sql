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
-- RLS actuel sur reservistes:
--  - admin/coord/adjoint/superadmin peuvent tout lire (is_admin_or_coord)
--  - chaque utilisateur peut lire son propre enregistrement
--  - aucune policy pour 'partenaire'
--
-- Resultat: le partenaire voyait juste prenom_nom/courriel/telephone
-- venant de inscriptions_camps, mais les colonnes complementaires
-- (region, allergies, bottes, conditions_medicales) restaient vides.
--
-- Cette policy ajoute la lecture complete pour 'partenaire' SEULEMENT.
-- 'partenaire_lect' reste sans acces (principe de minimisation loi 25).
--
-- Impact: export Excel complet pour les partenaires, affichage de toutes
-- les colonnes (district, bottes, allergies, conditions medicales) sur
-- la page des inscriptions camps.
-- =====================================================================

CREATE POLICY "Partenaires read reservistes"
  ON reservistes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reservistes r
      WHERE r.user_id = auth.uid()
        AND r.role = 'partenaire'
    )
  );

-- Verification post-deploiement:
-- SELECT policyname, cmd, roles FROM pg_policies
-- WHERE tablename = 'reservistes' ORDER BY policyname;
