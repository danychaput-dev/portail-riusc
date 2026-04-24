-- verifier-profils-7-dob.sql
-- Pour les 7 Approuves sans date de naissance, verifier l'etat des autres champs critiques
-- Retourne une matrice OK / MANQUE pour chaque champ
-- Usage: Supabase SQL Editor -> Run -> Download CSV si besoin

SELECT
  prenom, nom, email,

  -- Identite
  CASE WHEN date_naissance IS NULL THEN '❌ MANQUE' ELSE '✓' END AS "DOB",
  CASE WHEN telephone IS NULL OR telephone = '' THEN '❌ MANQUE' ELSE '✓' END AS "Tel",
  CASE WHEN adresse IS NULL OR adresse = '' THEN '❌ MANQUE' ELSE '✓' END AS "Adresse",
  CASE WHEN code_postal IS NULL OR code_postal = '' THEN '❌ MANQUE' ELSE '✓' END AS "CP",
  CASE WHEN ville IS NULL OR ville = '' THEN '❌ MANQUE' ELSE '✓' END AS "Ville",

  -- Contact urgence
  CASE WHEN contact_urgence_nom IS NULL OR contact_urgence_nom = '' THEN '❌ MANQUE' ELSE '✓' END AS "Contact urgence",
  CASE WHEN contact_urgence_telephone IS NULL OR contact_urgence_telephone = '' THEN '❌ MANQUE' ELSE '✓' END AS "Tel urgence",

  -- Profession
  CASE WHEN profession IS NULL OR profession = '' THEN '❌ MANQUE' ELSE '✓' END AS "Profession",

  -- Consentements
  CASE WHEN j_ai_18_ans IS NOT TRUE THEN '❌' ELSE '✓' END AS "18 ans",
  CASE WHEN consentement_antecedents IS NOT TRUE THEN '❌' ELSE '✓' END AS "Consent VA",
  CASE WHEN confidentialite IS NOT TRUE THEN '❌' ELSE '✓' END AS "Confid",

  -- Statut admin
  antecedents_statut, camp_qualif_complete,
  created_at::date AS inscrit_le

FROM reservistes_actifs
WHERE benevole_id IN (
  '11521351096',  -- Chantal Dandurand
  '18376154008',  -- Carol Desrosiers
  '11379861500',  -- Jean-Pierre Lacombe
  '11303981692',  -- Henri Levesque
  '8733945336',   -- Daven Noel
  '11346716787',  -- Rachid Abdoulaye Sore
  '11372537762'   -- Jonathan Vidal
)
ORDER BY nom;
