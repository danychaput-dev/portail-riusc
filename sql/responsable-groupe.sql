-- ============================================================
-- Ajout de la propriété "responsable_groupe" à la table reservistes
-- Remplace le groupe "Responsable" par un booléen dédié
-- Date : 2026-04-06
-- ============================================================

-- 1. Ajouter la colonne
ALTER TABLE reservistes
ADD COLUMN IF NOT EXISTS responsable_groupe BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Migrer les réservistes qui avaient groupe = 'Responsable'
--    On les passe en responsable_groupe = true ET on change leur groupe à 'Approuvé'
UPDATE reservistes
SET responsable_groupe = TRUE,
    groupe = 'Approuvé'
WHERE groupe = 'Responsable';

-- 3. S'assurer que Carol Desrosiers est responsable_groupe
--    (au cas où elle n'avait pas le groupe Responsable)
UPDATE reservistes
SET responsable_groupe = TRUE
WHERE LOWER(prenom) = 'carol' AND LOWER(nom) = 'desrosiers';

-- 4. Vérification
SELECT benevole_id, prenom, nom, email, groupe, responsable_groupe
FROM reservistes
WHERE responsable_groupe = TRUE;
