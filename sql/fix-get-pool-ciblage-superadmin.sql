-- =====================================================================
-- Fix: ajouter 'superadmin' a la liste des roles eligibles dans
-- get_pool_ciblage. Symptome: les users superadmin n'apparaissaient
-- jamais dans le pool de candidats a cibler, meme avec groupe='Approuve'.
--
-- Cause: la RPC filtrait r.role IN ('reserviste','admin','coordonnateur','adjoint')
-- et 'superadmin' a ete cree apres sans etre retro-ajoute.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_pool_ciblage(
  p_niveau text,
  p_reference_id uuid,
  p_date_debut date,
  p_date_fin date DEFAULT NULL::date,
  p_regions text[] DEFAULT NULL::text[],
  p_preference text DEFAULT NULL::text
)
RETURNS TABLE(
  benevole_id text, prenom text, nom text, telephone text,
  region text, ville text, preference_tache text, preference_tache_commentaire text,
  deployable boolean, en_deploiement_actif boolean,
  rotations_consecutives integer, repos_requis_jusqu date,
  raison_alerte text, deja_cible boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    r.benevole_id, r.prenom, r.nom, r.telephone,
    r.region, r.ville, r.preference_tache, r.preference_tache_commentaire,
    (d.info->>'deployable')::boolean,
    (d.info->>'en_deploiement_actif')::boolean,
    (d.info->>'rotations_consecutives')::int,
    (d.info->>'repos_requis_jusqu')::date,
    d.info->>'raison',
    EXISTS (
      SELECT 1 FROM ciblages c2
      WHERE c2.benevole_id = r.benevole_id
        AND c2.reference_id = p_reference_id
        AND c2.statut != 'retire'
    )
  FROM reservistes r
  CROSS JOIN LATERAL (
    SELECT get_deployabilite(
      r.benevole_id,
      p_date_debut,
      COALESCE(p_date_fin, (p_date_debut + interval '90 days')::date)
    ) AS info
  ) d
  WHERE r.role IN ('reserviste', 'admin', 'coordonnateur', 'adjoint', 'superadmin')
    AND r.groupe = 'Approuvé'
    AND r.statut = 'Actif'
    AND (p_regions IS NULL OR r.region = ANY(p_regions))
    AND (
      p_preference IS NULL
      OR r.preference_tache = 'aucune'
      OR r.preference_tache = p_preference
    )
  ORDER BY
    (d.info->>'deployable')::boolean DESC,
    r.region, r.nom;
END;
$function$;

COMMIT;

-- Verification: la RPC doit maintenant retourner dany si groupe=Approuve et statut=Actif
-- SELECT benevole_id, prenom, nom FROM get_pool_ciblage(
--   'deploiement', 'f7bcde4a-9c4d-434a-9ee6-f91129e0ca3e'::uuid,
--   '2026-04-23'::date, '2026-04-25'::date, null, null
-- ) WHERE benevole_id = '8738174928';
