-- delete-pointage-esther-equipe6.sql
-- Supprime le pointage test d'Esther dans le QR "Équipe 6" du Camp Chicoutimi Cohorte 9
-- Colonne correcte : pointage_sessions.titre (pas label_equipe)

-- === 1. Vérification AVANT (voir ce qu'on va supprimer) ===
SELECT p.id, p.benevole_id, r.prenom, r.nom, r.email,
       p.heure_arrivee, p.heure_depart, p.statut,
       ps.titre, ps.session_id
FROM pointages p
JOIN pointage_sessions ps ON ps.id = p.pointage_session_id
JOIN reservistes r ON r.benevole_id = p.benevole_id
WHERE ps.session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND ps.titre ILIKE '%6%'
  AND r.email = 'esther.lapointe@aqbrs.ca';

-- === 2. DELETE (décommente après vérification) ===
-- DELETE FROM pointages
-- WHERE id IN (
--   SELECT p.id
--   FROM pointages p
--   JOIN pointage_sessions ps ON ps.id = p.pointage_session_id
--   JOIN reservistes r ON r.benevole_id = p.benevole_id
--   WHERE ps.session_id = 'CAMP_CHICOUTIMI_AVR26'
--     AND ps.titre ILIKE '%6%'
--     AND r.email = 'esther.lapointe@aqbrs.ca'
-- );

-- === 3. Vérification APRES: re-rouler la Query #1, doit retourner 0 lignes ===
