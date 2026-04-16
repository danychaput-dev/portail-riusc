-- Migration: Ajouter note de validation pour les formations importées Monday sans certificat
-- Date: 2026-04-16
-- Contexte: 753 formations importées de Monday.com/migration-monday marquées Réussi
-- mais sans certificat. Ce n'est pas une perte de données - Monday n'avait pas
-- de mécanisme d'upload de certificat pour ces formations internes.
-- Formations touchées: S'initier à la SC, Camp de qualification (cohortes 1-8),
-- Le bénévole en SC, Instructeur Camp, et autres formations internes AQBRS.

-- Batch 1: S'initier à la sécurité civile (300 entrées)
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

-- Batch 2: Toutes les autres formations Monday/migration-monday sans certificat (453 entrées)
UPDATE formations_benevoles
SET commentaire = 'Formation confirmée - importée depuis Monday.com (aucun certificat requis)'
WHERE id IN (
  SELECT fb.id
  FROM formations_benevoles fb
  JOIN reservistes_actifs r ON r.benevole_id = fb.benevole_id
  WHERE fb.resultat = 'Réussi'
    AND (fb.certificat_url IS NULL OR fb.certificat_url = '' OR fb.certificat_url = 'null')
    AND fb.deleted_at IS NULL
    AND fb.source IN ('monday', 'migration-monday')
    AND fb.certificat_requis = false
    AND (fb.commentaire IS NULL OR fb.commentaire = '')
    AND fb.nom_formation NOT ILIKE '%initier%s_curit_%civile%'
);

-- Batch 3: Concaténer pour ceux qui avaient déjà un commentaire
UPDATE formations_benevoles
SET commentaire = commentaire || ' | Formation confirmée - importée depuis Monday.com (aucun certificat requis)'
WHERE id IN (
  SELECT fb.id
  FROM formations_benevoles fb
  JOIN reservistes_actifs r ON r.benevole_id = fb.benevole_id
  WHERE fb.resultat = 'Réussi'
    AND (fb.certificat_url IS NULL OR fb.certificat_url = '' OR fb.certificat_url = 'null')
    AND fb.deleted_at IS NULL
    AND fb.source IN ('monday', 'migration-monday')
    AND fb.commentaire IS NOT NULL AND fb.commentaire != ''
    AND fb.commentaire NOT ILIKE '%importée depuis Monday%'
);
