-- =====================================================================
-- Suppression des inscriptions TEST Cohorte 9 Chicoutimi
-- Cibles: test@aqbrs.ca et dany.chaput+test@aqbrs.ca
-- Raison: fausser les stats camp, inscriptions de test uniquement
-- =====================================================================

-- ==================== ETAPE 1: VERIFICATION ====================
-- Rouler d'abord ces 3 SELECT pour confirmer ce qu'on va supprimer
-- AVANT de lancer le bloc BEGIN/COMMIT plus bas.

-- 1a. Les inscriptions concernees
SELECT id, session_id, courriel, prenom_nom, presence, benevole_id, created_at
FROM inscriptions_camps
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND courriel IN ('test@aqbrs.ca', 'dany.chaput+test@aqbrs.ca');

-- 1b. Les rappels SMS associes (s'il y en a)
SELECT rc.id, rc.telephone, rc.envoye_at, rc.reponse, ic.courriel
FROM rappels_camps rc
JOIN inscriptions_camps ic ON ic.id = rc.inscription_id
WHERE ic.session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND ic.courriel IN ('test@aqbrs.ca', 'dany.chaput+test@aqbrs.ca');

-- 1c. Les logs d'inscription associes
SELECT l.id, l.inscription_id, l.presence_avant, l.presence_apres, l.modifie_par, l.created_at, ic.courriel
FROM inscriptions_camps_logs l
JOIN inscriptions_camps ic ON ic.id = l.inscription_id
WHERE ic.session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND ic.courriel IN ('test@aqbrs.ca', 'dany.chaput+test@aqbrs.ca');

-- ==================== ETAPE 2: SUPPRESSION ====================
-- Ne roule ce bloc QUE si les SELECT ci-dessus montrent les bons records.

BEGIN;

-- Stocker les IDs cibles pour reutilisation
WITH cibles AS (
  SELECT id FROM inscriptions_camps
  WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
    AND courriel IN ('test@aqbrs.ca', 'dany.chaput+test@aqbrs.ca')
)
-- 2a. Supprimer les rappels SMS
DELETE FROM rappels_camps
WHERE inscription_id IN (SELECT id FROM cibles);

-- 2b. Supprimer les logs d'inscription
DELETE FROM inscriptions_camps_logs
WHERE inscription_id IN (
  SELECT id FROM inscriptions_camps
  WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
    AND courriel IN ('test@aqbrs.ca', 'dany.chaput+test@aqbrs.ca')
);

-- 2c. Supprimer les inscriptions elles-memes
DELETE FROM inscriptions_camps
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND courriel IN ('test@aqbrs.ca', 'dany.chaput+test@aqbrs.ca')
RETURNING id, courriel, prenom_nom, presence;

-- ==================== ETAPE 3: VERIFICATION FINALE ====================
-- Devrait retourner 0 rows
SELECT COUNT(*) AS restants
FROM inscriptions_camps
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND courriel IN ('test@aqbrs.ca', 'dany.chaput+test@aqbrs.ca');

-- Si tout est bon, committ