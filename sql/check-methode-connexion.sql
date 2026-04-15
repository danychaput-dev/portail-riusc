-- Contraint methode_connexion à 'sms' ou 'email' pour matcher le type TS
-- et rejeter toute autre valeur.

-- 1. Vérifier les valeurs actuelles avant de contraindre
-- (à rouler en premier, manuellement, pour s'assurer qu'il n'y a pas de surprise)
-- select methode_connexion, count(*) from reservistes group by 1;

-- 2. Backfill: normaliser les valeurs hors enum vers 'email' (méthode par défaut)
update reservistes
set methode_connexion = 'email'
where methode_connexion not in ('sms', 'email');

-- 3. Ajouter la contrainte CHECK
alter table reservistes
  drop constraint if exists reservistes_methode_connexion_check;

alter table reservistes
  add constraint reservistes_methode_connexion_check
  check (methode_connexion in ('sms', 'email'));
