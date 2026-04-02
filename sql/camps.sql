-- ============================================================================
-- CAMPS
-- Requêtes utiles pour la gestion des inscriptions aux camps
-- ============================================================================

-- Créer un camp test avec un participant
INSERT INTO inscriptions_camps (
  benevole_id, session_id, prenom_nom, presence,
  telephone, courriel, camp_nom, camp_dates, camp_lieu
)
SELECT
  benevole_id,
  'test-rappel-sms-001',
  CONCAT(prenom, ' ', nom),
  'confirme',
  telephone,
  email,
  'Camp Test SMS',
  '5–6 avril 2026',
  'Sherbrooke'
FROM reservistes
WHERE LOWER(TRIM(email)) = 'dany.chaput@aqbrs.ca'
RETURNING *;

-- Nettoyer un camp test
DELETE FROM rappels_camps WHERE session_id = 'test-rappel-sms-001';
DELETE FROM inscriptions_camps WHERE session_id = 'test-rappel-sms-001';

-- Voir tous les inscrits d'un camp
SELECT ic.prenom_nom, ic.presence, ic.telephone, ic.courriel,
  r.allergies_alimentaires, r.allergies_autres, r.conditions_medicales
FROM inscriptions_camps ic
LEFT JOIN reservistes r ON r.benevole_id = ic.benevole_id
WHERE ic.session_id = 'SESSION_ID_ICI'
ORDER BY ic.prenom_nom;
