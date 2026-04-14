-- Ajout de updated_at sur reservistes + trigger de mise à jour automatique
-- Créé 2026-04-13

alter table public.reservistes
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reservistes_updated_at on public.reservistes;

create trigger trg_reservistes_updated_at
  before update on public.reservistes
  for each row
  execute function public.set_updated_at();

-- Backfill : mettre updated_at = created_at pour les lignes existantes
update public.reservistes
   set updated_at = created_at
 where updated_at = now()::date::timestamptz  -- garde-fou au cas de relance
   and created_at is not null;

create index if not exists reservistes_updated_at_idx
  on public.reservistes(updated_at desc);
