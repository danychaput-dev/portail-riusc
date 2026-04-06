-- =============================================================
-- NETTOYAGE RLS — Corriger les doublons et la faille anon
-- Exécuter dans Supabase SQL Editor
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- FAILLE : formations_benevoles — "Anon peut lire formations"
-- Un utilisateur non connecté peut lire TOUS les certificats.
-- On supprime cette policy.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon peut lire formations" ON public.formations_benevoles;


-- ─────────────────────────────────────────────────────────────
-- DOUBLONS : disponibilites (7 policies → 4)
-- Supprimer les 3 doublons
-- ─────────────────────────────────────────────────────────────

-- Doublon de SELECT (on garde "Benevoles see own disponibilites")
DROP POLICY IF EXISTS "Users can view their own disponibilites" ON public.disponibilites;

-- Doublon de UPDATE (on garde "Benevoles update own disponibilites")
DROP POLICY IF EXISTS "Users can update their own disponibilites" ON public.disponibilites;

-- Service UPDATE redondant avec "Service all disponibilites (ALL)"
DROP POLICY IF EXISTS "Service can update disponibilites" ON public.disponibilites;


-- ─────────────────────────────────────────────────────────────
-- DOUBLONS : disponibilites_v2 (6 policies → 4)
-- ─────────────────────────────────────────────────────────────

-- Doublon de SELECT (on garde "dispos_v2_select_own")
DROP POLICY IF EXISTS "Reserviste lit ses dispos" ON public.disponibilites_v2;

-- "Admin lit toutes les dispos" — admin passe par service_role,
-- pas besoin d'une policy SELECT séparée
DROP POLICY IF EXISTS "Admin lit toutes les dispos" ON public.disponibilites_v2;


-- ─────────────────────────────────────────────────────────────
-- DOUBLONS : deploiements_actifs (4 policies → 2)
-- 3 SELECT qui font la même chose, on en garde 1
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tous peuvent voir déploiements actifs" ON public.deploiements_actifs;
DROP POLICY IF EXISTS "Allow read access to all users" ON public.deploiements_actifs;


-- ─────────────────────────────────────────────────────────────
-- DOUBLONS : formations_benevoles (9 policies → 6)
-- Après suppression du anon, reste des doublons INSERT/UPDATE
-- ─────────────────────────────────────────────────────────────

-- Doublon INSERT (on garde "Users can insert own formations")
DROP POLICY IF EXISTS "Users can insert their own formations" ON public.formations_benevoles;

-- Doublon UPDATE (on garde "Users can update own portail formations")
DROP POLICY IF EXISTS "Users can update certificat on own formations" ON public.formations_benevoles;


-- ─────────────────────────────────────────────────────────────
-- VÉRIFICATION : Demandes — vérifier que le SELECT est admin-only
-- Le nom "demandes_select" ne dit pas si c'est restreint.
-- On va le remplacer par une policy explicitement admin.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "demandes_select" ON public.demandes;

CREATE POLICY "Admin lit les demandes"
  ON public.demandes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('admin', 'coordonnateur', 'adjoint')
    )
  );


-- =============================================================
-- VÉRIFICATION FINALE
-- =============================================================

SELECT
  t.tablename AS table_name,
  CASE WHEN t.rowsecurity THEN '✅' ELSE '❌' END AS rls,
  COALESCE(p.nb_policies, 0) AS policies,
  COALESCE(p.details, '') AS detail
FROM pg_tables t
LEFT JOIN (
  SELECT tablename, COUNT(*) AS nb_policies,
    STRING_AGG(policyname || ' (' || cmd || ')', ', ' ORDER BY policyname) AS details
  FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
ORDER BY t.tablename;
