-- =====================================================================
-- Fix: etendre ciblages_statut_check pour permettre 'mobilise' et 'confirme'
--
-- Bug observe: la contrainte n'autorisait que 'cible, retire, notifie'
-- mais le workflow n8n mobilisation fait UPDATE ciblages.statut = 'mobilise'.
-- L'UPDATE etait rejete silencieusement, donc aucun ciblage ne passait
-- jamais a 'mobilise' en DB, meme apres l'etape 8 executee avec succes.
--
-- Pipeline complet maintenant autorise:
--   cible    -> reserviste ajoute au pool par l'admin (etape 4)
--   notifie  -> SMS+courriel de sollicitation dispo envoye (etape 5)
--   mobilise -> admin a officiellement mobilise cette personne (etape 8)
--   confirme -> reserviste a confirme sa presence via le bouton courriel
--   retire   -> admin retire la personne du ciblage
-- =====================================================================

BEGIN;

-- Drop l'ancienne contrainte trop restrictive
ALTER TABLE public.ciblages
  DROP CONSTRAINT IF EXISTS ciblages_statut_check;

-- Recreer avec les 5 statuts du pipeline
ALTER TABLE public.ciblages
  ADD CONSTRAINT ciblages_statut_check
  CHECK (statut = ANY (ARRAY[
    'cible'::text,
    'notifie'::text,
    'mobilise'::text,
    'confirme'::text,
    'retire'::text
  ]));

COMMIT;

-- Verif
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.ciblages'::regclass
  AND conname = 'ciblages_statut_check';
