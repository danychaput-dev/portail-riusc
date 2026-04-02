-- ============================================================================
-- RAPPELS SMS - CAMPS
-- Requêtes utiles pour le suivi des rappels SMS envoyés aux participants
-- ============================================================================

-- Voir toutes les réponses d'un camp (OUI en premier)
-- Remplacer le session_id par celui du camp voulu
SELECT
  r.telephone,
  r.message_envoye,
  r.reponse,
  r.reponse_confirmee,
  r.reponse_at,
  r.envoye_at
FROM rappels_camps r
WHERE r.session_id = '11267314669'
ORDER BY
  CASE
    WHEN r.reponse_confirmee = true THEN 1
    WHEN r.reponse_confirmee = false THEN 2
    WHEN r.reponse IS NOT NULL THEN 3
    ELSE 4
  END,
  r.reponse_at ASC;

-- Résumé rapide d'un camp (combien OUI, NON, sans réponse)
SELECT
  COUNT(*) AS total_envoyes,
  COUNT(CASE WHEN reponse_confirmee = true THEN 1 END) AS oui,
  COUNT(CASE WHEN reponse_confirmee = false THEN 1 END) AS non,
  COUNT(CASE WHEN reponse IS NOT NULL AND reponse_confirmee IS NULL THEN 1 END) AS reponse_ambigue,
  COUNT(CASE WHEN reponse IS NULL THEN 1 END) AS sans_reponse
FROM rappels_camps
WHERE session_id = '11267314669';
