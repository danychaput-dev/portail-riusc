-- =============================================================
-- ÉTAPE 2 : CORRECTION RLS COMPLÈTE — 33 tables
-- Exécuter dans Supabase SQL Editor APRÈS le diagnostic
--
-- Principe :
--   - RLS activé sur TOUTES les tables
--   - Les API routes utilisent supabaseAdmin (service_role) → bypass RLS
--   - Les pages client utilisent la clé anon → soumises au RLS
--   - Chaque table a des policies adaptées à son usage
--
-- NOTE : Ce script supprime les policies existantes avant d'en créer
--        de nouvelles pour éviter les conflits. C'est safe car le
--        service_role bypass toujours le RLS.
-- =============================================================


-- ═══════════════════════════════════════════════════════════════
-- HELPER : Fonction pour vérifier si l'utilisateur est admin
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reservistes
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'coordonnateur', 'adjoint')
  )
$$;


-- ═══════════════════════════════════════════════════════════════
-- HELPER : Récupérer le benevole_id de l'utilisateur courant
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.my_benevole_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT benevole_id FROM public.reservistes
  WHERE user_id = auth.uid()
  LIMIT 1
$$;


-- ═══════════════════════════════════════════════════════════════
-- HELPER : Supprimer toutes les policies d'une table
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._drop_all_policies(tbl text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, tbl);
  END LOOP;
END $$;


-- =============================================================
-- 1. RESERVISTES — Table centrale des utilisateurs
--    Client lit son propre profil + met à jour ses infos
--    Admin lit/modifie tout (via service_role dans les API)
-- =============================================================

SELECT public._drop_all_policies('reservistes');
ALTER TABLE public.reservistes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit son profil"
  ON public.reservistes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Utilisateur modifie son profil"
  ON public.reservistes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT via service_role uniquement (inscription)


-- =============================================================
-- 2. MESSAGES — Chat communautaire
--    Tous les authentifiés lisent, insèrent
--    Seul l'auteur peut modifier/supprimer
-- =============================================================

SELECT public._drop_all_policies('messages');
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les messages"
  ON public.messages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authentifiés créent des messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Auteur modifie son message"
  ON public.messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Auteur supprime son message"
  ON public.messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- =============================================================
-- 3. MESSAGE_REACTIONS — Réactions aux messages
-- =============================================================

SELECT public._drop_all_policies('message_reactions');
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les réactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authentifiés ajoutent des réactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Auteur retire sa réaction"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- =============================================================
-- 4. COMMUNITY_LAST_SEEN — Suivi lecture communauté
-- =============================================================

SELECT public._drop_all_policies('community_last_seen');
ALTER TABLE public.community_last_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit son propre last_seen"
  ON public.community_last_seen FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Utilisateur met à jour son last_seen"
  ON public.community_last_seen FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Utilisateur update son last_seen"
  ON public.community_last_seen FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- =============================================================
-- 5. FORMATIONS_BENEVOLES — Certificats et formations
--    Utilisateur lit ses propres formations
--    Admin lit tout (+ service_role pour write)
-- =============================================================

SELECT public._drop_all_policies('formations_benevoles');
ALTER TABLE public.formations_benevoles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit ses formations"
  ON public.formations_benevoles FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Admin insère des formations"
  ON public.formations_benevoles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin modifie des formations"
  ON public.formations_benevoles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =============================================================
-- 6. INSCRIPTIONS_CAMPS — Inscriptions aux camps
--    Utilisateur lit ses propres inscriptions
--    Admin lit/modifie tout
-- =============================================================

SELECT public._drop_all_policies('inscriptions_camps');
ALTER TABLE public.inscriptions_camps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit ses inscriptions"
  ON public.inscriptions_camps FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Admin modifie les inscriptions"
  ON public.inscriptions_camps FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT via service_role (inscription automatique)


-- =============================================================
-- 7. INSCRIPTIONS_CAMPS_LOGS — Audit des changements
--    (déjà corrigé plus tôt, on refait proprement)
-- =============================================================

SELECT public._drop_all_policies('inscriptions_camps_logs');
ALTER TABLE public.inscriptions_camps_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit les logs"
  ON public.inscriptions_camps_logs FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin insère des logs"
  ON public.inscriptions_camps_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());


-- =============================================================
-- 8. RAPPELS_CAMPS — SMS envoyés et réponses
--    (déjà corrigé plus tôt, on refait proprement)
-- =============================================================

SELECT public._drop_all_policies('rappels_camps');
ALTER TABLE public.rappels_camps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit les rappels"
  ON public.rappels_camps FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin crée des rappels"
  ON public.rappels_camps FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin modifie les rappels"
  ON public.rappels_camps FOR UPDATE TO authenticated
  USING (public.is_admin());


-- =============================================================
-- 9. DISPONIBILITES — Anciennes disponibilités (v1)
-- =============================================================

SELECT public._drop_all_policies('disponibilites');
ALTER TABLE public.disponibilites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit ses disponibilités"
  ON public.disponibilites FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Utilisateur gère ses disponibilités"
  ON public.disponibilites FOR INSERT TO authenticated
  WITH CHECK (benevole_id = public.my_benevole_id());

CREATE POLICY "Utilisateur modifie ses disponibilités"
  ON public.disponibilites FOR UPDATE TO authenticated
  USING (benevole_id = public.my_benevole_id())
  WITH CHECK (benevole_id = public.my_benevole_id());


-- =============================================================
-- 10. DISPONIBILITES_V2 — Nouvelles disponibilités
-- =============================================================

SELECT public._drop_all_policies('disponibilites_v2');
ALTER TABLE public.disponibilites_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit ses dispo v2"
  ON public.disponibilites_v2 FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Utilisateur insère ses dispo v2"
  ON public.disponibilites_v2 FOR INSERT TO authenticated
  WITH CHECK (benevole_id = public.my_benevole_id());

CREATE POLICY "Utilisateur modifie ses dispo v2"
  ON public.disponibilites_v2 FOR UPDATE TO authenticated
  USING (benevole_id = public.my_benevole_id())
  WITH CHECK (benevole_id = public.my_benevole_id());

CREATE POLICY "Utilisateur supprime ses dispo v2"
  ON public.disponibilites_v2 FOR DELETE TO authenticated
  USING (benevole_id = public.my_benevole_id());


-- =============================================================
-- 11. DOCUMENTS_OFFICIELS — Documents des réservistes
-- =============================================================

SELECT public._drop_all_policies('documents_officiels');
ALTER TABLE public.documents_officiels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit ses documents"
  ON public.documents_officiels FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

-- INSERT/UPDATE via service_role


-- =============================================================
-- 12. DOSSIER_RESERVISTE — Dossier détaillé du réserviste
-- =============================================================

SELECT public._drop_all_policies('dossier_reserviste');
ALTER TABLE public.dossier_reserviste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit son dossier"
  ON public.dossier_reserviste FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Utilisateur modifie son dossier"
  ON public.dossier_reserviste FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR benevole_id = public.my_benevole_id());


-- =============================================================
-- 13. LMS_MODULES — Modules de formation en ligne
--     Tous les authentifiés lisent les modules actifs
-- =============================================================

SELECT public._drop_all_policies('lms_modules');
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les modules actifs"
  ON public.lms_modules FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE via service_role (admin)


-- =============================================================
-- 14. LMS_PROGRESSION — Progression LMS par réserviste
-- =============================================================

SELECT public._drop_all_policies('lms_progression');
ALTER TABLE public.lms_progression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit sa progression"
  ON public.lms_progression FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Utilisateur insère sa progression"
  ON public.lms_progression FOR INSERT TO authenticated
  WITH CHECK (benevole_id = public.my_benevole_id());

CREATE POLICY "Utilisateur modifie sa progression"
  ON public.lms_progression FOR UPDATE TO authenticated
  USING (benevole_id = public.my_benevole_id())
  WITH CHECK (benevole_id = public.my_benevole_id());


-- =============================================================
-- 15. RESERVISTE_ORGANISATIONS — Liens réserviste ↔ org
-- =============================================================

SELECT public._drop_all_policies('reserviste_organisations');
ALTER TABLE public.reserviste_organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit ses organisations"
  ON public.reserviste_organisations FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Utilisateur gère ses organisations"
  ON public.reserviste_organisations FOR INSERT TO authenticated
  WITH CHECK (benevole_id = public.my_benevole_id());

CREATE POLICY "Utilisateur supprime ses organisations"
  ON public.reserviste_organisations FOR DELETE TO authenticated
  USING (benevole_id = public.my_benevole_id());


-- =============================================================
-- 16. RESERVISTE_LANGUES — Liens réserviste ↔ langues
-- =============================================================

SELECT public._drop_all_policies('reserviste_langues');
ALTER TABLE public.reserviste_langues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit ses langues"
  ON public.reserviste_langues FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Utilisateur gère ses langues"
  ON public.reserviste_langues FOR INSERT TO authenticated
  WITH CHECK (benevole_id = public.my_benevole_id());

CREATE POLICY "Utilisateur supprime ses langues"
  ON public.reserviste_langues FOR DELETE TO authenticated
  USING (benevole_id = public.my_benevole_id());


-- =============================================================
-- 17. CIBLAGES — Ciblage des réservistes pour déploiements
--     Admins gèrent, utilisateur lit s'il est ciblé
-- =============================================================

SELECT public._drop_all_policies('ciblages');
ALTER TABLE public.ciblages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit ses ciblages"
  ON public.ciblages FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Admin gère les ciblages"
  ON public.ciblages FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin modifie les ciblages"
  ON public.ciblages FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin supprime les ciblages"
  ON public.ciblages FOR DELETE TO authenticated
  USING (public.is_admin());


-- =============================================================
-- 18. DEPLOIEMENTS_ACTIFS — Déploiements en cours
--     Authentifiés lisent (page disponibilités), admin gère
-- =============================================================

SELECT public._drop_all_policies('deploiements_actifs');
ALTER TABLE public.deploiements_actifs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les déploiements actifs"
  ON public.deploiements_actifs FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE via service_role


-- =============================================================
-- 19. DEPLOYMENTS — Déploiements planifiés
-- =============================================================

SELECT public._drop_all_policies('deployments');
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les déploiements"
  ON public.deployments FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE via service_role


-- =============================================================
-- 20. DEMANDES — Demandes de déploiement
--     Admin seulement
-- =============================================================

SELECT public._drop_all_policies('demandes');
ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit les demandes"
  ON public.demandes FOR SELECT TO authenticated
  USING (public.is_admin());

-- INSERT/UPDATE via service_role


-- =============================================================
-- 21. DEPLOYMENTS_DEMANDES — Jonction déploiement ↔ demande
-- =============================================================

SELECT public._drop_all_policies('deployments_demandes');
ALTER TABLE public.deployments_demandes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit les liens déploiement-demande"
  ON public.deployments_demandes FOR SELECT TO authenticated
  USING (public.is_admin());


-- =============================================================
-- 22. VAGUES — Vagues de déploiement
-- =============================================================

SELECT public._drop_all_policies('vagues');
ALTER TABLE public.vagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les vagues"
  ON public.vagues FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE via service_role


-- =============================================================
-- 23. ASSIGNATIONS — Assignation des réservistes aux vagues
-- =============================================================

SELECT public._drop_all_policies('assignations');
ALTER TABLE public.assignations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit ses assignations"
  ON public.assignations FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

CREATE POLICY "Utilisateur confirme son assignation"
  ON public.assignations FOR UPDATE TO authenticated
  USING (benevole_id = public.my_benevole_id())
  WITH CHECK (benevole_id = public.my_benevole_id());

-- INSERT/DELETE via service_role


-- =============================================================
-- 24. SINISTRES — Événements / sinistres
--     Authentifiés lisent les actifs, admin lit tout
-- =============================================================

SELECT public._drop_all_policies('sinistres');
ALTER TABLE public.sinistres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les sinistres actifs"
  ON public.sinistres FOR SELECT TO authenticated
  USING (statut = 'Actif' OR public.is_admin());

-- INSERT/UPDATE via service_role


-- =============================================================
-- 25. RESERVISTE_ETAT — État opérationnel du réserviste
-- =============================================================

SELECT public._drop_all_policies('reserviste_etat');
ALTER TABLE public.reserviste_etat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur lit son état"
  ON public.reserviste_etat FOR SELECT TO authenticated
  USING (benevole_id = public.my_benevole_id() OR public.is_admin());

-- INSERT/UPDATE via service_role


-- =============================================================
-- TABLES D'AUDIT — Insert via service_role, lecture admin
-- =============================================================

-- 26. AUDIT_CONNEXIONS
SELECT public._drop_all_policies('audit_connexions');
ALTER TABLE public.audit_connexions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit les connexions"
  ON public.audit_connexions FOR SELECT TO authenticated
  USING (public.is_admin());

-- 27. AUDIT_PAGES
SELECT public._drop_all_policies('audit_pages');
ALTER TABLE public.audit_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit les visites"
  ON public.audit_pages FOR SELECT TO authenticated
  USING (public.is_admin());

-- 28. AUTH_LOGS
SELECT public._drop_all_policies('auth_logs');
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit les auth logs"
  ON public.auth_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- 29. AGENT_LOGS
SELECT public._drop_all_policies('agent_logs');
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit les agent logs"
  ON public.agent_logs FOR SELECT TO authenticated
  USING (public.is_admin());


-- =============================================================
-- TABLES DE RÉFÉRENCE — Lecture pour tous les authentifiés
-- =============================================================

-- 30. LANGUES
SELECT public._drop_all_policies('langues');
ALTER TABLE public.langues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les langues"
  ON public.langues FOR SELECT TO authenticated
  USING (true);

-- 31. ORGANISATIONS
SELECT public._drop_all_policies('organisations');
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authentifiés lisent les organisations"
  ON public.organisations FOR SELECT TO authenticated
  USING (true);

-- 32. MUNICIPALITES_QC — Utilisé dans le formulaire d'inscription (possiblement anon)
SELECT public._drop_all_policies('municipalites_qc');
ALTER TABLE public.municipalites_qc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde lit les municipalités"
  ON public.municipalites_qc FOR SELECT TO anon, authenticated
  USING (true);


-- =============================================================
-- 33. LMS_MODULES (storage bucket reference, pas une vraie table)
--     Déjà traité plus haut (#13)
-- =============================================================


-- =============================================================
-- NETTOYAGE : Supprimer la fonction helper temporaire
-- =============================================================

DROP FUNCTION IF EXISTS public._drop_all_policies(text);


-- =============================================================
-- VÉRIFICATION FINALE — Relancer le diagnostic pour confirmer
-- =============================================================

SELECT
  t.tablename AS table_name,
  CASE WHEN t.rowsecurity THEN '✅ Activé' ELSE '❌ Désactivé' END AS rls_status,
  COALESCE(p.nb_policies, 0) AS nb_policies
FROM pg_tables t
LEFT JOIN (
  SELECT tablename, COUNT(*) AS nb_policies
  FROM pg_policies WHERE schemaname = 'public'
  GROUP BY tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
ORDER BY t.tablename;
