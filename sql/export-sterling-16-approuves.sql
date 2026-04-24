-- export-sterling-16-approuves.sql
-- Exporte les 16 Approuves qui n'ont pas encore soumis leur VA
-- Format colonnes A-F du fichier Sterling/Croix-Rouge
-- Usage: Supabase SQL Editor -> executer -> Download CSV -> uploader dans Sterling

SELECT
  prenom        AS "Prénom",
  nom           AS "Nom",
  adresse       AS "Adresse",
  email         AS "Courriel",
  telephone     AS "Téléphone",
  TO_CHAR(date_naissance, 'YYYY-MM-DD') AS "Date de naissance"
FROM reservistes_actifs
WHERE benevole_id IN (
  '8954328509',
  '9108719239',
  '8757853352',
  '8748786235',
  '8977753626',
  '9014455054',
  '8954662554',
  '8750432283',
  '11303981692',
  '11346716787',
  '11348129301',
  '11372537762',
  '11379861500',
  '8733945336',
  '11521351096',
  '18376154008'
)
ORDER BY nom, prenom;
