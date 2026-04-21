-- =============================================================================
-- Éligibilité au crédit d'impôt QC pour bénévoles R&S et pompiers volontaires
-- =============================================================================
-- Le crédit d'impôt ne s'applique qu'à certaines catégories (Recherche & Sauvetage,
-- pompiers volontaires). Les réservistes RIUSC génériques ne sont pas éligibles.
--
-- On gère ça au niveau de l'ORGANISATION (pas du bénévole) — un bénévole est
-- éligible s'il est membre d'au moins une organisation flaggée eligible_credit_impot.
--
-- Les orgas éligibles connues à date :
--   - AQBRS (Recherche et Sauvetage)
--   - Pompiers volontaires (à créer)
-- =============================================================================

-- 1. Ajouter le flag sur organisations
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS eligible_credit_impot BOOLEAN NOT NULL DEFAULT false;

-- 2. Marquer AQBRS comme éligible
UPDATE organisations
  SET eligible_credit_impot = true
  WHERE id = 'bb948f22-a29e-42db-bdd9-aabab8a95abd';

-- 3. Créer Pompiers volontaires et la marquer éligible (idempotent)
INSERT INTO organisations (nom, eligible_credit_impot)
  VALUES ('Pompiers volontaires', true)
  ON CONFLICT (nom) DO UPDATE SET eligible_credit_impot = EXCLUDED.eligible_credit_impot;

-- 4. Recréer la vue heures_benevoles_par_benevole avec filtre d'éligibilité
-- (remplace la définition de sql/trajets.sql)
DROP VIEW IF EXISTS heures_benevoles_par_benevole;

CREATE OR REPLACE VIEW heures_benevoles_par_benevole AS
WITH primaires AS (
  SELECT p.benevole_id,
         COALESCE(SUM(p.duree_minutes) FILTER (WHERE p.statut = 'approuve'), 0) AS minutes_primaires_approuve,
         COALESCE(SUM(p.duree_minutes) FILTER (WHERE p.statut IN ('complete', 'approuve')), 0) AS minutes_primaires_total
  FROM pointages p
  WHERE p.duree_minutes IS NOT NULL
  GROUP BY p.benevole_id
),
secondaires AS (
  SELECT t.benevole_id,
         COALESCE(SUM(t.duree_minutes) FILTER (WHERE t.statut = 'approuve'), 0) AS minutes_secondaires_approuve,
         COALESCE(SUM(t.duree_minutes) FILTER (WHERE t.statut IN ('complete', 'approuve')), 0) AS minutes_secondaires_total
  FROM trajets t
  WHERE t.duree_minutes IS NOT NULL
  GROUP BY t.benevole_id
),
eligibles AS (
  SELECT DISTINCT ro.benevole_id
  FROM reserviste_organisations ro
  JOIN organisations o ON o.id = ro.organisation_id
  WHERE o.eligible_credit_impot = true
)
SELECT r.benevole_id,
       r.prenom, r.nom,
       (e.benevole_id IS NOT NULL) AS eligible_credit_impot,
       COALESCE(p.minutes_primaires_approuve, 0)   AS minutes_primaires_approuve,
       COALESCE(p.minutes_primaires_total, 0)      AS minutes_primaires_total,
       COALESCE(s.minutes_secondaires_approuve, 0) AS minutes_secondaires_approuve,
       COALESCE(s.minutes_secondaires_total, 0)    AS minutes_secondaires_total,
       ROUND(COALESCE(p.minutes_primaires_approuve, 0) / 60.0, 2)   AS heures_primaires_approuve,
       ROUND(COALESCE(p.minutes_primaires_total, 0) / 60.0, 2)      AS heures_primaires_total,
       ROUND(COALESCE(s.minutes_secondaires_approuve, 0) / 60.0, 2) AS heures_secondaires_approuve,
       ROUND(COALESCE(s.minutes_secondaires_total, 0) / 60.0, 2)    AS heures_secondaires_total,
       -- Qualifié = éligible ET plancher 101h primaires ET total ≥ 200h
       (e.benevole_id IS NOT NULL
         AND COALESCE(p.minutes_primaires_approuve, 0) >= 101 * 60
         AND (COALESCE(p.minutes_primaires_approuve, 0) + COALESCE(s.minutes_secondaires_approuve, 0)) >= 200 * 60
       ) AS qualifie_credit_impot
FROM reservistes r
LEFT JOIN primaires   p ON p.benevole_id = r.benevole_id
LEFT JOIN secondaires s ON s.benevole_id = r.benevole_id
LEFT JOIN eligibles   e ON e.benevole_id = r.benevole_id;
