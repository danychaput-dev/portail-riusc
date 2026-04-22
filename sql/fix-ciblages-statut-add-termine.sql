-- =====================================================================
-- Ajouter 'termine' a ciblages_statut_check pour supporter la demobilisation
-- apres qu'une vague soit terminee.
--
-- Pipeline complet:
--   cible -> notifie -> mobilise -> confirme -> termine
--                                 \-> retire (annulation admin)
-- =====================================================================

BEGIN;

ALTER TABLE public.ciblages
  DROP CONSTRAINT IF EXISTS ciblages_statut_check;

ALTER TABLE public.ciblages
  ADD CONSTRAINT ciblages_statut_check
  CHECK (statut = ANY (ARRAY[
    'cible'::text,
    'notifie'::text,
    'mobilise'::text,
    'confirme'::text,
    'termine'::text,
    'retire'::text
  ]));

COMMIT;

-- Verif
SELECT pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.ciblages'::regclass
  AND conname = 'ciblages_statut_check';
