-- trigger-log-inscriptions-fix-insert.sql
-- Fix 2026-04-24: le trigger ne captait que les UPDATE de presence.
-- Les nouvelles inscriptions (INSERT) n'etaient pas loguees et l'alerte 48h
-- ne se declenchait pas pour ces cas.
--
-- Solution: etendre le trigger a INSERT OR UPDATE avec gestion du OLD null.

-- Etape 1: Recreer la fonction avec gestion INSERT + UPDATE
CREATE OR REPLACE FUNCTION public.log_inscription_camp_presence()
RETURNS TRIGGER AS $$
DECLARE
  v_modifie_par TEXT;
  v_user_id UUID;
BEGIN
  -- Identifier l'auteur
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NOT NULL THEN
    SELECT prenom || ' ' || nom INTO v_modifie_par
    FROM public.reservistes WHERE user_id = v_user_id LIMIT 1;
  END IF;

  IF v_modifie_par IS NULL THEN
    v_modifie_par := COALESCE(current_setting('app.acting_email', true), NULL);
  END IF;

  -- ─── INSERT: nouvelle inscription ──────────────────────────────
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.inscriptions_camps_logs
      (inscription_id, benevole_id, session_id, prenom_nom,
       presence_avant, presence_apres, modifie_par, created_at)
    VALUES
      (NEW.id, NEW.benevole_id, NEW.session_id, NEW.prenom_nom,
       NULL,  -- avant: pas inscrit
       NEW.presence::text,
       COALESCE(v_modifie_par, 'Auto (nouvelle inscription)'),
       NOW());
    RETURN NEW;
  END IF;

  -- ─── UPDATE: changement de presence ────────────────────────────
  IF TG_OP = 'UPDATE' AND NEW.presence IS DISTINCT FROM OLD.presence THEN
    INSERT INTO public.inscriptions_camps_logs
      (inscription_id, benevole_id, session_id, prenom_nom,
       presence_avant, presence_apres, modifie_par, created_at)
    VALUES
      (NEW.id, NEW.benevole_id, NEW.session_id, NEW.prenom_nom,
       OLD.presence::text,
       NEW.presence::text,
       COALESCE(v_modifie_par, 'Auto (trigger)'),
       NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Etape 2: Recreer le trigger en incluant INSERT
DROP TRIGGER IF EXISTS trg_inscriptions_camps_log_presence ON public.inscriptions_camps;

CREATE TRIGGER trg_inscriptions_camps_log_presence
  AFTER INSERT OR UPDATE OF presence ON public.inscriptions_camps
  FOR EACH ROW
  EXECUTE FUNCTION public.log_inscription_camp_presence();

-- ─── Etape 3: Backfill de la/des inscription(s) manquee(s) hier ─────
-- Identifier les inscriptions creees hier ou aujourd'hui sur Chicoutimi
-- pour lesquelles aucun log n'existe. Inserer un log retroactif pour
-- que le cron prochain les alerte.
INSERT INTO public.inscriptions_camps_logs
  (inscription_id, benevole_id, session_id, prenom_nom,
   presence_avant, presence_apres, modifie_par, created_at)
SELECT
  ic.id, ic.benevole_id, ic.session_id, ic.prenom_nom,
  NULL,
  ic.presence::text,
  'Auto (backfill inscription manquee)',
  ic.created_at
FROM public.inscriptions_camps ic
WHERE ic.session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND ic.created_at > NOW() - INTERVAL '3 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.inscriptions_camps_logs l
    WHERE l.inscription_id = ic.id
  );

-- Verification: quels logs viennent d'etre ajoutes?
SELECT l.prenom_nom, l.presence_avant, l.presence_apres,
       l.created_at AT TIME ZONE 'America/Toronto' AS changement_qc,
       l.modifie_par
FROM public.inscriptions_camps_logs l
WHERE l.modifie_par = 'Auto (backfill inscription manquee)'
ORDER BY l.created_at DESC;
