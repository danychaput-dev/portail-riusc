-- ============================================================================
-- Niveau 2 : Soft-delete sur formations_benevoles (certificats)
--
-- Au lieu d'un DELETE physique qui perd les certificats irreversiblement,
-- on marque deleted_at = now(). La vue `formations_benevoles_actives`
-- filtre automatiquement pour le code applicatif.
--
-- Restaurer un certificat accidentellement supprime devient trivial.
--
-- Prerequis : sql/audit-log.sql + sql/audit-attach-formations.sql
-- ============================================================================

-- 1. Colonnes soft-delete + archive URL certificat
alter table public.formations_benevoles
  add column if not exists deleted_at             timestamptz,
  add column if not exists deleted_reason         text,
  add column if not exists deleted_by_user_id     uuid,
  add column if not exists certificat_url_archive text;

comment on column public.formations_benevoles.certificat_url_archive is
  'Archive de certificat_url quand le reserviste "supprime" son certificat. Le fichier reste dans Storage, recuperable.';

create index if not exists idx_formations_benevoles_deleted_at
  on public.formations_benevoles (deleted_at)
  where deleted_at is not null;

comment on column public.formations_benevoles.deleted_at is
  'Soft-delete: timestamp de suppression. NULL = active. NOT NULL = en corbeille.';

-- 2. Vue des formations actives (= non soft-deleted)
-- A utiliser dans la majorite du code applicatif a la place de `formations_benevoles`.
create or replace view public.formations_benevoles_actives as
  select * from public.formations_benevoles
  where deleted_at is null;

comment on view public.formations_benevoles_actives is
  'Formations/certificats actifs (deleted_at IS NULL). Utiliser cette vue dans le code app pour exclure la corbeille.';

alter view public.formations_benevoles_actives set (security_invoker = on);

-- 3. Fonction soft-delete (avec raison obligatoire)
create or replace function public.formations_soft_delete(
  p_formation_id   bigint,
  p_reason         text,
  p_caller_user_id uuid default null,
  p_caller_email   text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Raison obligatoire pour supprimer un certificat (loi 25)';
  end if;

  select exists (
    select 1 from public.formations_benevoles
    where id = p_formation_id and deleted_at is null
  ) into v_exists;

  if not v_exists then
    return false;
  end if;

  -- Identifier l'auteur pour le trigger audit
  if p_caller_user_id is not null or p_caller_email is not null then
    perform public.audit_set_acting_user(p_caller_user_id, p_caller_email);
  end if;

  update public.formations_benevoles
  set deleted_at         = now(),
      deleted_reason     = p_reason,
      deleted_by_user_id = p_caller_user_id
  where id = p_formation_id;

  return true;
end;
$$;

grant execute on function public.formations_soft_delete(bigint, text, uuid, text) to service_role;
grant execute on function public.formations_soft_delete(bigint, text, uuid, text) to authenticated;

-- 4. Fonction restore (annule un soft-delete)
create or replace function public.formations_restore(
  p_formation_id   bigint,
  p_caller_user_id uuid default null,
  p_caller_email   text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from public.formations_benevoles
    where id = p_formation_id and deleted_at is not null
  ) into v_exists;

  if not v_exists then
    return false;
  end if;

  if p_caller_user_id is not null or p_caller_email is not null then
    perform public.audit_set_acting_user(p_caller_user_id, p_caller_email);
  end if;

  update public.formations_benevoles
  set deleted_at         = null,
      deleted_reason     = null,
      deleted_by_user_id = null
  where id = p_formation_id;

  -- Trace explicite "restore" dans audit_log
  insert into public.audit_log (
    table_name, record_id, action,
    changed_by_user_id, changed_by_email
  ) values (
    'formations_benevoles', p_formation_id::text, 'restore',
    p_caller_user_id, p_caller_email
  );

  return true;
end;
$$;

grant execute on function public.formations_restore(bigint, uuid, text) to service_role;

-- 5. Hard-delete definitif (reserve superadmin, irreversible)
-- Supprime aussi les entrees audit_log de cette formation.
create or replace function public.formations_hard_delete(
  p_formation_id bigint
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_purged int;
begin
  delete from public.audit_log
  where table_name = 'formations_benevoles' and record_id = p_formation_id::text;
  get diagnostics v_audit_purged = row_count;

  delete from public.formations_benevoles where id = p_formation_id;

  return v_audit_purged;
end;
$$;

grant execute on function public.formations_hard_delete(bigint) to service_role;
