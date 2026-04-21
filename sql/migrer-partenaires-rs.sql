-- ────────────────────────────────────────────────────────────────────────────
-- sql/migrer-partenaires-rs.sql
--
-- Reclasse les 23 comptes créés le 2026-04-20 pour des responsables de groupes
-- R&S qui n'étaient pas déjà réservistes RIUSC. On les passe de
-- groupe='Approuvé' à groupe='Partenaires RS' pour éviter qu'ils soient comptés
-- dans les stats de réservistes actifs / déployables.
--
-- Les 7 responsables qui étaient DÉJÀ réservistes (Guy Lapointe, Serge Côté,
-- Thierry Gaudron, Kévin Normandin, Marc Chassé, Raynald Leclerc, René Roy)
-- ne sont PAS touchés : ils restent 'Approuvé' puisqu'ils sont effectivement
-- réservistes.
--
-- Script idempotent : relance sans effet si déjà migré.
-- ────────────────────────────────────────────────────────────────────────────

-- Vérification avant
SELECT 'AVANT' AS phase, groupe, COUNT(*) AS nb
FROM reservistes
WHERE LOWER(email) IN (
  'carole.corson@hotmail.ca',
  'hugoperry@telus.net',
  'president@sauvetage02.org',
  'tourvillefeu@gmail.com',
  'tloyd_1122@hotmail.com',
  'suzanne.marchand@hotmail.ca',
  'gparent150@hotmail.com',
  'jg.paris@siucq.net',
  'j.bedard@siucq.net',
  'pierre.sar.mauricie@gmail.com',
  'patrickpilon2020@gmail.com',
  'wbelvedere@hotmail.com',
  'g.motz@hotmail.com',
  'bruno.demmerle@pointe-claire.ca',
  'marianna.ferraiuolo@pointe-claire.ca',
  'steve.sirois@asjquebec.ca',
  'alexsapone@me.com',
  'balisebeaconk9@gmail.com',
  'vedis.ronald@gmail.com',
  'president@sbo-ovsar.ca',
  'sandraschwerzmann@gmail.com',
  'fathom.dps@gmail.com',
  'marcofrance@tlb.sympatico.ca'
)
GROUP BY groupe;

-- Migration
UPDATE reservistes
SET groupe = 'Partenaires RS'
WHERE LOWER(email) IN (
  'carole.corson@hotmail.ca',
  'hugoperry@telus.net',
  'president@sauvetage02.org',
  'tourvillefeu@gmail.com',
  'tloyd_1122@hotmail.com',
  'suzanne.marchand@hotmail.ca',
  'gparent150@hotmail.com',
  'jg.paris@siucq.net',
  'j.bedard@siucq.net',
  'pierre.sar.mauricie@gmail.com',
  'patrickpilon2020@gmail.com',
  'wbelvedere@hotmail.com',
  'g.motz@hotmail.com',
  'bruno.demmerle@pointe-claire.ca',
  'marianna.ferraiuolo@pointe-claire.ca',
  'steve.sirois@asjquebec.ca',
  'alexsapone@me.com',
  'balisebeaconk9@gmail.com',
  'vedis.ronald@gmail.com',
  'president@sbo-ovsar.ca',
  'sandraschwerzmann@gmail.com',
  'fathom.dps@gmail.com',
  'marcofrance@tlb.sympatico.ca'
)
AND groupe = 'Approuvé';

-- Vérification après : on attend 23 lignes en 'Partenaires RS'
SELECT 'APRÈS' AS phase, benevole_id, prenom, nom, email, groupe, responsable_groupe
FROM reservistes
WHERE LOWER(email) IN (
  'carole.corson@hotmail.ca',
  'hugoperry@telus.net',
  'president@sauvetage02.org',
  'tourvillefeu@gmail.com',
  'tloyd_1122@hotmail.com',
  'suzanne.marchand@hotmail.ca',
  'gparent150@hotmail.com',
  'jg.paris@siucq.net',
  'j.bedard@siucq.net',
  'pierre.sar.mauricie@gmail.com',
  'patrickpilon2020@gmail.com',
  'wbelvedere@hotmail.com',
  'g.motz@hotmail.com',
  'bruno.demmerle@pointe-claire.ca',
  'marianna.ferraiuolo@pointe-claire.ca',
  'steve.sirois@asjquebec.ca',
  'alexsapone@me.com',
  'balisebeaconk9@gmail.com',
  'vedis.ronald@gmail.com',
  'president@sbo-ovsar.ca',
  'sandraschwerzmann@gmail.com',
  'fathom.dps@gmail.com',
  'marcofrance@tlb.sympatico.ca'
)
ORDER BY nom;
