-- Deplacer e2e-admin@aqbrs.ca du groupe 'Approuve' vers 'Partenaires'
-- Date : 2026-04-17
--
-- Contexte : l'utilisateur E2E pour les tests Playwright apparaissait dans la
-- liste /admin/reservistes (filtree par defaut sur groupe='Approuve'). On le
-- deplace dans 'Partenaires' pour qu'il ne pollue plus la vue par defaut, tout
-- en gardant son role='admin' intact pour les tests E2E d'acces admin.
--
-- Solution TEMPORAIRE : a remplacer par un vrai groupe 'Systeme' ou un flag
-- is_system dedie lorsqu'on aura d'autres utilisateurs systeme (bots, services,
-- scheduled tasks, etc.).

UPDATE reservistes
SET groupe = 'Partenaires'
WHERE email = 'e2e-admin@aqbrs.ca'
RETURNING benevole_id, email, role, groupe;
