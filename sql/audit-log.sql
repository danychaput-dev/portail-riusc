-- sql/audit-log.sql
-- Phase 1 du systeme d'historique facon Monday: trace toutes les modifications
-- de champs sur les tables surveillees, sans toucher au code applicatif.
--
-- Usage:
--   1) Rouler ce fichier dans Supabase (cree la table, la fonction et le job)
--   2) Brancher le trigger sur une table avec:
--        select audit_attach_table('reservistes', 'benevole_id');
--   3) Pour les API routes service_role qui veulent identifier l'auteur:
--        await supabaseAdmin.rpc('audit_set_acting_user', { user_id, email })
--      (a appeler AVANT le UPDATE/DELETE dans la meme requete/transaction)
--
-- Retention: 6 mois (purge automatique via job pg_cron si dispo, sinon manuel)
-- ============================================================================

-- 1. Table audit_log generique
create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  table_name      text        not null,
  record_id       text        not null,
  action          text        not null check (action in ('insert','update','delete','restore')),
  field_name      text,                       -- NULL pour insert/delete/restore
  old_value       jsonb,
  new_value       jsonb,
  full_snapshot   jsonb,                      -- snapshot complet (delete/restore)
  changed_by_user_id  uuid,
  changed_by_email    text,
  changed_at      timestamptz not null default now()
);

create index if not exists idx_audit_log_table_record
  on public.audit_log (table_name, record_id, changed_at desc);
create index if not exists idx_audit_log_changed_at
  on public.audit_log (changed_at desc);

comment on table public.audit_log is
  'Journal d''audit generique. Une ligne par champ modifie pour les UPDATE, une seule ligne pour INSERT/DELETE/RESTORE.';

-- 2. RLS: lecture admin/superadmin/coordonnateur, pas de write client (trigger seul)
alter table public.audit_log enable row level security;

drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log
  for select
  to authenticated
  using (
    exists (
      select 1 from public.reservistes
      where user_id = auth.uid()
        and role in ('superadmin','admin','coordonnateur')
    )
  );

-- Aucune policy insert/update/delete: seul service_role (trigger) ecrit.

-- 3. Helper: identifier l'utilisateur acteur cote API service_role
-- Le trigger lira ces variables de session pour stocker l'auteur.
create or replace function public.audit_set_acting_user(
  p_user_id uuid,
  p_email   text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.acting_user_id', coalesce(p_user_id::text, ''), true);
  perform set_config('app.acting_email',   coalesce(p_email, ''),         true);
end;
$$;

grant execute on function public.audit_set_acting_user(uuid, text) to authenticated, service_role;

-- 4. Fonction trigger generique
-- Pour chaque table surveillee, on cree un trigger qui appelle audit_capture()
-- avec le nom de la colonne de cle primaire en parametre (TG_ARGV[0]).
create or replace function public.audit_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
begin
  -- Recuperer l'auteur depuis auth.uid() (UI) ou variables de session (API service_role)
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  if v_user_id is null then
    begin
      v_user_id := nullif(current_setting('app.acting_user_id', true), '')::uuid;
    exception when others then
      v_user_id := null;
    end;
  end if;

  begin
    v_email := nullif(current_setting('app.acting_email', true), '');
  exception when others then
    v_email := null;
  end;

  -- Si on a l'user_id mais pas l'email, le chercher dans reservistes
  if v_email is null and v_user_id is not null then
    select email into v_email from public.reservistes where user_id = v_user_id limit 1;
  end if;

  -- INSERT
  if TG_OP = 'INSERT' then
    v_record_id := (to_jsonb(NEW) ->> v_pk_col);
    insert into public.audit_log (
      table_name, record_id, action, full_snapshot,
      changed_by_user_id, changed_by_email
    ) values (
      TG_TABLE_NAME, v_record_id, 'insert', to_jsonb(NEW),
      v_user_id, v_email
    );
    return NEW;
  end if;

  -- DELETE
  if TG_OP = 'DELETE' then
    v_record_id := (to_jsonb(OLD) ->> v_pk_col);
    insert into public.audit_log (
      table_name, record_id, action, full_snapshot,
      changed_by_user_id, changed_by_email
    ) values (
      TG_TABLE_NAME, v_record_id, 'delete', to_jsonb(OLD),
      v_user_id, v_email
    );
    return OLD;
  end if;

  -- UPDATE: une ligne par champ modifie
  if TG_OP = 'UPDATE' then
    v_record_id := (to_jsonb(NEW) ->> v_pk_col);
    v_old_json  := to_jsonb(OLD);
    v_new_json  := to_jsonb(NEW);

    for v_key in select jsonb_object_keys(v_new_json)
    loop
      v_old_val := v_old_json -> v_key;
      v_new_val := v_new_json -> v_key;

      -- Comparer en jsonb (gere les NULL et les types correctement)
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

-- 5. Helper pour brancher / debrancher le trigger sur une table
create or replace function public.audit_attach_table(
  p_table   text,
  p_pk_col  text default 'id'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trigger_name text := 'audit_' || p_table;
begin
  execute format('drop trigger if exists %I on public.%I', v_trigger_name, p_table);
  execute format(
    'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.audit_capture(%L)',
    v_trigger_name, p_table, p_pk_col
  );
end;
$$;

create or replace function public.audit_detach_table(p_table text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format('drop trigger if exists %I on public.%I', 'audit_' || p_table, p_table);
end;
$$;

-- 6. Purge des entrees > 6 mois
-- A executer manuellement ou via un job (pg_cron, ou snapshot quotidien)
create or replace function public.audit_purge_old(p_months int default 6) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.audit_log
  where changed_at < now() - (p_months || ' months')::interval;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.audit_purge_old(int) to service_role;
