-- =====================================================================
-- Table webhook_fallback_log
-- Capture TOUS les payloads recus par /api/webhooks/twilio-fallback
-- afin qu'aucun inbound SMS ne puisse etre perdu, meme si la route
-- primaire ou Supabase echoue.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.webhook_fallback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  webhook_path text NOT NULL,
  from_phone text,
  to_phone text,
  body text,
  message_sid text,
  raw_payload jsonb,
  primary_retry_ok boolean,
  primary_retry_error text,
  email_alert_sent boolean DEFAULT false,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  processed_by text,
  notes text
);

COMMENT ON TABLE public.webhook_fallback_log IS
  'Backup capture de tous les payloads recus par /api/webhooks/twilio-fallback. Sert de filet de securite quand le webhook primary echoue ou est absent.';

CREATE INDEX IF NOT EXISTS idx_webhook_fallback_received
  ON public.webhook_fallback_log (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_fallback_unprocessed
  ON public.webhook_fallback_log (received_at DESC)
  WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_webhook_fallback_from_phone
  ON public.webhook_fallback_log (from_phone);

-- ============== RLS ==============
ALTER TABLE public.webhook_fallback_log ENABLE ROW LEVEL SECURITY;

-- Superadmin + admin lisent et marquent comme traite
CREATE POLICY "Admins lisent webhook_fallback_log"
  ON public.webhook_fallback_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('superadmin', 'admin', 'coordonnateur')
    )
  );

CREATE POLICY "Admins modifient webhook_fallback_log"
  ON public.webhook_fallback_log
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reservistes
      WHERE reservistes.user_id = auth.uid()
        AND reservistes.role IN ('superadmin', 'admin')
    )
  );

-- Pas de INSERT policy pour authenticated: seul service_role (webhook) insere

-- ============== Vue pratique des fallbacks non traites ==============
CREATE OR REPLACE VIEW public.v_webhook_fallback_pending AS
SELECT
  id,
  received_at,
  webhook_path,
  from_phone,
  body,
  message_sid,
  primary_retry_ok,
  primary_retry_error,
  email_alert_sent,
  received_at::date AS date_jour
FROM public.webhook_fallback_log
WHERE processed = false
ORDER BY received_at DESC;

COMMENT ON VIEW public.v_webhook_fallback_pending IS
  'Raccourci pour voir les inbound SMS captures par le fallback mais pas encore reconcilies a la main.';
