-- ============================================================
-- SYSTÈME DE POINTAGE QR — Tables et RLS
-- Portail RIUSC — Avril 2026
-- ============================================================

-- 1. Table pointage_sessions
-- Représente un QR code généré (lié à un camp + shift optionnel + date optionnelle)
-- Le token unique est encodé dans l'URL du QR code

CREATE TABLE IF NOT EXISTS pointage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien au camp (session_id de inscriptions_camps)
  session_id TEXT NOT NULL,

  -- Métadonnées dénormalisées du camp (même pattern que inscriptions_camps)
  camp_nom TEXT NOT NULL,
  camp_dates TEXT,
  camp_lieu TEXT,

  -- Granularité du QR
  shift TEXT CHECK (shift IN ('jour', 'nuit', 'complet')),  -- NULL = pas de shift
  date_shift DATE,  -- NULL = valide pour tout le camp

  -- Token unique pour l'URL du QR (ex: /pointage/abc123)
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),

  -- Contrôle
  actif BOOLEAN DEFAULT true,  -- Désactiver un QR sans le supprimer
  cree_par UUID REFERENCES reservistes(benevole_id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Contrainte unicité : un seul QR actif par camp/shift/date
  UNIQUE(session_id, shift, date_shift)
);

-- Index pour lookup rapide par token (c'est le chemin critique du scan)
CREATE INDEX IF NOT EXISTS idx_pointage_sessions_token ON pointage_sessions(token);
CREATE INDEX IF NOT EXISTS idx_pointage_sessions_session_id ON pointage_sessions(session_id);


-- 2. Table pointages
-- Chaque enregistrement = un punch d'un réserviste dans une session

CREATE TABLE IF NOT EXISTS pointages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  benevole_id UUID NOT NULL REFERENCES reservistes(benevole_id),
  pointage_session_id UUID NOT NULL REFERENCES pointage_sessions(id) ON DELETE CASCADE,

  -- Heures
  heure_arrivee TIMESTAMPTZ,
  heure_depart TIMESTAMPTZ,
  duree_minutes NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN heure_arrivee IS NOT NULL AND heure_depart IS NOT NULL
      THEN EXTRACT(EPOCH FROM (heure_depart - heure_arrivee)) / 60
      ELSE NULL
    END
  ) STORED,

  -- Statut du pointage
  statut TEXT NOT NULL DEFAULT 'en_cours' CHECK (
    statut IN ('en_cours', 'complete', 'approuve', 'conteste')
  ),

  -- Source : scan QR ou correction manuelle
  source TEXT NOT NULL DEFAULT 'qr_scan' CHECK (
    source IN ('qr_scan', 'manuel')
  ),

  -- Approbation
  approuve_par UUID REFERENCES reservistes(benevole_id),
  approuve_at TIMESTAMPTZ,

  -- Notes (corrections, contestations, etc.)
  notes TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Un réserviste ne peut avoir qu'un seul pointage actif par session
  UNIQUE(benevole_id, pointage_session_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_pointages_benevole ON pointages(benevole_id);
CREATE INDEX IF NOT EXISTS idx_pointages_session ON pointages(pointage_session_id);
CREATE INDEX IF NOT EXISTS idx_pointages_statut ON pointages(statut);
CREATE INDEX IF NOT EXISTS idx_pointages_arrivee ON pointages(heure_arrivee);


-- 3. Table pointage_logs (audit trail)
-- Historique des modifications (corrections manuelles, approbations)

CREATE TABLE IF NOT EXISTS pointage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  pointage_id UUID NOT NULL REFERENCES pointages(id) ON DELETE CASCADE,
  benevole_id UUID NOT NULL,

  -- Ce qui a changé
  action TEXT NOT NULL CHECK (
    action IN ('arrivee', 'depart', 'correction_arrivee', 'correction_depart', 'approuve', 'conteste', 'annule', 'creation_manuelle')
  ),

  -- Valeurs avant/après pour les corrections
  valeur_avant TEXT,
  valeur_apres TEXT,

  -- Qui a fait le changement
  modifie_par UUID REFERENCES reservistes(benevole_id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pointage_logs_pointage ON pointage_logs(pointage_id);


-- ============================================================
-- RLS POLICIES
-- Principe :
--   - anon peut lire les pointage_sessions (pour le scan QR sans auth)
--   - anon peut insérer/modifier des pointages (punch in/out sans auth)
--   - admin/coordo peut tout faire
--   - réserviste peut voir ses propres pointages
-- ============================================================

-- Activer RLS sur les 3 tables
ALTER TABLE pointage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pointages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pointage_logs ENABLE ROW LEVEL SECURITY;

-- ---- pointage_sessions ----

-- Lecture publique (le scan QR doit pouvoir lire la session via token)
CREATE POLICY "pointage_sessions_select_public"
  ON pointage_sessions FOR SELECT
  USING (true);

-- Écriture admin/coordo seulement
CREATE POLICY "pointage_sessions_insert_admin"
  ON pointage_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'coordonnateur')
    )
  );

CREATE POLICY "pointage_sessions_update_admin"
  ON pointage_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'coordonnateur')
    )
  );

-- Service role peut tout faire (pour les API routes)
CREATE POLICY "pointage_sessions_service_role"
  ON pointage_sessions FOR ALL
  USING (auth.role() = 'service_role');


-- ---- pointages ----

-- Les API routes utilisent service_role pour les punch (pas d'auth utilisateur)
CREATE POLICY "pointages_service_role"
  ON pointages FOR ALL
  USING (auth.role() = 'service_role');

-- Un réserviste connecté peut voir ses propres pointages
CREATE POLICY "pointages_select_own"
  ON pointages FOR SELECT
  USING (
    benevole_id IN (
      SELECT benevole_id FROM reservistes WHERE user_id = auth.uid()
    )
  );

-- Admin/coordo peut tout voir et modifier
CREATE POLICY "pointages_admin_all"
  ON pointages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'coordonnateur')
    )
  );


-- ---- pointage_logs ----

-- Service role pour les écritures via API
CREATE POLICY "pointage_logs_service_role"
  ON pointage_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Admin/coordo peut lire les logs
CREATE POLICY "pointage_logs_select_admin"
  ON pointage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'coordonnateur')
    )
  );


-- ============================================================
-- TRIGGER : updated_at automatique sur pointages
-- ============================================================

CREATE OR REPLACE FUNCTION update_pointages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pointages_updated_at
  BEFORE UPDATE ON pointages
  FOR EACH ROW
  EXECUTE FUNCTION update_pointages_updated_at();


-- ============================================================
-- VUE : résumé des pointages par session (pour le dashboard admin)
-- ============================================================

CREATE OR REPLACE VIEW pointages_resume AS
SELECT
  ps.id AS pointage_session_id,
  ps.session_id,
  ps.camp_nom,
  ps.camp_lieu,
  ps.shift,
  ps.date_shift,
  ps.actif,
  COUNT(p.id) AS total_pointages,
  COUNT(CASE WHEN p.statut = 'en_cours' THEN 1 END) AS nb_en_cours,
  COUNT(CASE WHEN p.statut = 'complete' THEN 1 END) AS nb_complets,
  COUNT(CASE WHEN p.statut = 'approuve' THEN 1 END) AS nb_approuves,
  COUNT(CASE WHEN p.statut = 'conteste' THEN 1 END) AS nb_contestes,
  ROUND(AVG(p.duree_minutes)::numeric, 0) AS duree_moyenne_minutes
FROM pointage_sessions ps
LEFT JOIN pointages p ON p.pointage_session_id = ps.id
GROUP BY ps.id, ps.session_id, ps.camp_nom, ps.camp_lieu, ps.shift, ps.date_shift, ps.actif;
