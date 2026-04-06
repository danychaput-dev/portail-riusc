-- ============================================================
-- Table admin_cc_contacts — Liste configurable de contacts CC
-- Partagée entre tous les admins/coordonnateurs
-- Date : 2026-04-06
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_cc_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE admin_cc_contacts ENABLE ROW LEVEL SECURITY;

-- Lecture pour les admins/coordonnateurs (via service_role pour les API routes)
CREATE POLICY "admin_cc_contacts_select" ON admin_cc_contacts
  FOR SELECT USING (TRUE);

CREATE POLICY "admin_cc_contacts_all_service" ON admin_cc_contacts
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Données initiales
INSERT INTO admin_cc_contacts (nom, email, position) VALUES
  ('Esther', 'esther@example.com', 1),
  ('Guy Lapointe', 'guy.lapointe@example.com', 2),
  ('Martine Forbes', 'martine.forbes@example.com', 3);

-- NOTE: Remplacer les adresses courriel par les vraies adresses
