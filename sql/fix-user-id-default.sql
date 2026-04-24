-- sql/fix-user-id-default.sql
-- ═══════════════════════════════════════════════════════════════════════
-- Fix systémique : désynchronisation reservistes.user_id ↔ auth.users.id
-- ═══════════════════════════════════════════════════════════════════════
--
-- CONTEXTE
-- --------
-- La colonne reservistes.user_id avait :
--   user_id uuid DEFAULT gen_random_uuid() UNIQUE,
--
-- Chaque insertion sans user_id explicite générait un UUID aléatoire qui ne
-- matchait JAMAIS l'auth.users.id créé plus tard. Résultat : la RLS sur
-- reservistes (qui exige user_id = auth.uid()) empêche l'utilisateur de voir
-- sa propre ligne. Le self-heal client-side dans PortailHeader.tsx est aussi
-- bloqué par cette même RLS → loop permanent, seul un admin peut résoudre.
--
-- Incident déclencheur : Pierre Vallée (benevole_id 1776687487010) 2026-04-24.
-- 33 lignes au total étaient désynchronisées en prod, fixées en batch le même
-- jour (voir UPDATE dans le thread handoff).
--
-- CE QUE FAIT CE SCRIPT
-- ---------------------
-- 1. Retire le DEFAULT gen_random_uuid() — empêche de futurs cas
-- 2. Nettoie les user_id "fantômes" existants (UUID sans auth.users
--    correspondant) en les mettant à NULL. La colonne reste UNIQUE mais
--    PostgreSQL autorise plusieurs NULL.
-- 3. Sanity checks avant et après.
--
-- APRÈS CETTE MIGRATION
-- ---------------------
-- - Nouveaux réservistes : user_id = NULL par défaut. Doit être lié
--   explicitement via /api/inscription (qui reçoit déjà l'auth.user.id) ou
--   via /api/auth/link-reserviste (self-heal au 1er login via service_role).
-- - Anciens réservistes fantômes : user_id remis à NULL, se relieront
--   automatiquement au prochain login via l'API de self-heal.
--
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. État avant ─────────────────────────────────────────────────────
SELECT 'AVANT' AS phase,
       COUNT(*) FILTER (WHERE user_id IS NULL)                          AS user_id_null,
       COUNT(*) FILTER (WHERE user_id IS NOT NULL)                      AS user_id_set,
       COUNT(*) FILTER (
         WHERE user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = reservistes.user_id)
       )                                                                AS user_id_fantomes
FROM reservistes
WHERE deleted_at IS NULL;

-- ─── 2. Retirer le DEFAULT ─────────────────────────────────────────────
ALTER TABLE public.reservistes
  ALTER COLUMN user_id DROP DEFAULT;

-- ─── 3. Nettoyer les UUIDs fantômes (user_id pointant sur rien) ────────
UPDATE public.reservistes r
SET user_id = NULL,
    updated_at = now()
WHERE r.deleted_at IS NULL
  AND r.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = r.user_id
  );

-- ─── 4. État après ─────────────────────────────────────────────────────
SELECT 'APRÈS' AS phase,
       COUNT(*) FILTER (WHERE user_id IS NULL)                          AS user_id_null,
       COUNT(*) FILTER (WHERE user_id IS NOT NULL)                      AS user_id_set,
       COUNT(*) FILTER (
         WHERE user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = reservistes.user_id)
       )                                                                AS user_id_fantomes
FROM reservistes
WHERE deleted_at IS NULL;

-- Le user_id_fantomes doit être 0 après. Le user_id_null augmente du nombre
-- d'orphelins nettoyés (réservistes importés sans auth).

-- ─── 5. Vérifier que le DEFAULT est bien retiré ────────────────────────
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reservistes'
  AND column_name = 'user_id';
-- Doit retourner: user_id | NULL (column_default) | YES (is_nullable)

-- Si OK → COMMIT. Sinon ROLLBACK.
COMMIT;
