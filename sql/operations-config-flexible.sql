-- =====================================================================
-- Phase 1 - Configuration flexible par operation
--
-- Ajoute 5 colonnes sur deployments pour supporter:
--   1. Choix du mode de dates: plage continue OU jours individuels
--   2. Branding: RIUSC ou AQBRS (pour les entetes SMS/courriel et logo)
--   3. Date limite de reponse calculee en heures (defaut 8h)
--
-- Aucune migration destructive. Tous les deploiements existants
-- gardent leur comportement actuel (plage continue + RIUSC) via les defauts.
-- =====================================================================

BEGIN;

-- ───── Nouvelles colonnes ─────
ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS mode_dates text NOT NULL DEFAULT 'plage_continue'
    CHECK (mode_dates IN ('plage_continue', 'jours_individuels')),
  ADD COLUMN IF NOT EXISTS jours_proposes date[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS branding text NOT NULL DEFAULT 'RIUSC'
    CHECK (branding IN ('RIUSC', 'AQBRS')),
  ADD COLUMN IF NOT EXISTS heures_limite_reponse integer NOT NULL DEFAULT 8
    CHECK (heures_limite_reponse > 0 AND heures_limite_reponse <= 168),
  ADD COLUMN IF NOT EXISTS date_limite_reponse timestamptz DEFAULT NULL;

-- ───── Commentaires de documentation ─────
COMMENT ON COLUMN public.deployments.mode_dates IS
  'plage_continue: les reservistes acceptent toute la plage date_debut..date_fin (tout ou rien). jours_individuels: checkboxes selon jours_proposes.';

COMMENT ON COLUMN public.deployments.jours_proposes IS
  'Array de dates explicites utilise uniquement si mode_dates = jours_individuels. Permet ex: 19 et 21 avril sans le 20.';

COMMENT ON COLUMN public.deployments.branding IS
  'Entete affiche dans SMS, courriel et page soumettre. RIUSC ou AQBRS. Determine aussi le logo affiche.';

COMMENT ON COLUMN public.deployments.heures_limite_reponse IS
  'Nombre heures entre envoi notification (etape 5) et date limite. Defaut 8h. Admin ajuste par operation.';

COMMENT ON COLUMN public.deployments.date_limite_reponse IS
  'Timestamp concret calcule au moment de l''envoi notification etape 5 (now() + heures_limite_reponse heures). Null tant que l''etape 5 n''est pas executee.';

-- ───── Validation: coherence jours_proposes avec mode_dates ─────
-- Pas de contrainte SQL stricte ici (difficile en CHECK cross-colonnes propre).
-- La validation est faite cote UI au step 3 + cote API save_deployment.

-- ───── Index pour les filtres eventuels ─────
CREATE INDEX IF NOT EXISTS idx_deployments_branding ON public.deployments(branding);

-- ───── Verification post-migration ─────
-- Devrait retourner toutes les rows avec valeurs par defaut
SELECT
  id,
  mode_dates,
  jours_proposes,
  branding,
  heures_limite_reponse,
  date_limite_reponse
FROM public.deployments
ORDER BY created_at DESC
LIMIT 10;

COMMIT;
