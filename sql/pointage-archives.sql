-- =====================================================================
-- Pointage : archiver une session QR (soft + reversible) — 2026-04-22
--
-- Objectif : la page /admin/pointage a maintenant 2 onglets (Actives /
-- Archives). Archiver une session la cache de l'onglet principal sans
-- la supprimer. Un DELETE est aussi disponible pour les admins lors de
-- tests (via API /api/admin/pointage/sessions/[id] DELETE).
--
-- 1. Ajout archived_at TIMESTAMPTZ + archived_by TEXT sur pointage_sessions
-- 2. Recreer la vue pointages_resume pour exposer ces colonnes
-- =====================================================================

BEGIN;

-- Colonnes d'archivage
ALTER TABLE public.pointage_sessions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by TEXT;

COMMENT ON COLUMN public.pointage_sessions.archived_at IS
  'Timestamp d''archivage (NULL = session active). L''archivage est reversible.';
COMMENT ON COLUMN public.pointage_sessions.archived_by IS
  'benevole_id de l''utilisateur qui a archive la session.';

CREATE INDEX IF NOT EXISTS idx_pointage_sessions_archived_at
  ON public.pointage_sessions(archived_at)
  WHERE archived_at IS NOT NULL;

-- Recreer la vue pour exposer les colonnes d'archivage
CREATE OR REPLACE VIEW public.pointages_resume AS
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
  ps.archived_at,
  ps.archived_by,
  COUNT(p.id)                                                    AS total_pointages,
  COUNT(CASE WHEN p.statut = 'en_cours'  THEN 1 END)             AS nb_en_cours,
  COUNT(CASE WHEN p.statut = 'complete'  THEN 1 END)             AS nb_complets,
  COUNT(CASE WHEN p.statut = 'approuve'  THEN 1 END)             AS nb_approuves,
  COUNT(CASE WHEN p.statut = 'conteste'  THEN 1 END)             AS nb_contestes,
  ROUND(AVG(p.duree_minutes)::numeric, 0)                        AS duree_moyenne_minutes
FROM public.pointage_sessions ps
LEFT JOIN public.pointages p ON p.pointage_session_id = ps.id
GROUP BY ps.id;

COMMENT ON VIEW public.pointages_resume IS
  'Resume agrege des pointages par session QR — pour le dashboard admin. Inclut archived_at/archived_by depuis 2026-04-22.';

COMMIT;

-- Verif
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='pointage_sessions' AND column_name IN ('archived_at','archived_by');

SELECT * FROM pointages_resume LIMIT 1;
