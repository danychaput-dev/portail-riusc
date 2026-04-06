-- =============================================================
-- ÉTAPE 1 : DIAGNOSTIC — Exécuter en premier pour voir l'état actuel
-- Copier-coller dans Supabase SQL Editor
-- =============================================================

-- Liste toutes les tables public avec statut RLS + nombre de policies
SELECT
  t.tablename AS table_name,
  CASE WHEN t.rowsecurity THEN '✅ Activé' ELSE '❌ Désactivé' END AS rls_status,
  COALESCE(p.nb_policies, 0) AS nb_policies,
  COALESCE(p.policies, '') AS policies
FROM pg_tables t
LEFT JOIN (
  SELECT
    tablename,
    COUNT(*) AS nb_policies,
    STRING_AGG(policyname || ' (' || cmd || ')', ', ') AS policies
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
ORDER BY t.rowsecurity ASC, t.tablename;
