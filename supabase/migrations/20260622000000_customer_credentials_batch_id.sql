-- Group credentials saved together in one modal (batch edit)

ALTER TABLE public.customer_credentials
  ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS customer_credentials_batch_id_idx
  ON public.customer_credentials (batch_id)
  WHERE batch_id IS NOT NULL;

COMMENT ON COLUMN public.customer_credentials.batch_id IS
  'Optional group id for credentials saved/edited together in one modal session.';
