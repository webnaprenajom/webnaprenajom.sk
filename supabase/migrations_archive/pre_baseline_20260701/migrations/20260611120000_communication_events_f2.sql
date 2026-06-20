-- Batch F2: communication_events foundation

CREATE TABLE public.communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email TEXT,
  kind TEXT NOT NULL
    CHECK (kind IN (
      'email_out',
      'note',
      'status_change',
      'payment',
      'commission',
      'project_event',
      'rental_event',
      'hosting_event'
    )),
  title TEXT NOT NULL,
  body_preview TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_table TEXT,
  source_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.communication_events IS 'Persistent customer communication & activity log (Batch F2)';

CREATE INDEX communication_events_customer_id_idx
  ON public.communication_events (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX communication_events_customer_email_idx
  ON public.communication_events (customer_email)
  WHERE customer_email IS NOT NULL;

CREATE INDEX communication_events_kind_idx
  ON public.communication_events (kind);

CREATE INDEX communication_events_occurred_at_idx
  ON public.communication_events (occurred_at DESC);

CREATE INDEX communication_events_source_idx
  ON public.communication_events (source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

-- Idempotency for outbound email retries (Resend message id)
CREATE UNIQUE INDEX communication_events_resend_id_unique
  ON public.communication_events ((metadata->>'resend_id'))
  WHERE kind = 'email_out' AND (metadata->>'resend_id') IS NOT NULL;

CREATE TRIGGER trg_communication_events_updated
  BEFORE UPDATE ON public.communication_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage communication_events" ON public.communication_events
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
