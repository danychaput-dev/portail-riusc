-- ============================================================
-- Fix: Ajouter 'sortant' au CHECK constraint de courriel_reponses
-- et retroactivement lier les reponses admin envoyees dans les 14 dernieres heures
-- ============================================================

-- 1. Modifier le CHECK constraint pour accepter 'sortant'
ALTER TABLE courriel_reponses DROP CONSTRAINT IF EXISTS courriel_reponses_statut_check;
ALTER TABLE courriel_reponses ADD CONSTRAINT courriel_reponses_statut_check
  CHECK (statut IN ('recu', 'lu', 'traite', 'archive', 'sortant'));

-- 2. Retroactivement inserer les reponses admin (Re: ...) des 14 dernieres heures
-- Match par sujet normalise + benevole_id
INSERT INTO courriel_reponses (courriel_id, benevole_id, from_email, from_name, to_email, subject, body_html, body_text, statut, created_at)
SELECT
  parent.id AS courriel_id,
  reply.benevole_id,
  reply.from_email,
  reply.from_name,
  reply.to_email,
  reply.subject,
  reply.body_html,
  regexp_replace(reply.body_html, '<[^>]*>', '', 'g') AS body_text,
  'sortant' AS statut,
  reply.created_at
FROM courriels reply
JOIN courriels parent ON (
  parent.benevole_id = reply.benevole_id
  AND parent.id != reply.id
  AND (
    -- Le reply a un sujet qui commence par Re: ou Rép.: du parent
    replace(replace(replace(lower(reply.subject), 're: ', ''), 'rép.: ', ''), 'fw: ', '')
    = replace(replace(replace(lower(parent.subject), 're: ', ''), 'rép.: ', ''), 'fw: ', '')
  )
  AND parent.created_at < reply.created_at
)
WHERE reply.created_at > now() - interval '48 hours'
  AND reply.subject ILIKE 'Re:%'
  -- Eviter les doublons
  AND NOT EXISTS (
    SELECT 1 FROM courriel_reponses cr
    WHERE cr.courriel_id = parent.id
      AND cr.from_email = reply.from_email
      AND cr.subject = reply.subject
      AND cr.created_at = reply.created_at
  )
ORDER BY reply.created_at;
