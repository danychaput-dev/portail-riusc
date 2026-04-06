-- Normaliser les numéros de téléphone : toujours 10 chiffres (sans le "1" ni le "+")
-- Convention : 4185551234
-- À exécuter UNE SEULE FOIS via Supabase SQL Editor

-- Cas 1 : +14185551234 → 4185551234 (retirer +1)
UPDATE reservistes
SET telephone = SUBSTRING(REGEXP_REPLACE(telephone, '\D', '', 'g') FROM 2)
WHERE telephone LIKE '+1%'
  AND LENGTH(REGEXP_REPLACE(telephone, '\D', '', 'g')) = 11;

UPDATE reservistes
SET telephone_secondaire = SUBSTRING(REGEXP_REPLACE(telephone_secondaire, '\D', '', 'g') FROM 2)
WHERE telephone_secondaire LIKE '+1%'
  AND LENGTH(REGEXP_REPLACE(telephone_secondaire, '\D', '', 'g')) = 11;

UPDATE reservistes
SET contact_urgence_telephone = SUBSTRING(REGEXP_REPLACE(contact_urgence_telephone, '\D', '', 'g') FROM 2)
WHERE contact_urgence_telephone LIKE '+1%'
  AND LENGTH(REGEXP_REPLACE(contact_urgence_telephone, '\D', '', 'g')) = 11;

-- Cas 2 : 14185551234 → 4185551234 (retirer le 1)
UPDATE reservistes
SET telephone = SUBSTRING(telephone FROM 2)
WHERE telephone ~ '^\d{11}$' AND telephone LIKE '1%';

UPDATE reservistes
SET telephone_secondaire = SUBSTRING(telephone_secondaire FROM 2)
WHERE telephone_secondaire ~ '^\d{11}$' AND telephone_secondaire LIKE '1%';

UPDATE reservistes
SET contact_urgence_telephone = SUBSTRING(contact_urgence_telephone FROM 2)
WHERE contact_urgence_telephone ~ '^\d{11}$' AND contact_urgence_telephone LIKE '1%';

-- Vérification après exécution :
-- SELECT
--   COUNT(*) FILTER (WHERE telephone ~ '^\d{10}$') as ok_10_chiffres,
--   COUNT(*) FILTER (WHERE telephone IS NOT NULL AND telephone != '' AND telephone !~ '^\d{10}$') as encore_invalide
-- FROM reservistes;
