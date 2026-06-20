-- Batch G.5: operational webhook incident log (no raw payloads)

CREATE TABLE public.communication_webhook_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type TEXT NOT NULL
    CHECK (incident_type IN (
      'verify_failed',
      'fetch_failed',
      'malformed',
      'insert_failed',
      'deduped_inbound'
    )),
  provider_email_id TEXT,
  sender_email TEXT,
  customer_email TEXT,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.communication_webhook_incidents IS
  'Safe operational log for inbound webhook failures/retries (Batch G.5)';

CREATE INDEX communication_webhook_incidents_type_idx
  ON public.communication_webhook_incidents (incident_type, occurred_at DESC);

CREATE INDEX communication_webhook_incidents_occurred_at_idx
  ON public.communication_webhook_incidents (occurred_at DESC);

ALTER TABLE public.communication_webhook_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage communication_webhook_incidents"
  ON public.communication_webhook_incidents
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
