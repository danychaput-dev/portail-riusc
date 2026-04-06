-- ============================================================
-- Phase 4 — Inbound : table courriel_reponses
-- Stocke les réponses reçues via reply+{courriel_id}@reply.aqbrs.ca
-- ============================================================

-- Table des réponses entrantes
CREATE TABLE IF NOT EXISTS courriel_reponses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien vers le courriel original (celui auquel le réserviste répond)
  courriel_id UUID REFERENCES courriels(id) ON DELETE SET NULL,

  -- Identifiant Resend de l'email reçu
  resend_email_id TEXT,

  -- Identifiant du réserviste (résolu depuis l'adresse from ou le courriel original)
  benevole_id TEXT REFERENCES reservistes(benevole_id),

  -- Métadonnées du courriel reçu
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,          -- ex: reply+abc123@reply.aqbrs.ca
  subject TEXT,
  body_text TEXT,         -- Corps en texte brut
  body_html TEXT,         -- Corps HTML (si disponible)

  -- Pièces jointes (métadonnées JSON)
  pieces_jointes JSONB DEFAULT '[]'::jsonb,

  -- Statut de traitement
  statut TEXT NOT NULL DEFAULT 'recu' CHECK (statut IN ('recu', 'lu', 'traite', 'archive')),
  lu_par UUID REFERENCES auth.users(id),
  lu_at TIMESTAMPTZ,

  -- Payload brut du webhook (pour debug)
  raw_payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_courriel_reponses_courriel_id ON courriel_reponses(courriel_id);
CREATE INDEX IF NOT EXISTS idx_courriel_reponses_benevole_id ON courriel_reponses(benevole_id);
CREATE INDEX IF NOT EXISTS idx_courriel_reponses_resend_email_id ON courriel_reponses(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_courriel_reponses_statut ON courriel_reponses(statut);
CREATE INDEX IF NOT EXISTS idx_courriel_reponses_created_at ON courriel_reponses(created_at DESC);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
ALTER TABLE courriel_reponses ENABLE ROW LEVEL SECURITY;

-- Admin et coordonnateur : lecture complète
CREATE POLICY "admin_coord_select_reponses" ON courriel_reponses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE reservistes.user_id = auth.uid()
      AND reservistes.role IN ('admin', 'coordonnateur')
    )
  );

-- Admin et coordonnateur : mise à jour (marquer comme lu/traité)
CREATE POLICY "admin_coord_update_reponses" ON courriel_reponses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM reservistes
      WHERE reservistes.user_id = auth.uid()
      AND reservistes.role IN ('admin', 'coordonnateur')
    )
  );

-- Service role : insertion (webhook)
-- Note: le webhook utilise SUPABASE_SERVICE_ROLE_KEY, donc bypass RLS automatiquement.
-- Pas besoin de policy INSERT pour anon/authenticated.

-- Réserviste : voir ses propres réponses
CREATE POLICY "reserviste_select_own_reponses" ON courriel_reponses
  FOR SELECT USING (
    benevole_id IN (
      SELECT benevole_id FROM reservistes
      WHERE reservistes.user_id = auth.uid()
    )
  );

-- ============================================================
-- Colonne has_reply sur courriels (pour indicateur visuel)
-- ============================================================
ALTER TABLE courriels ADD COLUMN IF NOT EXISTS has_reply BOOLEAN DEFAULT false;
