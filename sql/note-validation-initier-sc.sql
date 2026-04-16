-- Migration: Ajouter note de validation pour les 300 formations "S'initier à la SC"
-- importées depuis Monday.com sans certificat
-- Date: 2026-04-16
-- Contexte: Ces formations sont marquées Réussi mais n'ont jamais eu de certificat
-- car Monday.com n'avait pas de mécanisme d'upload. Ce n'est pas une perte de données.

-- 299 entrées sans commentaire existant
UPDATE formations_benevoles
SET commentaire = 'Formation confirmée - importée depuis Monday.com (aucun certificat requis)'
WHERE id IN (
  SELECT fb.id
  FROM formations_benevoles fb
  JOIN reservistes_actifs r ON r.benevole_id = fb.benevole_id
  WHERE fb.nom_formation ILIKE '%initier%s_curit_%civile%'
    AND fb.resultat = 'Réussi'
    AND (fb.certificat_url IS NULL OR fb.certificat_url = '' OR fb.certificat_url = 'null')
    AND fb.deleted_at IS NULL
    AND (fb.commentaire IS NULL OR fb.commentaire = '')
);

-- Entrées avec commentaire existant : concaténer
UPDATE formations_benevoles
SET commentaire = commentaire || ' | Formation confirmée - importée depuis Monday.com (aucun certificat requis)'
WHERE id IN (
  SELECT fb.id
  FROM formations_benevoles fb
  JOIN reservistes_actifs r ON r.benevole_id = fb.benevole_id
  WHERE fb.nom_formation ILIKE '%initier%s_curit_%civile%'
    AND fb.resultat = 'Réussi'
    AND (fb.certificat_url IS NULL OR fb.certificat_url = '' OR fb.certificat_url = 'null')
    AND fb.deleted_at IS NULL
    AND fb.commentaire IS NOT NULL AND fb.commentaire != ''
    AND fb.commentaire NOT ILIKE '%importée depuis Monday%'
);
