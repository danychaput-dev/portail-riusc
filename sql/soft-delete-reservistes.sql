-- sql/soft-delete-reservistes.sql
-- Phase 2 du systeme de recuperation: soft-delete des reservistes.
-- Au lieu de supprimer reellement, on marque deleted_at = now().
-- Une vue `reservistes_actifs` filtre automatiquement les soft-deleted.
-- Aucune purge automatique: la corbeille reste indefiniment jusqu'a hard-delete manuel.
--
-- Ordre d'execution:
--   1) Ce fichier (ajoute la colonne, cree la vue, fonctions restore/hard-delete)
--   2) Migrer le code app pour utiliser reservistes_actifs au lieu de reservistes
--      (la-ou on veut exclure les soft-deleted)
-- ============================================================================

-- 1. Colonnes soft-delete
alter table public.reservistes
  add column if not exists deleted_at        timestamptz,
  add column if not exists deleted_reason    text,
  add column if not exists deleted_by_user_id uuid;

create index if not exists idx_reservistes_deleted_at
  on public.reservistes (deleted_at)
  where deleted_at is not null;

comment on column public.reservistes.deleted_at is
  'Soft-delete: timestamp de suppression. NULL = actif. NOT NULL = en corbeille.';

-- 2. Vue des reservistes actifs (= non soft-deleted)
-- A utiliser dans la majorite du code applicatif a la place de `reservistes`.
create or replace view public.reservistes_actifs as
  select * from public.reservistes
  where deleted_at is null;

comment on view public.reservistes_actifs is
  'Reservistes actifs (deleted_at IS NULL). Utiliser cette vue dans le code app pour exclure la corbeille.';

-- La vue herite des permissions de la table sous-jacente via security_invoker
alter view public.reservistes_actifs set (security_invoker = on);

-- 3. Fonction restore (annule un soft-delete)
create or replace function public.reservistes_restore(
  p_benevole_id text,
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
  -- Verifier que la cible est bien soft-deleted
  select exists (
    select 1 from public.reservistes
    where benevole_id = p_benevole_id and deleted_at is not null
  ) into v_exists;

  if not v_exists then
    return false;
  end if;

  -- Identifier l'auteur pour le trigger audit
  if p_caller_user_id is not null or p_caller_email is not null then
    perform public.audit_set_acting_user(p_caller_user_id, p_caller_email);
  end if;

  update public.reservistes
  set deleted_at = null,
      deleted_reason = null,
      deleted_by_user_id = null
  where benevole_id = p_benevole_id;

  -- Trace une entree explicite "restore" dans audit_log (en plus des updates de champs)
  insert into public.audit_log (
    table_name, record_id, action,
    changed_by_user_id, changed_by_email
  ) values (
    'reservistes', p_benevole_id, 'restore',
    p_caller_user_id, p_caller_email
  );

  return true;
end;
$$;

grant execute on function public.reservistes_restore(text, uuid, text) to service_role;

-- 4. Fonction hard-delete (purge definitive, irreversible)
-- Supprime aussi les entrees d'audit_log de cette personne (loi 25 / RGPD).
-- A reserver aux superadmin via API.
create or replace function public.reservistes_hard_delete(
  p_benevole_id text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_purged int;
begin
  -- Purger d'abord les entrees audit_log
  delete from public.audit_log
  where table_name = 'reservistes' and record_id = p_benevole_id;
  get diagnostics v_audit_purged = row_count;

  -- Puis supprimer reellement le reserviste
  -- (les FK enfants devraient deja avoir ete nettoyees par /api/admin/reservistes/delete)
  delete from public.reservistes where benevole_id = p_benevole_id;

  return v_audit_purged;
end;
$$;

grant execute on function public.reservistes_hard_delete(text) to service_role;
