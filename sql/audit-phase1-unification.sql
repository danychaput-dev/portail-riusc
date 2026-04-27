-- sql/audit-phase1-unification.sql
-- Phase 1 du chantier d'unification de l'audit (avril 2026).
--
-- Objectifs :
-- 1. Exclure les colonnes "bruit" du trigger audit_capture (updated_at, monday_*, syncs)
-- 2. Désactiver le trigger custom doublon trg_formations_benevoles_audit
--    (le nouveau trigger générique audit_formations_benevoles via audit_capture remplace)
-- 3. Brancher 4 tables additionnelles sur audit_log (assignations, pointages,
--    inscriptions_camps, ciblages)
--
-- Avant : audit_log capturait déjà reservistes, dossier_reserviste, formations_benevoles,
-- certificats_a_trier, reserviste_etat, reserviste_langues, reserviste_organisations,
-- trajets (8 tables) MAIS avec pollution updated_at + auteur souvent NULL (les routes
-- API service_role ne setActingUser pas — corrigé en Phase 2 côté code Next.js).
--
-- Après : 12 tables auditées proprement, sans bruit.
--
-- IDEMPOTENT : peut être ré-exécuté sans casser l'existant.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Remplacer audit_capture() pour exclure colonnes bruit + utiliser SECURITY DEFINER
-- ────────────────────────────────────────────────────────────────────────────
-- IMPORTANT : SECURITY DEFINER est CRITIQUE. Sans ça, le trigger tourne avec
-- les permissions de l'utilisateur qui fait l'UPDATE — et les réservistes n'ont
-- pas le droit d'INSERT dans audit_log via RLS, donc tout UPDATE planterait avec
-- "new row violates row-level security policy for table audit_log" (42501).

CREATE OR REPLACE FUNCTION public.audit_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_pk_col      text := coalesce(TG_ARGV[0], 'id');
  v_record_id   text;
  v_user_id     uuid;
  v_email       text;
  v_old_json    jsonb;
  v_new_json    jsonb;
  v_key         text;
  v_old_val     jsonb;
  v_new_val     jsonb;
  -- Colonnes "bruit" à exclure de l'audit (techniques, syncs, timestamps auto)
  v_excluded    text[] := ARRAY[
    'updated_at',
    'synced_from_monday_at',
    'synced_to_monday_at',
    'monday_created_at',
    'monday_group_id',
    'monday_id',
    'monday_item_id'
  ];
begin
  -- Récupérer l'auteur (auth.uid() en UI, current_setting en service_role via setActingUser)
  begin v_user_id := auth.uid(); exception when others then v_user_id := null; end;
  if v_user_id is null then
    begin v_user_id := nullif(current_setting('app.acting_user_id', true), '')::uuid;
    exception when others then v_user_id := null; end;
  end if;
  begin v_email := nullif(current_setting('app.acting_email', true), '');
  exception when others then v_email := null; end;
  if v_email is null and v_user_id is not null then
    select email into v_email from public.reservistes where user_id = v_user_id limit 1;
  end if;

  if TG_OP = 'INSERT' then
    v_record_id := (to_jsonb(NEW) ->> v_pk_col);
    insert into public.audit_log (table_name, record_id, action, full_snapshot, changed_by_user_id, changed_by_email)
    values (TG_TABLE_NAME, v_record_id, 'insert', to_jsonb(NEW), v_user_id, v_email);
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    v_record_id := (to_jsonb(OLD) ->> v_pk_col);
    insert into public.audit_log (table_name, record_id, action, full_snapshot, changed_by_user_id, changed_by_email)
    values (TG_TABLE_NAME, v_record_id, 'delete', to_jsonb(OLD), v_user_id, v_email);
    return OLD;
  end if;

  if TG_OP = 'UPDATE' then
    v_record_id := (to_jsonb(NEW) ->> v_pk_col);
    v_old_json  := to_jsonb(OLD);
    v_new_json  := to_jsonb(NEW);
    for v_key in select jsonb_object_keys(v_new_json)
    loop
      if v_key = ANY(v_excluded) then continue; end if;
      v_old_val := v_old_json -> v_key;
      v_new_val := v_new_json -> v_key;
      if v_old_val is distinct from v_new_val then
        insert into public.audit_log (
          table_name, record_id, action, field_name, old_value, new_value,
          changed_by_user_id, changed_by_email
        ) values (
          TG_TABLE_NAME, v_record_id, 'update', v_key, v_old_val, v_new_val,
          v_user_id, v_email
        );
      end if;
    end loop;
    return NEW;
  end if;

  return null;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Désactiver le trigger legacy doublon sur formations_benevoles
-- ────────────────────────────────────────────────────────────────────────────
-- trg_formations_benevoles_audit alimente formations_benevoles_audit (table custom)
-- mais ne capture l'auteur que pour ~5% des modifs (1460 NULL sur ~1540 lignes).
-- Le trigger générique audit_formations_benevoles (via audit_capture) capture
-- l'auteur correctement et écrit dans audit_log. On garde la table custom historique
-- pour référence mais on arrête de l'alimenter.

DROP TRIGGER IF EXISTS trg_formations_benevoles_audit ON public.formations_benevoles;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Brancher 4 tables additionnelles sur audit_log
-- ────────────────────────────────────────────────────────────────────────────
-- audit_attach_table(table_name, pk_column) crée le trigger générique qui appelle
-- audit_capture(pk_column) en AFTER INSERT/UPDATE/DELETE.

select audit_attach_table('assignations', 'id');
select audit_attach_table('pointages', 'id');
select audit_attach_table('inscriptions_camps', 'id');
select audit_attach_table('ciblages', 'id');

-- ────────────────────────────────────────────────────────────────────────────
-- Vérification post-déploiement
-- ────────────────────────────────────────────────────────────────────────────
-- Lister les tables actuellement branchées sur audit_capture :
-- SELECT event_object_table, trigger_name
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND action_statement ILIKE '%audit_capture%'
-- GROUP BY event_object_table, trigger_name
-- ORDER BY event_object_table;
--
-- Devrait retourner 12 tables (les 8 historiques + 4 nouvelles).
