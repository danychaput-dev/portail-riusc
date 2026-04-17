-- Création du user E2E admin pour les tests Playwright
-- Date : 2026-04-17
-- Prérequis : user auth.users deja cree via Supabase Dashboard
--   - Email : e2e-admin@aqbrs.ca
--   - UUID  : 63251c49-0059-401c-94f6-7bc860649595
--   - Email confirme (Auto Confirm User coche)
--
-- Role : 'admin' pour permettre l'acces a toutes les pages /admin/*
-- PAS de telephone -> login via OTP par courriel uniquement
-- (l'app essaie SMS en premier si telephone est present)

INSERT INTO reservistes (
  benevole_id,
  user_id,
  prenom,
  nom,
  email,
  groupe,
  statut,
  role,
  antecedents_statut,
  methode_connexion
) VALUES (
  floor(random() * 89999999999 + 10000000000)::bigint::text,
  '63251c49-0059-401c-94f6-7bc860649595',
  'E2E',
  'Admin',
  'e2e-admin@aqbrs.ca',
  'Approuvé',
  'Actif',
  'admin',
  'verifie',
  'email'
)
ON CONFLICT (email) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  role = EXCLUDED.role,
  statut = EXCLUDED.statut,
  groupe = EXCLUDED.groupe,
  methode_connexion = EXCLUDED.methode_connexion
RETURNING benevole_id, prenom, nom, email, role, user_id;
