-- ────────────────────────────────────────────────────────────────────────────
-- sql/pointage-ajout-titre.sql
--
-- Ajoute un champ "titre" libre à pointage_sessions pour différencier les QR
-- générés pour un même contexte (camp/déploiement), même shift et même date.
--
-- Cas d'usage : un camp avec 6 équipes / chefs d'équipe → 6 QR distincts pour
-- le même camp, même date et même shift, chacun avec son titre.
--
-- Ce script est idempotent : il peut être exécuté plusieurs fois sans erreur.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Ajouter la colonne titre (optionnelle)
ALTER TABLE pointage_sessions
  ADD COLUMN IF NOT EXISTS titre TEXT;

COMMENT ON COLUMN pointage_sessions.titre IS
  'Libellé libre pour différencier plusieurs QR sur un même contexte/shift/date (ex: "Équipe Alpha", "Chef Marc")';

-- 2. Remplacer la contrainte UNIQUE pour inclure titre.
--    NULLS NOT DISTINCT (PG 15+) traite les NULL comme égaux :
--    - 2 lignes avec même contexte/shift/date/titre (ou tous NULL) → refusé
--    - 2 lignes avec même contexte/shift/date mais titres distincts → autorisé

-- 2a. Drop l'ancienne contrainte auto-générée (nom variable selon la version Postgres)
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'pointage_sessions'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 4  -- 4 colonnes = l'ancienne contrainte sans titre
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pointage_sessions DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Ancienne contrainte UNIQUE supprimée : %', cname;
  END IF;
END $$;

-- 2b. Drop la nouvelle contrainte si elle existe déjà (relance du script)
ALTER TABLE pointage_sessions
  DROP CONSTRAINT IF EXISTS pointage_sessions_contexte_unique;

-- 2c. Recréer la contrainte avec titre inclus
ALTER TABLE pointage_sessions
  ADD CONSTRAINT pointage_sessions_contexte_unique
  UNIQUE NULLS NOT DISTINCT (type_contexte, session_id, shift, date_shift, titre);

-- 3. Recréer la vue pointages_resume pour exposer le titre.
--    CREATE OR REPLACE VIEW ne permet pas d'insérer une colonne au milieu,
--    donc on DROP puis CREATE.
DROP VIEW IF EXISTS pointages_resume;

CREATE VIEW pointages_resume AS
SELECT
  ps.id                    AS pointage_session_id,
  ps.type_contexte,
  ps.session_id,
  ps.contexte_nom,
  ps.contexte_lieu,
  ps.titre,
  ps.shift,
  ps.date_shift,
  ps.actif,
  ps.approuveur_id,
  COUNT(p.id)                                                    AS total_pointages,
  COUNT(CASE WHEN p.statut = 'en_cours'  THEN 1 END)             AS nb_en_cours,
  COUNT(CASE WHEN p.statut = 'complete'  THEN 1 END)             AS nb_complets,
  COUNT(CASE WHEN p.statut = 'approuve'  THEN 1 END)             AS nb_approuves,
  COUNT(CASE WHEN p.statut = 'conteste'  THEN 1 END)             AS nb_contestes,
  ROUND(AVG(p.duree_minutes)::numeric, 0)                        AS duree_moyenne_minutes
FROM pointage_sessions ps
LEFT JOIN pointages p ON p.pointage_session_id = ps.id
GROUP BY ps.id;

COMMENT ON VIEW pointages_resume IS
  'Résumé agrégé des pointages par session QR — pour le dashboard admin.';
