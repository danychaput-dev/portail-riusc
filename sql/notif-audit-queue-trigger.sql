-- sql/notif-audit-queue-trigger.sql
-- Phase 3 du chantier d'audit unifié (avril 2026).
--
-- Système de notification courriel automatique aux réservistes lorsqu'un admin
-- modifie leur profil/dossier/formations.
--
-- Architecture :
-- 1. Table notif_audit_queue : stocke les modifs à notifier (file d'attente)
-- 2. Trigger notify_on_audit() sur audit_log : décide quoi mettre dans la queue
--    avec filtres (table surveillée, champ non-interne, auteur != propriétaire,
--    auteur connu)
-- 3. Workflow n8n riusc-notif-modif-profil poll la queue toutes les 30s, groupe
--    les modifs par destinataire+auteur (debounce 60s), envoie le courriel via
--    Resend SMTP, marque processed.
--
-- IDEMPOTENT (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION, etc.)

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Table queue
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notif_audit_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id uuid NOT NULL REFERENCES public.audit_log(id) ON DELETE CASCADE,
  -- Destinataire (la personne dont le compte a été modifié)
  destinataire_benevole_id text NOT NULL,
  destinataire_email text NOT NULL,
  destinataire_prenom text,
  -- Quoi a été modifié
  table_name text NOT NULL,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  -- Qui a fait la modif
  changed_by_user_id uuid,
  changed_by_email text,
  changed_by_prenom text,
  changed_by_nom text,
  changed_at timestamp with time zone NOT NULL,
  -- Statut envoi
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamp with time zone,
  error text,
  retries int NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index pour que le poll n8n soit rapide (filtre WHERE processed = false)
CREATE INDEX IF NOT EXISTS idx_notif_audit_queue_pending
  ON public.notif_audit_queue (processed, created_at)
  WHERE processed = false;

-- RLS : seul service_role peut accéder (n8n via cred Postgres avec service_role
-- ou superuser). Pas de policy = personne d'autre n'y accède.
ALTER TABLE public.notif_audit_queue ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Fonction trigger qui filtre + alimente la queue
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_tables_surveillees text[] := ARRAY['reservistes', 'formations_benevoles', 'dossier_reserviste'];
  v_champs_exclus text[] := ARRAY[
    -- Champs internes admin (le réserviste s'en fout)
    'niveau_ressource', 'commentaire', 'dispo_veille', 'dispo_veille_note',
    -- Champs techniques (déjà exclus en amont mais double sécurité)
    'updated_at', 'created_at', 'monday_id', 'monday_item_id', 'monday_group_id',
    'monday_created_at', 'synced_from_monday_at', 'synced_to_monday_at',
    -- Soft-delete metadata
    'deleted_at', 'deleted_reason', 'deleted_by_user_id',
    -- Liens techniques
    'user_id'
  ];
  v_dest_benevole_id text;
  v_dest_email text;
  v_dest_prenom text;
  v_dest_user_id uuid;
  v_acteur_prenom text;
  v_acteur_nom text;
begin
  -- Filtre 1 : table surveillée
  if NEW.table_name <> ALL(v_tables_surveillees) then return null; end if;

  -- Filtre 2 : pas de DELETE (à raffiner plus tard si nécessaire)
  if NEW.action = 'delete' then return null; end if;

  -- Filtre 3 : champs internes exclus (uniquement pour UPDATE)
  if NEW.action = 'update' and NEW.field_name = ANY(v_champs_exclus) then return null; end if;

  -- Filtre 4 : auteur inconnu (modif système, migration SQL, route API sans
  -- setActingUser). Sans auteur on ne peut pas dire "modifié par X" → on skip.
  if NEW.changed_by_user_id is null then return null; end if;

  -- Récupérer le destinataire selon la table
  if NEW.table_name = 'reservistes' then
    select benevole_id, email, prenom, user_id
    into v_dest_benevole_id, v_dest_email, v_dest_prenom, v_dest_user_id
    from public.reservistes
    where benevole_id = NEW.record_id;
  elsif NEW.table_name = 'formations_benevoles' then
    select r.benevole_id, r.email, r.prenom, r.user_id
    into v_dest_benevole_id, v_dest_email, v_dest_prenom, v_dest_user_id
    from public.formations_benevoles f
    join public.reservistes r on r.benevole_id = f.benevole_id
    where f.id = NEW.record_id::uuid;
  elsif NEW.table_name = 'dossier_reserviste' then
    select r.benevole_id, r.email, r.prenom, r.user_id
    into v_dest_benevole_id, v_dest_email, v_dest_prenom, v_dest_user_id
    from public.dossier_reserviste d
    join public.reservistes r on r.benevole_id = d.benevole_id
    where d.id = NEW.record_id::uuid;
  end if;

  -- Filtre 5 : destinataire introuvable (formation orpheline, soft-deleted, etc.)
  if v_dest_email is null then return null; end if;

  -- Filtre 6 : auto-modification (le réserviste modifie son propre compte)
  if v_dest_user_id is not null and NEW.changed_by_user_id = v_dest_user_id then
    return null;
  end if;

  -- Récupérer le nom complet de l'auteur pour le courriel
  select prenom, nom into v_acteur_prenom, v_acteur_nom
  from public.reservistes
  where user_id = NEW.changed_by_user_id
  limit 1;

  -- Inscrire dans la queue (le workflow n8n picke ensuite)
  insert into public.notif_audit_queue (
    audit_log_id, destinataire_benevole_id, destinataire_email, destinataire_prenom,
    table_name, field_name, old_value, new_value,
    changed_by_user_id, changed_by_email, changed_by_prenom, changed_by_nom,
    changed_at
  ) values (
    NEW.id, v_dest_benevole_id, v_dest_email, v_dest_prenom,
    NEW.table_name, NEW.field_name, NEW.old_value, NEW.new_value,
    NEW.changed_by_user_id, NEW.changed_by_email, v_acteur_prenom, v_acteur_nom,
    NEW.changed_at
  );

  return null;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Brancher le trigger sur audit_log
-- ────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS notify_on_audit_trigger ON public.audit_log;
CREATE TRIGGER notify_on_audit_trigger
AFTER INSERT ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_audit();

-- ────────────────────────────────────────────────────────────────────────────
-- Monitoring (à lancer manuellement)
-- ────────────────────────────────────────────────────────────────────────────
-- État de la queue dans les dernières 24h :
-- SELECT
--   count(*) FILTER (WHERE processed) AS envoyes,
--   count(*) FILTER (WHERE NOT processed AND retries >= 5) AS abandonnes,
--   count(*) FILTER (WHERE NOT processed AND retries < 5) AS en_attente,
--   count(*) AS total
-- FROM notif_audit_queue
-- WHERE created_at > now() - interval '24 hours';
--
-- Notifs en erreur récente :
-- SELECT id, destinataire_email, field_name, error, retries, created_at
-- FROM notif_audit_queue
-- WHERE error IS NOT NULL
-- ORDER BY created_at DESC LIMIT 20;
