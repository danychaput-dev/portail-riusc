-- Journal des retraits temporaires (réservistes, certificats, formations)
-- Patron aligné sur reservistes_suppressions : immuable, raison obligatoire, snapshot
-- Créé 2026-04-13

create table if not exists public.retraits_temporaires (
  id uuid primary key default gen_random_uuid(),

  entity_type text not null check (entity_type in ('reserviste','certificat','formation')),
  entity_id text not null,

  prenom text,
  nom text,
  role text,
  groupe_au_moment text,

  action text not null check (action in ('retrait','reactivation')),
  raison text not null check (char_length(raison) >= 10),

  effectue_par_user_id uuid references auth.users(id),
  effectue_par_email text,
  effectue_le timestamptz not null default now(),

  retrait_parent_id uuid references public.retraits_temporaires(id)
);

create index if not exists retraits_temporaires_entity_idx
  on public.retraits_temporaires(entity_type, entity_id, effectue_le desc);

-- Fonction helper réutilisable (remplace les emails en dur dans les policies)
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reservistes
    where user_id = auth.uid()
      and role = 'superadmin'
  );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

-- RLS : journal immuable, lecture et insertion superadmin uniquement
alter table public.retraits_temporaires enable row level security;

drop policy if exists "superadmin lit journal retraits" on public.retraits_temporaires;
drop policy if exists "superadmin insère journal retraits" on public.retraits_temporaires;

create policy "superadmin lit journal retraits"
  on public.retraits_temporaires for select
  using (public.is_superadmin());

create policy "superadmin insère journal retraits"
  on public.retraits_temporaires for insert
  with check (public.is_superadmin());

-- Pas de policy update/delete : journal immuable (loi 25)
