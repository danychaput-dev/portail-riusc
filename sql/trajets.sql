-- =============================================================================
-- TABLE trajets — heures de déplacement bénévolat (crédit d'impôt Québec)
-- =============================================================================
-- Contexte : les heures de travail bénévole comptent pour le crédit d'impôt QC.
--   Heures PRIMAIRES   = temps sur place (issu de `pointages` via QR)
--   Heures SECONDAIRES = temps de déplacement aller/retour (issu de cette table)
--
-- Un trajet est rattaché soit à un `deployment_id`, soit à un `camp_session_id`
-- (XOR — l'un ou l'autre mais pas les deux).
--
-- Heure fin nullable tant que le bénévole n'a pas clôturé le trajet.
-- =============================================================================

CREATE TABLE IF NOT EXISTS trajets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qui
  benevole_id TEXT NOT NULL REFERENCES reservistes(benevole_id) ON DELETE CASCADE,

  -- Pourquoi (XOR : soit déploiement, soit camp)
  deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,
  camp_session_id TEXT,  -- ex: 'CAMP_CHICOUTIMI_AVR26'

  CHECK (
    (deployment_id IS NOT NULL AND camp_session_id IS NULL) OR
    (deployment_id IS NULL AND camp_session_id IS NOT NULL)
  ),

  -- Type de trajet
  type TEXT NOT NULL CHECK (type IN ('aller', 'retour')),

  -- Timestamps
  heure_debut TIMESTAMPTZ NOT NULL DEFAULT now(),
  heure_fin   TIMESTAMPTZ,

  -- Durée calculée automatiquement (en minutes)
  duree_minutes NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN heure_fin IS NOT NULL
      THEN EXTRACT(EPOCH FROM (heure_fin - heure_debut)) / 60
      ELSE NULL
    END
  ) STORED,

  -- Covoiturage
  covoiturage BOOLEAN NOT NULL DEFAULT false,
  covoiturage_role TEXT CHECK (covoiturage_role IN ('conducteur', 'passager')),
  covoiturage_with TEXT,  -- noms libres séparés par virgule

  -- Libre
  notes TEXT,

  -- Workflow d'approbation
  statut TEXT NOT NULL DEFAULT 'en_cours' CHECK (
    statut IN ('en_cours', 'complete', 'approuve', 'conteste', 'annule')
  ),
  approuve_par TEXT REFERENCES reservistes(benevole_id),
  approuve_at  TIMESTAMPTZ,

  -- Traçabilité
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trajets_benevole ON trajets(benevole_id);
CREATE INDEX IF NOT EXISTS idx_trajets_deployment ON trajets(deployment_id) WHERE deployment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trajets_camp ON trajets(camp_session_id) WHERE camp_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trajets_statut ON trajets(statut);
CREATE INDEX IF NOT EXISTS idx_trajets_ouvert ON trajets(benevole_id, heure_fin) WHERE heure_fin IS NULL;

-- updated_at auto
CREATE OR REPLACE FUNCTION trajets_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_trajets_updated_at ON trajets;
CREATE TRIGGER trig_trajets_updated_at BEFORE UPDATE ON trajets
  FOR EACH ROW EXECUTE FUNCTION trajets_touch_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE trajets ENABLE ROW LEVEL SECURITY;

-- Un réserviste peut lire ses propres trajets
DROP POLICY IF EXISTS trajets_select_own ON trajets;
CREATE POLICY trajets_select_own ON trajets FOR SELECT TO authenticated
  USING (
    benevole_id = (SELECT benevole_id FROM reservistes WHERE user_id = auth.uid())
  );

-- Un réserviste peut créer ses propres trajets
DROP POLICY IF EXISTS trajets_insert_own ON trajets;
CREATE POLICY trajets_insert_own ON trajets FOR INSERT TO authenticated
  WITH CHECK (
    benevole_id = (SELECT benevole_id FROM reservistes WHERE user_id = auth.uid())
  );

-- Un réserviste peut modifier ses trajets EN COURS ou COMPLETE (pas approuvés)
DROP POLICY IF EXISTS trajets_update_own ON trajets;
CREATE POLICY trajets_update_own ON trajets FOR UPDATE TO authenticated
  USING (
    benevole_id = (SELECT benevole_id FROM reservistes WHERE user_id = auth.uid())
    AND statut IN ('en_cours', 'complete')
  );

-- Admin / coordonnateur : tout lire / tout écrire
DROP POLICY IF EXISTS trajets_admin_all ON trajets;
CREATE POLICY trajets_admin_all ON trajets FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reservistes r
      WHERE r.user_id = auth.uid()
        AND r.role IN ('superadmin', 'admin', 'coordonnateur', 'adjoint')
    )
  );

-- =============================================================================
-- VUE : heures cumulées par bénévole (pour rapport fiscal)
-- =============================================================================
-- NOTE : la définition canonique de cette vue est dans sql/eligibilite-credit-impot.sql
-- qui ajoute le filtre d'éligibilité (R&S / pompiers). Si tu relances ce fichier,
-- relance aussi eligibilite-credit-impot.sql après.

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
)
SELECT r.benevole_id,
       r.prenom, r.nom,
       COALESCE(p.minutes_primaires_approuve, 0)   AS minutes_primaires_approuve,
       COALESCE(p.minutes_primaires_total, 0)      AS minutes_primaires_total,
       COALESCE(s.minutes_secondaires_approuve, 0) AS minutes_secondaires_approuve,
       COALESCE(s.minutes_secondaires_total, 0)    AS minutes_secondaires_total,
       ROUND(COALESCE(p.minutes_primaires_approuve, 0) / 60.0, 2)   AS heures_primaires_approuve,
       ROUND(COALESCE(p.minutes_primaires_total, 0) / 60.0, 2)      AS heures_primaires_total,
       ROUND(COALESCE(s.minutes_secondaires_approuve, 0) / 60.0, 2) AS heures_secondaires_approuve,
       ROUND(COALESCE(s.minutes_secondaires_total, 0) / 60.0, 2)    AS heures_secondaires_total,
       -- Crédit d'impôt QC : plancher 101h primaires + total ≥ 200h
       -- ⚠️ Cette version NE VÉRIFIE PAS l'éligibilité par organisation.
       -- Relance sql/eligibilite-credit-impot.sql pour la version complète.
       (COALESCE(p.minutes_primaires_approuve, 0) >= 101 * 60
         AND (COALESCE(p.minutes_primaires_approuve, 0) + COALESCE(s.minutes_secondaires_approuve, 0)) >= 200 * 60
       ) AS qualifie_credit_impot
FROM reservistes r
LEFT JOIN primaires p ON p.benevole_id = r.benevole_id
LEFT JOIN secondaires s ON s.benevole_id = r.benevole_id;

-- =============================================================================
-- Activer l'audit log (trigger existant `audit_capture`)
-- =============================================================================
-- Si audit_attach_table existe dans ce projet, on branche trajets dessus :
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_attach_table') THEN
    PERFORM audit_attach_table('trajets', 'id');
  END IF;
END $$;
