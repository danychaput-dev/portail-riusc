-- update-rappels-confirmation-manuelle.sql
-- Met à jour rappels_camps.reponse_confirmee pour 4 réservistes qui ont confirmé hors SMS
-- Session: CAMP_CHICOUTIMI_AVR26 (25-26 avril 2026)
-- 2 OUI + 2 NON
--
-- Logique: on cible le rappel LE PLUS RÉCENT de chaque personne pour cette session
-- (les autres rappels antérieurs restent en "SMS envoyé, pas de réponse" pour garder l'historique)

BEGIN;

-- =====================================================================
-- UPDATE: OUI (confirmation manuelle) — Georges Grenon + François Corbeil (biquette)
-- =====================================================================
WITH cibles AS (
  SELECT DISTINCT ON (r.benevole_id) rc.id
  FROM rappels_camps rc
  JOIN reservistes r ON r.benevole_id = rc.benevole_id
  WHERE r.email IN ('georges.grenon22@gmail.com', 'biquette@live.ca')
    AND rc.session_id = 'CAMP_CHICOUTIMI_AVR26'
  ORDER BY r.benevole_id, rc.envoye_at DESC
)
UPDATE rappels_camps
SET reponse = 'OUI (confirmation manuelle)',
    reponse_confirmee = true,
    reponse_at = NOW()
WHERE id IN (SELECT id FROM cibles);

-- =====================================================================
-- UPDATE: NON (confirmation manuelle) — Isabelle Lamarche + chantale Tremblay
-- =====================================================================
WITH cibles AS (
  SELECT DISTINCT ON (r.benevole_id) rc.id
  FROM rappels_camps rc
  JOIN reservistes r ON r.benevole_id = rc.benevole_id
  WHERE r.email IN ('isabelle0680@hotmail.com', 'chantale.tremblay@msp.gouv.qc.ca')
    AND rc.session_id = 'CAMP_CHICOUTIMI_AVR26'
  ORDER BY r.benevole_id, rc.envoye_at DESC
)
UPDATE rappels_camps
SET reponse = 'NON (confirmation manuelle)',
    reponse_confirmee = false,
    reponse_at = NOW()
WHERE id IN (SELECT id FROM cibles);

-- =====================================================================
-- (Optionnel) Mettre à jour inscriptions_camps.presence pour les 2 NON
-- Décommente si Isabelle et Chantale annulent vraiment leur participation
-- =====================================================================
-- UPDATE inscriptions_camps
-- SET presence = 'annule', presence_updated_at = NOW()
-- FROM reservistes r
-- WHERE inscriptions_camps.benevole_id = r.benevole_id
--   AND inscriptions_camps.session_id = 'CAMP_CHICOUTIMI_AVR26'
--   AND r.email IN ('isabelle0680@hotmail.com', 'chantale.tremblay@msp.gouv.qc.ca');

-- =====================================================================
-- Vérification: confirmer que les 4 rappels sont bien mis à jour
-- =====================================================================
SELECT r.prenom, r.nom, r.email, rc.session_id,
       rc.envoye_at::date AS date_envoi,
       rc.reponse, rc.reponse_confirmee, rc.reponse_at
FROM rappels_camps rc
JOIN reservistes r ON r.benevole_id = rc.benevole_id
WHERE r.email IN (
  'georges.grenon22@gmail.com', 'biquette@live.ca',
  'isabelle0680@hotmail.com', 'chantale.tremblay@msp.gouv.qc.ca'
)
  AND rc.session_id = 'CAMP_CHICOUTIMI_AVR26'
ORDER BY r.nom, rc.envoye_at DESC;

COMMIT;
