-- =====================================================================
-- Vue camps_distincts : metadata des camps sans donnees nominatives
--
-- Motivation : le modal CreateSessionModal (creation de QR de pointage)
-- doit pouvoir lister les camps disponibles pour que les partenaires
-- (SOPFEU, Croix-Rouge) puissent creer des QR pour leurs camps. Or la
-- table inscriptions_camps contient des donnees personnelles (nom,
-- courriel, benevole_id) et est protegee par RLS — un partenaire ne
-- voit que ses propres inscriptions, donc la liste des camps parait
-- vide si aucun reserviste ne s'est encore inscrit.
--
-- Cette vue expose UNIQUEMENT les colonnes metadata distinctes par
-- session_id : camp_nom, camp_dates, camp_lieu, camp_date_debut, et
-- un compteur d'inscrits non-annules (pour info, sans exposer les noms).
--
-- Securite : pas de donnees personnelles. On ouvre en SELECT a tous
-- les authentifies.
-- =====================================================================

BEGIN;

DROP VIEW IF EXISTS public.camps_distincts;

CREATE VIEW public.camps_distincts AS
SELECT
  session_id,
  -- On prend MAX pour eviter les doublons si des inscriptions ont
  -- des valeurs legerement differentes (orthographe, etc). DISTINCT
  -- par session_id avec les premieres valeurs non-nulles trouvees.
  MAX(camp_nom)        AS camp_nom,
  MAX(camp_dates)      AS camp_dates,
  MAX(camp_lieu)       AS camp_lieu,
  MAX(camp_date_debut) AS camp_date_debut,
  COUNT(*) FILTER (WHERE presence IS NULL OR presence != 'annule') AS nb_inscrits_actifs
FROM public.inscriptions_camps
WHERE session_id IS NOT NULL
GROUP BY session_id;

COMMENT ON VIEW public.camps_distincts IS
  'Metadata distincte des camps (nom/dates/lieu) pour les formulaires
   de creation (ex: QR pointage). Sans donnees nominatives : exposable
   a tous les authentifies (contrairement a inscriptions_camps qui est
   protegee par RLS).';

-- Ouvrir en SELECT pour tous les utilisateurs authentifies.
-- Les anonymes n'ont pas acces (pas de GRANT anon).
GRANT SELECT ON public.camps_distincts TO authenticated;

COMMIT;

-- Verif : combien de camps distincts ?
SELECT count(*) FROM public.camps_distincts;
SELECT * FROM public.camps_distincts ORDER BY camp_nom LIMIT 5;
