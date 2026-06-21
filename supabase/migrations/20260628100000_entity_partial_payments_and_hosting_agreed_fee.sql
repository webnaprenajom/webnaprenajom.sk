-- Partial entity payments (project/hosting/marketing) + hosting agreed_fee parity with projects.

DROP INDEX IF EXISTS public.payment_records_source_uidx;

CREATE INDEX IF NOT EXISTS payment_records_source_lookup_idx
  ON public.payment_records (source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

ALTER TABLE public.hosting_records
  ADD COLUMN IF NOT EXISTS agreed_fee NUMERIC CHECK (agreed_fee IS NULL OR agreed_fee >= 0);
