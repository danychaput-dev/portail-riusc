-- sql/audit-log-purge-cron.sql
-- Planifie la purge automatique de audit_log (retention 6 mois) via pg_cron.
--
-- Pre-requis: extension pg_cron activee dans Supabase
--   -> Database > Extensions > activer "pg_cron"
--   (disponible sur tous les plans, y compris Free tier depuis 2024)
--
-- Ce job tourne tous les lundis a 3h (UTC) et supprime toutes les entrees
-- audit_log plus vieilles que 6 mois. La fonction audit_purge_old(int)
-- existe deja (cf. sql/audit-log.sql).
--
-- Pour verifier que le job est actif:
--   select * from cron.job where jobname = 'audit-log-purge-6m';
--
-- Pour voir l'historique d'execution:
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'audit-log-purge-6m')
--   order by start_time desc limit 10;
--
-- Pour desactiver temporairement:
--   select cron.unschedule('audit-log-purge-6m');

-- 1. Activer l'extension pg_cron si pas deja fait
create extension if not exists pg_cron;

-- 2. Nettoyer un eventuel job existant (idempotent)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'audit-log-purge-6m') then
    perform cron.unschedule('audit-log-purge-6m');
  end if;
end $$;

-- 3. Planifier la purge tous les lundis a 3h UTC
--    (= dimanche soir 22h heure Quebec, faible activite)
select cron.schedule(
  'audit-log-purge-6m',
  '0 3 * * 1',
  $$select public.audit_purge_old(6);$$
);

-- 4. Verification
select jobname, schedule, command, active
from cron.job
where jobname = 'audit-log-purge-6m';
