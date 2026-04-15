-- ─────────────────────────────────────────────────────────────────────────────
-- Ajout de contraintes NOT NULL sur la table `reservistes`
-- Date : 2026-04-15
-- Audit : 964 lignes, colonnes ciblées 100% remplies
-- ─────────────────────────────────────────────────────────────────────────────

begin;

alter table reservistes alter column benevole_id        set not null;
alter table reservistes alter column prenom             set not null;
alter table reservistes alter column nom                set not null;
alter table reservistes alter column email              set not null;
alter table reservistes alter column role               set not null;
alter table reservistes alter column groupe             set not null;
alter table reservistes alter column statut             set not null;
alter table reservistes alter column antecedents_statut set not null;
alter table reservistes alter column methode_connexion  set not null;

commit;
