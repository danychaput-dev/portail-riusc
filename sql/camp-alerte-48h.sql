-- =====================================================================
-- Alerte 48h avant le camp : changements de presence notifies par courriel
--
-- 1. Ajout colonne camp_date_debut DATE à inscriptions_camps (source structurée)
-- 2. Ajout colonne alerte_envoyee_at TIMESTAMPTZ à inscriptions_camps_logs
--    (pour ne pas re-envoyer une alerte deja traitee)
-- 3. Backfill pour les camps connus (Chicoutimi)
-- 4. Vue pratique v_camp_changements_en_attente utilisee par le cron n8n
-- =====================================================================

BEGIN;

-- ─── 1. Colonne date structurée sur inscriptions_camps ───────────────
ALTER TABLE public.inscriptions_camps
  ADD COLUMN IF NOT EXISTS camp_date_debut DATE;

COMMENT ON COLUMN public.inscriptions_camps.camp_date_debut IS
  'Date de debut du camp (structuree) utilisee pour les alertes 48h. Plus fiable que camp_dates texte.';

CREATE INDEX IF NOT EXISTS idx_inscriptions_camps_date_debut
  ON public.inscriptions_camps(camp_date_debut);

-- ─── 2. Tracking alerte envoyee sur les logs ────────────────────────
ALTER TABLE public.inscriptions_camps_logs
  ADD COLUMN IF NOT EXISTS alerte_envoyee_at TIMESTAMPTZ;

COMMENT ON COLUMN public.inscriptions_camps_logs.alerte_envoyee_at IS
  'Timestamp a laquelle le cron n8n a envoye le courriel d''alerte 48h. NULL = pas encore alerte.';

CREATE INDEX IF NOT EXISTS idx_inscriptions_camps_logs_alerte_pending
  ON public.inscriptions_camps_logs(created_at DESC)
  WHERE alerte_envoyee_at IS NULL;

-- ─── 3. Backfill Chicoutimi Cohorte 9 ───────────────────────────────
UPDATE public.inscriptions_camps
  SET camp_date_debut = '2026-04-25'
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND camp_date_debut IS NULL;

-- ─── 4. Vue des changements a alerter ───────────────────────────────
-- Criteres:
--   - alerte_envoyee_at IS NULL (pas encore traite)
--   - camp_date_debut est dans les 48h a venir (entre now et now+48h)
--     OU vient juste de passer (now - 1 day, pour couvrir les changements en cours de camp)
--   - presence a reellement change (pas juste touch)
CREATE OR REPLACE VIEW public.v_camp_changements_en_attente AS
SELECT
  l.id                  AS log_id,
  l.inscription_id,
  l.session_id,
  l.benevole_id,
  l.prenom_nom,
  l.presence_avant,
  l.presence_apres,
  l.modifie_par,
  l.created_at          AS changement_at,
  ic.courriel           AS reserviste_courriel,
  ic.camp_nom,
  ic.camp_dates         AS camp_dates_texte,
  ic.camp_date_debut,
  ic.camp_lieu,
  EXTRACT(EPOCH FROM (ic.camp_date_debut::timestamp - NOW())) / 3600 AS heures_avant_camp
FROM public.inscriptions_camps_logs l
JOIN public.inscriptions_camps ic ON ic.id = l.inscription_id
WHERE l.alerte_envoyee_at IS NULL
  AND l.presence_avant IS DISTINCT FROM l.presence_apres
  AND ic.camp_date_debut IS NOT NULL
  -- Fenetre d'alerte: entre (now - 1 jour) et (now + 48h)
  -- Commencer a alerter 48h avant le debut, continuer a alerter jusqu'a 24h apres le debut
  AND ic.camp_date_debut BETWEEN (CURRENT_DATE - INTERVAL '1 day') AND (CURRENT_DATE + INTERVAL '2 days')
ORDER BY l.created_at ASC;

COMMENT ON VIEW public.v_camp_changements_en_attente IS
  'Changements de presence a alerter par courriel aux organisateurs. Alimente le cron n8n RIUSC - Alerte changements camp 48h.';

COMMIT;

-- Verif
SELECT * FROM v_camp_changements_en_attente LIMIT 10;
