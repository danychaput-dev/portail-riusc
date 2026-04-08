-- Fix: get_campagne_courriel_stats doit retourner TOUS les statuts individuellement
-- pour que l'API puisse calculer envoyes/livres correctement.
-- A executer dans Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_campagne_courriel_stats()
RETURNS TABLE (
  campagne_id uuid,
  total bigint,
  queued bigint,
  sent bigint,
  delivered bigint,
  opened bigint,
  clicked bigint,
  bounced bigint,
  complained bigint,
  failed bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    campagne_id,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE statut = 'queued')::bigint AS queued,
    COUNT(*) FILTER (WHERE statut = 'sent')::bigint AS sent,
    COUNT(*) FILTER (WHERE statut = 'delivered')::bigint AS delivered,
    COUNT(*) FILTER (WHERE statut = 'opened')::bigint AS opened,
    COUNT(*) FILTER (WHERE statut = 'clicked')::bigint AS clicked,
    COUNT(*) FILTER (WHERE statut = 'bounced')::bigint AS bounced,
    COUNT(*) FILTER (WHERE statut = 'complained')::bigint AS complained,
    COUNT(*) FILTER (WHERE statut = 'failed')::bigint AS failed
  FROM courriels
  WHERE campagne_id IS NOT NULL
  GROUP BY campagne_id;
$$;
