-- Batch G: inbound email ingestion (email_in + threading columns)

ALTER TABLE public.communication_events
  DROP CONSTRAINT IF EXISTS communication_events_kind_check;

ALTER TABLE public.communication_events
  ADD CONSTRAINT communication_events_kind_check
  CHECK (kind IN (
    'email_out',
    'email_in',
    'note',
    'status_change',
    'payment',
    'commission',
    'project_event',
    'rental_event',
    'hosting_event'
  ));

ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS thread_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT;

COMMENT ON COLUMN public.communication_events.message_id IS 'RFC 5322 Message-ID when available';
COMMENT ON COLUMN public.communication_events.thread_id IS 'Lightweight thread grouping key (Batch G MVP)';
COMMENT ON COLUMN public.communication_events.sender_email IS 'Normalized sender for inbound; same as customer_email for outbound context';

CREATE INDEX IF NOT EXISTS communication_events_thread_id_idx
  ON public.communication_events (thread_id)
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS communication_events_sender_email_idx
  ON public.communication_events (sender_email)
  WHERE sender_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS communication_events_message_id_idx
  ON public.communication_events (message_id)
  WHERE message_id IS NOT NULL;

-- Idempotency: one row per Resend received email_id (webhook retries)
CREATE UNIQUE INDEX IF NOT EXISTS communication_events_inbound_provider_id_unique
  ON public.communication_events ((metadata->>'provider_email_id'))
  WHERE kind = 'email_in' AND (metadata->>'provider_email_id') IS NOT NULL;
