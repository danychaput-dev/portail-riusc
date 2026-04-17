-- ============================================================
-- SYSTÈME DE POINTAGE QR — Tables, RLS, vues
-- Portail RIUSC — Avril 2026
--
-- Historique :
--   v1 (2026-04-08) : schéma initial camp-only avec FK en UUID — JAMAIS ROULÉ
--     (les FK UUID pointaient sur reservistes.benevole_id TEXT → échec)
--   v2 (2026-04-17) : schéma corrigé + ajouts Phase 1
--     - benevole_id TEXT partout (aligné avec reservistes.benevole_id)
--     - type_contexte pour supporter camp ET déploiement
--     - approuveur_id choisi à la création du QR
--     - camp_* renommé en contexte_* (plus générique)
--     - UNIQUE(benevole_id, pointage_session_id) retiré (rescan autorisé)
--     - Partial unique index sur pointage actif (arrivée sans départ)
--
-- Ce fichier est idempotent pour les CREATE. Si la v1 a été partiellement
-- appliquée, DROP les tables d'abord manuellement.
-- ============================================================

-- 1. Table pointage_sessions
-- Représente un QR code généré pour un camp OU un déploiement.
-- Le token unique est encodé dans l'URL du QR : https://portail.riusc.ca/punch/{token}

CREATE TABLE IF NOT EXISTS pointage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type de contexte auquel le QR se rattache
  type_contexte TEXT NOT NULL DEFAULT 'camp'
    CHECK (type_contexte IN ('camp', 'deploiement')),

  -- Référence polymorphique :
  --   si type_contexte='camp'       → inscriptions_camps.session_id (text)
  --   si type_contexte='deploiement' → deployments.id (uuid cast en text)
  session_id TEXT NOT NULL,

  -- Métadonnées dénormalisées du contexte (évite les jointures au scan)
  contexte_nom TEXT NOT NULL,    -- ex: "Camp Chicoutimi 25-26 avril" ou "Inondation Papineau"
  contexte_dates TEXT,           -- ex: "25-26 avril 2026" ou "15 mai → 30 mai"
  contexte_lieu TEXT,            -- ex: "Chicoutimi, Grand-Lac" ou "Papineauville"

  -- Granularité du QR
  shift TEXT CHECK (shift IN ('jour', 'nuit', 'complet')),  -- NULL = pas de shift
  date_shift DATE,  -- NULL = valide pour toute la durée du contexte

  -- Token unique pour l'URL (/punch/{token})
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),

  -- Approbateur désigné à la création (admin ou partenaire)
  -- Les pointages hériteront de ce défaut ; modifiable par pointage si besoin.
  approuveur_id TEXT REFERENCES reservistes(benevole_id),

  -- Contrôle
  actif BOOLEAN DEFAULT TRUE,    -- Désactiver un QR sans le supprimer
  cree_par TEXT REFERENCES reservistes(benevole_id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Un seul QR actif par (contexte, type, shift, date)
  UNIQUE(type_contexte, session_id, shift, date_shift)
);

CREATE INDEX IF NOT EXISTS idx_pointage_sessions_token
  ON pointage_sessions(token);
CREATE INDEX IF NOT EXISTS idx_pointage_sessions_session_id
  ON pointage_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_pointage_sessions_type_contexte
  ON pointage_sessions(type_contexte);


-- 2. Table pointages
-- Chaque enregistrement = un cycle arrivée/départ d'un réserviste dans une session.
-- Un même réserviste peut avoir PLUSIEURS pointages par session (rescan après départ).

CREATE TABLE IF NOT EXISTS pointages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  benevole_id TEXT NOT NULL REFERENCES reservistes(benevole_id),
  pointage_session_id UUID NOT NULL REFERENCES pointage_sessions(id) ON DELETE CASCADE,

  heure_arrivee TIMESTAMPTZ,
  heure_depart TIMESTAMPTZ,
  duree_minutes NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN heure_arrivee IS NOT NULL AND heure_depart IS NOT NULL
      THEN EXTRACT(EPOCH FROM (heure_depart - heure_arrivee)) / 60
      ELSE NULL
    END
  ) STORED,

  statut TEXT NOT NULL DEFAULT 'en_cours' CHECK (
    statut IN ('en_cours', 'complete', 'approuve', 'conteste', 'annule')
  ),

  source TEXT NOT NULL DEFAULT 'qr_scan' CHECK (
    source IN ('qr_scan', 'manuel')
  ),

  -- Approbation — hérite de pointage_sessions.approuveur_id par défaut
  approuveur_id TEXT REFERENCES reservistes(benevole_id),
  approuve_par TEXT REFERENCES reservistes(benevole_id),
  approuve_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Un réserviste ne peut avoir qu'UN SEUL pointage actif (arrivée sans départ)
-- par session. Les punch complets cohabitent sans contrainte.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pointages_actif_unique
  ON pointages (benevole_id, pointage_session_id)
  WHERE heure_depart IS NULL;

CREATE INDEX IF NOT EXISTS idx_pointages_benevole
  ON pointages(benevole_id);
CREATE INDEX IF NOT EXISTS idx_pointages_session
  ON pointages(pointage_session_id);
CREATE INDEX IF NOT EXISTS idx_pointages_statut
  ON pointages(statut);
CREATE INDEX IF NOT EXISTS idx_pointages_arrivee
  ON pointages(heure_arrivee DESC);
-- Permet de retrouver rapidement le dernier pointage d'un user pour une session
CREATE INDEX IF NOT EXISTS idx_pointages_benevole_session_arrivee
  ON pointages(benevole_id, pointage_session_id, heure_arrivee DESC);


-- 3. Table pointage_logs (audit trail)
CREATE TABLE IF NOT EXISTS pointage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  pointage_id UUID NOT NULL REFERENCES pointages(id) ON DELETE CASCADE,
  benevole_id TEXT NOT NULL,

  action TEXT NOT NULL CHECK (
    action IN (
      'arrivee', 'depart',
      'correction_arrivee', 'correction_depart',
      'approuve', 'conteste', 'annule',
      'creation_manuelle', 'nouvelle_entree'
    )
  ),

  valeur_avant TEXT,
  valeur_apres TEXT,

  modifie_par TEXT REFERENCES reservistes(benevole_id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pointage_logs_pointage
  ON pointage_logs(pointage_id);


-- ============================================================
-- RLS POLICIES
-- Principe :
--   - anon peut lire les pointage_sessions (nécessaire pour le scan QR sans auth
--     côté non-réservistes plus tard — MAIS pour MVP, les punch passent par
--     service_role via API, donc les policies public sont minimales)
--   - les API routes utilisent service_role pour les écritures
--   - admin/coord peut tout faire via le client authentifié
--   - un réserviste peut voir ses propres pointages
-- ============================================================

ALTER TABLE pointage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pointages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pointage_logs     ENABLE ROW LEVEL SECURITY;

-- ---- pointage_sessions ----

-- Lecture : tout utilisateur authentifié peut lire une session (nécessaire pour
-- afficher le contexte après scan). Pas de policy anon pour MVP.
DROP POLICY IF EXISTS "pointage_sessions_select_auth" ON pointage_sessions;
CREATE POLICY "pointage_sessions_select_auth"
  ON pointage_sessions FOR SELECT TO authenticated
  USING (true);

-- Écriture admin/coord
DROP POLICY IF EXISTS "pointage_sessions_insert_admin" ON pointage_sessions;
CREATE POLICY "pointage_sessions_insert_admin"
  ON pointage_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );

DROP POLICY IF EXISTS "pointage_sessions_update_admin" ON pointage_sessions;
CREATE POLICY "pointage_sessions_update_admin"
  ON pointage_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );

-- service_role full access (pour les API)
DROP POLICY IF EXISTS "pointage_sessions_service_role" ON pointage_sessions;
CREATE POLICY "pointage_sessions_service_role"
  ON pointage_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ---- pointages ----

-- Service role (API writes)
DROP POLICY IF EXISTS "pointages_service_role" ON pointages;
CREATE POLICY "pointages_service_role"
  ON pointages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Réserviste authentifié : voit ses propres pointages
DROP POLICY IF EXISTS "pointages_select_own" ON pointages;
CREATE POLICY "pointages_select_own"
  ON pointages FOR SELECT TO authenticated
  USING (
    benevole_id IN (
      SELECT benevole_id FROM reservistes WHERE user_id = auth.uid()
    )
  );

-- Admin/coord : full access
DROP POLICY IF EXISTS "pointages_admin_all" ON pointages;
CREATE POLICY "pointages_admin_all"
  ON pointages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );


-- ---- pointage_logs ----

DROP POLICY IF EXISTS "pointage_logs_service_role" ON pointage_logs;
CREATE POLICY "pointage_logs_service_role"
  ON pointage_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pointage_logs_select_admin" ON pointage_logs;
CREATE POLICY "pointage_logs_select_admin"
  ON pointage_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE user_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );


-- ============================================================
-- TRIGGERS
-- ============================================================

-- updated_at automatique sur pointages
CREATE OR REPLACE FUNCTION update_pointages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pointages_updated_at ON pointages;
CREATE TRIGGER trigger_pointages_updated_at
  BEFORE UPDATE ON pointages
  FOR EACH ROW
  EXECUTE FUNCTION update_pointages_updated_at();

-- Statut dérivé automatiquement selon les heures
-- arrivée sans départ → 'en_cours', arrivée + départ → 'complete' (sauf si approuvé/contesté)
CREATE OR REPLACE FUNCTION update_pointages_statut()
RETURNS TRIGGER AS $$
BEGIN
  -- Ne pas écraser un statut final (approuve/conteste/annule)
  IF NEW.statut IN ('approuve', 'conteste', 'annule') THEN
    RETURN NEW;
  END IF;

  IF NEW.heure_arrivee IS NOT NULL AND NEW.heure_depart IS NULL THEN
    NEW.statut = 'en_cours';
  ELSIF NEW.heure_arrivee IS NOT NULL AND NEW.heure_depart IS NOT NULL THEN
    NEW.statut = 'complete';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pointages_statut ON pointages;
CREATE TRIGGER trigger_pointages_statut
  BEFORE INSERT OR UPDATE OF heure_arrivee, heure_depart ON pointages
  FOR EACH ROW
  EXECUTE FUNCTION update_pointages_statut();


-- ============================================================
-- VUE : résumé par session (utile pour le dashboard admin)
-- ============================================================

CREATE OR REPLACE VIEW pointages_resume AS
SELECT
  ps.id                    AS pointage_session_id,
  ps.type_contexte,
  ps.session_id,
  ps.contexte_nom,
  ps.contexte_lieu,
  ps.shift,
  ps.date_shift,
  ps.actif,
  ps.approuveur_id,
  COUNT(p.id)                                                    AS total_pointages,
  COUNT(CASE WHEN p.statut = 'en_cours'  THEN 1 END)             AS nb_en_cours,
  COUNT(CASE WHEN p.statut = 'complete'  THEN 1 END)             AS nb_complets,
  COUNT(CASE WHEN p.statut = 'approuve'  THEN 1 END)             AS nb_approuves,
  COUNT(CASE WHEN p.statut = 'conteste'  THEN 1 END)             AS nb_contestes,
  ROUND(AVG(p.duree_minutes)::numeric, 0)                        AS duree_moyenne_minutes
FROM pointage_sessions ps
LEFT JOIN pointages p ON p.pointage_session_id = ps.id
GROUP BY ps.id;

COMMENT ON VIEW pointages_resume IS
  'Résumé agrégé des pointages par session QR — pour le dashboard admin.';
