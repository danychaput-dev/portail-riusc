-- ─────────────────────────────────────────────────────────────────────────────
-- Ajout de contraintes NOT NULL sur les colonnes opérationnelles
-- Date : 2026-04-15
-- Objectif : refléter dans le schéma DB ce qui est vrai en pratique, pour
--            que les types Supabase générés cessent de propager `| null`
--            sur des champs toujours remplis.
--
-- Sécurité : transaction unique → tout passe ou rien ne change.
--            Backfills (UPDATE) AVANT les ALTER pour éviter les erreurs.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── sinistres ───────────────────────────────────────────────────────────────
alter table sinistres alter column type_incident set not null;
alter table sinistres alter column lieu          set not null;
alter table sinistres alter column date_debut    set not null;
alter table sinistres alter column created_at    set not null;
alter table sinistres alter column updated_at    set not null;

-- ── demandes ────────────────────────────────────────────────────────────────

-- Backfill : identifiant manquant → générer "DEM-<short id>"
update demandes
   set identifiant = 'DEM-' || substr(id::text, 1, 8)
 where identifiant is null;

-- Backfill : lieu manquant → reprendre celui du sinistre parent
update demandes d
   set lieu = s.lieu
  from sinistres s
 where d.sinistre_id = s.id
   and d.lieu is null;

-- Backfill : date_debut manquant → reprendre celle du sinistre parent
update demandes d
   set date_debut = s.date_debut
  from sinistres s
 where d.sinistre_id = s.id
   and d.date_debut is null;

alter table demandes alter column sinistre_id    set not null;
alter table demandes alter column type_mission   set not null;
alter table demandes alter column description    set not null;
alter table demandes alter column date_reception set not null;
alter table demandes alter column identifiant    set not null;
alter table demandes alter column lieu           set not null;
alter table demandes alter column date_debut     set not null;

-- ── deployments ─────────────────────────────────────────────────────────────
alter table deployments alter column created_at             set not null;
alter table deployments alter column date_debut             set not null;
alter table deployments alter column lieu                   set not null;
alter table deployments alter column nb_personnes_par_vague set not null;

-- ── vagues ──────────────────────────────────────────────────────────────────
-- Table vide actuellement. On n'applique aucune contrainte tant qu'on n'a
-- pas observé des données réelles.

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vérification post-migration : devrait retourner 0 ligne.
-- ─────────────────────────────────────────────────────────────────────────────
-- select column_name, is_nullable from information_schema.columns
--  where table_name in ('sinistres','demandes','deployments')
--    and column_name in (
--      'type_incident','lieu','date_debut','date_fin','created_at','updated_at',
--      'sinistre_id','type_mission','description','date_reception','identifiant',
--      'nb_personnes_par_vague'
--    )
--  order by table_name, column_name;
