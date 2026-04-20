-- ────────────────────────────────────────────────────────────────────────────
-- sql/groupes-recherche-responsables.sql
--
-- Ajoute la notion de « responsable(s) d'un groupe de recherche et sauvetage ».
--
-- Objectif fonctionnel :
--   - Plusieurs responsables peuvent être désignés pour un même groupe R&S
--     (ex: 2 responsables pour « Recherche Sauvetage Estrie »).
--   - Une personne peut être responsable de plusieurs groupes.
--   - Ces responsables accèderont plus tard à une page dédiée (liste des
--     déploiements où leurs membres sont sollicités) et seront mis en CC des
--     courriels envoyés à leurs membres.
--
-- Ce script est idempotent : peut être relancé sans erreur.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Table de liaison many-to-many groupe ↔ responsable
CREATE TABLE IF NOT EXISTS groupes_recherche_responsables (
  groupe_id UUID NOT NULL REFERENCES groupes_recherche(id) ON DELETE CASCADE,
  benevole_id TEXT NOT NULL REFERENCES reservistes(benevole_id) ON DELETE CASCADE,
  recoit_cc_courriels BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (groupe_id, benevole_id)
);

COMMENT ON TABLE groupes_recherche_responsables IS
  'Lien N-N : quels réservistes sont responsables de quels groupes R&S. recoit_cc_courriels permet de désactiver le CC auto pour un responsable spécifique.';

CREATE INDEX IF NOT EXISTS idx_grr_benevole
  ON groupes_recherche_responsables(benevole_id);

CREATE INDEX IF NOT EXISTS idx_grr_groupe
  ON groupes_recherche_responsables(groupe_id);

-- 2. RLS : admins gèrent tout, un responsable voit au moins ses propres liaisons
ALTER TABLE groupes_recherche_responsables ENABLE ROW LEVEL SECURITY;

-- Drop des policies existantes pour idempotence
DROP POLICY IF EXISTS "Admins gerent les responsables de groupe"
  ON groupes_recherche_responsables;
DROP POLICY IF EXISTS "Responsable voit ses propres liaisons"
  ON groupes_recherche_responsables;

-- Admins (superadmin/admin/coordonnateur) peuvent tout faire
CREATE POLICY "Admins gerent les responsables de groupe"
  ON groupes_recherche_responsables FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM reservistes
    WHERE user_id = auth.uid()
      AND role IN ('superadmin','admin','coordonnateur')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM reservistes
    WHERE user_id = auth.uid()
      AND role IN ('superadmin','admin','coordonnateur')
  ));

-- Un réserviste voit les lignes où il est responsable (pour sa page dédiée)
CREATE POLICY "Responsable voit ses propres liaisons"
  ON groupes_recherche_responsables FOR SELECT TO authenticated
  USING (benevole_id = (
    SELECT benevole_id FROM reservistes WHERE user_id = auth.uid() LIMIT 1
  ));

-- 3. Vue pratique pour les requêtes courantes : responsable + groupe + district
CREATE OR REPLACE VIEW v_responsables_groupes_detail AS
SELECT
  r.benevole_id,
  r.prenom,
  r.nom,
  r.email,
  r.telephone,
  r.role,
  g.id           AS groupe_id,
  g.nom          AS groupe_nom,
  g.district     AS groupe_district,
  g.actif        AS groupe_actif,
  grr.recoit_cc_courriels,
  grr.created_at AS designe_le
FROM groupes_recherche_responsables grr
JOIN groupes_recherche g  ON g.id = grr.groupe_id
JOIN reservistes r        ON r.benevole_id = grr.benevole_id;

COMMENT ON VIEW v_responsables_groupes_detail IS
  'Vue aplatie : chaque ligne = un (responsable, groupe) avec les infos utiles pour UI admin et listing CC.';
