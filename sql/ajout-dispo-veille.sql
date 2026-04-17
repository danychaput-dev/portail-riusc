-- Ajout colonnes dispo_veille pour phase de pré-déploiement
-- Date : 2026-04-17
-- Contexte : possible déploiement inondation MRC Papineau, admin reçoit des
-- réponses email informelles de réservistes. Esther veut les noter pour
-- retrouver rapidement les volontaires potentiels quand la demande formelle
-- arrive.
--
-- Non contraignant (pas une vraie disponibilité — utilisé avant le vrai
-- ciblage/mobilisation formel). À reset au début de chaque nouveau sinistre
-- via : POST /api/admin/reservistes/dispo-veille { action: 'reset_all' }

ALTER TABLE reservistes
  ADD COLUMN IF NOT EXISTS dispo_veille BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dispo_veille_note TEXT;

COMMENT ON COLUMN reservistes.dispo_veille IS
  'Flag indicatif de disponibilité en phase de veille/pré-déploiement.
   À cocher par admin suite à une réponse email positive. Non contraignant.';

COMMENT ON COLUMN reservistes.dispo_veille_note IS
  'Note libre associée à la dispo de veille (ex: "dispo après 16h", "sans pelle")';

-- IMPORTANT : rafraîchir la vue reservistes_actifs pour qu'elle capte les
-- nouvelles colonnes. Postgres fige la liste des colonnes d'un SELECT * au
-- moment du CREATE VIEW ; un simple ALTER TABLE ne met PAS la vue à jour.
-- Sans ce CREATE OR REPLACE, les requêtes sur reservistes_actifs échouent
-- avec : "column reservistes_actifs.dispo_veille does not exist".
CREATE OR REPLACE VIEW public.reservistes_actifs AS
  SELECT * FROM public.reservistes
  WHERE deleted_at IS NULL;

ALTER VIEW public.reservistes_actifs SET (security_invoker = on);

COMMENT ON VIEW public.reservistes_actifs IS
  'Reservistes actifs (deleted_at IS NULL). Utiliser cette vue dans le code app pour exclure la corbeille.';
