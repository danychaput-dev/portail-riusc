-- liste-invitation-camp-saguenay.sql
-- Liste JSON pour invitation last-minute au camp Chicoutimi 25-26 avril 2026
-- Cibles: Réservistes Intérêt du Saguenay-Lac-Saint-Jean NON DÉJÀ inscrits au camp
-- Note: couvre les 3 variantes orthographiques en DB (Saguenay--Lac..., Saguenay–Lac..., Saguenay / Lac-St-Jean)
-- Usage: coller dans Supabase SQL Editor -> Run -> copier le JSON -> /admin/courriels -> Importer une liste

-- === Query principale (json_agg) pour import ===
SELECT json_agg(
  json_build_object(
    'benevole_id', r.benevole_id,
    'email', r.email,
    'prenom', r.prenom,
    'nom', r.nom
  )
)
FROM reservistes_actifs r
WHERE r.groupe = 'Intérêt'
  AND r.region ILIKE '%saguenay%'
  AND r.email IS NOT NULL
  AND r.email <> ''
  AND NOT EXISTS (
    SELECT 1 FROM inscriptions_camps ic
    WHERE ic.session_id = 'CAMP_CHICOUTIMI_AVR26'
      AND ic.benevole_id = r.benevole_id
  );

-- === Prévisualisation (décommenter pour voir le détail avant d'envoyer) ===
-- SELECT r.prenom, r.nom, r.email, r.region, r.ville, r.telephone,
--        r.created_at::date AS inscrit_le
-- FROM reservistes_actifs r
-- WHERE r.groupe = 'Intérêt'
--   AND r.region ILIKE '%saguenay%'
--   AND r.email IS NOT NULL AND r.email <> ''
--   AND NOT EXISTS (
--     SELECT 1 FROM inscriptions_camps ic
--     WHERE ic.session_id = 'CAMP_CHICOUTIMI_AVR26'
--       AND ic.benevole_id = r.benevole_id
--   )
-- ORDER BY r.nom;
