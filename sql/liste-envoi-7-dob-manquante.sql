-- liste-envoi-7-dob-manquante.sql
-- Genere le JSON des 7 destinataires pour le modal "Importer une liste" de /admin/courriels
-- Usage:
--   1. Supabase SQL Editor -> coller -> Run
--   2. Copier le resultat (une seule ligne JSON)
--   3. Dans /admin/courriels -> Importer une liste -> coller -> Charger

SELECT json_agg(
  json_build_object(
    'benevole_id', benevole_id,
    'email', email,
    'prenom', prenom,
    'nom', nom
  )
)
FROM reservistes_actifs
WHERE benevole_id IN (
  '11521351096',  -- Chantal Dandurand
  '18376154008',  -- Carol Desrosiers
  '11379861500',  -- Jean-Pierre Lacombe
  '11303981692',  -- Henri Levesque
  '8733945336',   -- Daven Noel
  '11346716787',  -- Rachid Abdoulaye Sore
  '11372537762'   -- Jonathan Vidal
);
