-- =====================================================================
-- Rendre approuveur_id optionnel sur pointage_sessions (2026-04-22)
--
-- Decision: tous les admin/superadmin/partenaire peuvent approuver n'importe
-- quelle session, plus besoin de designer un approuveur precis lors de la
-- creation du QR. La colonne est conservee pour evolution future.
-- =====================================================================

BEGIN;

ALTER TABLE public.pointage_sessions
  ALTER COLUMN approuveur_id DROP NOT NULL;

COMMENT ON COLUMN public.pointage_sessions.approuveur_id IS
  'Approuveur designe (optionnel, pour evolution future). Actuellement tous les admin/superadmin/partenaire peuvent approuver peu importe cette valeur.';

COMMIT;

-- Verif: doit etre nullable=YES
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='pointage_sessions' AND column_name='approuveur_id';
