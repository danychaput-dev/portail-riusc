-- =====================================================================
-- Table operations_wizard_state
-- Persiste l'etat du wizard Operations par sinistre, partage entre admins.
--
-- 1 row par sinistre. Quand un admin choisit le sinistre X dans le wizard,
-- on restaure automatiquement les demandes + le deploiement associes.
-- Quand il change de selection, on upsert.
--
-- Remplace le localStorage actuel pour supporter multi-device et multi-admin.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.operations_wizard_state (
  sinistre_id uuid PRIMARY KEY REFERENCES public.sinistres(id) ON DELETE CASCADE,
  demande_ids uuid[] NOT NULL DEFAULT '{}',
  deployment_id uuid REFERENCES public.deployments(id) ON DELETE SET NULL,
  msg_notif text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_email text
);

COMMENT ON TABLE public.operations_wizard_state IS
  'Contexte du wizard Operations par sinistre. Partage entre admins. Restaure auto quand sinistre selectionne.';

COMMENT ON COLUMN public.operations_wizard_state.demande_ids IS
  'Demandes selectionnees a l''etape 2 pour ce sinistre. Pas les FK brutes vers deployments_demandes, juste le contexte UI courant.';

CREATE INDEX IF NOT EXISTS idx_ops_wizard_state_updated ON public.operations_wizard_state (updated_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.operations_wizard_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins lisent operations_wizard_state"
  ON public.operations_wizard_state
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );

CREATE POLICY "Admins ecrivent operations_wizard_state (INSERT)"
  ON public.operations_wizard_state
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );

CREATE POLICY "Admins ecrivent operations_wizard_state (UPDATE)"
  ON public.operations_wizard_state
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );

CREATE POLICY "Admins ecrivent operations_wizard_state (DELETE)"
  ON public.operations_wizard_state
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );

COMMIT;

-- Verification
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'operations_wizard_state'
ORDER BY ordinal_position;
