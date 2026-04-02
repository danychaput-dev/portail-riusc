-- ============================================================================
-- RÉSERVISTES
-- Requêtes utiles pour la gestion des réservistes
-- ============================================================================

-- Trouver un réserviste par email
SELECT benevole_id, prenom, nom, email, telephone, groupe, statut
FROM reservistes
WHERE LOWER(TRIM(email)) = 'exemple@email.com';

-- Trouver un réserviste par nom
SELECT benevole_id, prenom, nom, email, telephone, groupe, statut
FROM reservistes
WHERE LOWER(nom) LIKE '%nom%' OR LOWER(prenom) LIKE '%prenom%';

-- Nettoyer les "Ras" (rien à signaler) dans les champs santé
-- Remplacer l'email par celui du réserviste concerné
UPDATE reservistes
SET
  allergies_alimentaires = CASE WHEN LOWER(TRIM(allergies_alimentaires)) = 'ras' THEN NULL ELSE allergies_alimentaires END,
  allergies_autres = CASE WHEN LOWER(TRIM(allergies_autres)) = 'ras' THEN NULL ELSE allergies_autres END,
  conditions_medicales = CASE WHEN LOWER(TRIM(conditions_medicales)) = 'ras' THEN NULL ELSE conditions_medicales END
WHERE LOWER(TRIM(email)) = 'exemple@email.com'
RETURNING email, allergies_alimentaires, allergies_autres, conditions_medicales;

-- Trouver TOUS les réservistes avec "Ras" dans les champs santé
SELECT benevole_id, prenom, nom, email,
  allergies_alimentaires, allergies_autres, conditions_medicales
FROM reservistes
WHERE LOWER(TRIM(allergies_alimentaires)) = 'ras'
   OR LOWER(TRIM(allergies_autres)) = 'ras'
   OR LOWER(TRIM(conditions_medicales)) = 'ras';
