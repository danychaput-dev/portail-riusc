-- =====================================================================
-- Table de file d'attente pour les certificats extraits de Gmail
-- (esther.lapointe@aqbrs.ca, source gmail_extract_2026-04)
--
-- Workflow:
-- 1. Script upload_to_queue.mjs lit rapport_final.csv et upload chaque
--    PJ vers le bucket privé certificats-a-trier, puis INSERT ici.
-- 2. Page admin /admin/certificats (onglet "À trier") affiche les items
--    pending, Esther assigne à une formation existante ou nouvelle
--    (statut_tri='assigned') ou supprime les doublons (statut_tri='deleted').
-- 3. Au moment de l'assignation, on UPDATE/INSERT formations_benevoles
--    avec certificat_url pointant vers le bucket public formations.
-- =====================================================================

create table if not exists certificats_a_trier (
  id uuid primary key default gen_random_uuid(),
  benevole_id text references reservistes(benevole_id) on delete set null,
  sender_email text not null,
  sender_name text,
  subject text,
  date_courriel timestamptz,
  filename_original text not null,
  storage_path text not null,                 -- chemin dans bucket certificats-a-trier
  thread_id text,
  message_id text,
  match_status text,                          -- MATCH, MATCH_BY_NAME, NO_MATCH
  statut_tri text not null default 'pending', -- pending, assigned, deleted
  formation_benevole_id bigint references formations_benevoles(id) on delete set null,
  assigne_par uuid references auth.users(id),
  assigne_at timestamptz,
  note_admin text,
  source text not null default 'gmail_extract_2026-04',
  created_at timestamptz not null default now()
);

-- Index pour les requêtes par benevole et par statut
create index if not exists idx_certificats_a_trier_benevole on certificats_a_trier(benevole_id);
create index if not exists idx_certificats_a_trier_statut on certificats_a_trier(statut_tri);
create index if not exists idx_certificats_a_trier_source on certificats_a_trier(source);

-- =====================================================================
-- RLS: admin/coordonnateur seulement
-- =====================================================================
alter table certificats_a_trier enable row level security;

drop policy if exists "Admins lisent les certificats à trier" on certificats_a_trier;
create policy "Admins lisent les certificats à trier"
  on certificats_a_trier for select
  using (
    exists (
      select 1 from reservistes r
      where r.user_id = auth.uid()
        and r.role in ('admin','superadmin','coordonnateur')
    )
  );

drop policy if exists "Admins gèrent les certificats à trier" on certificats_a_trier;
create policy "Admins gèrent les certificats à trier"
  on certificats_a_trier for all
  using (
    exists (
      select 1 from reservistes r
      where r.user_id = auth.uid()
        and r.role in ('admin','superadmin','coordonnateur')
    )
  )
  with check (
    exists (
      select 1 from reservistes r
      where r.user_id = auth.uid()
        and r.role in ('admin','superadmin','coordonnateur')
    )
  );

-- =====================================================================
-- Audit attaché à la table (capture qui assigne quoi quand)
-- =====================================================================
select audit_attach_table('certificats_a_trier', 'id');
