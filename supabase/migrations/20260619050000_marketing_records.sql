-- Phase 2 Batch 2a — marketing delivery records (customer-linked, no finance fields)

CREATE TABLE public.marketing_records (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  client_name     TEXT,
  customer_email  TEXT,
  customer_id     UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL DEFAULT 'other',
  status          TEXT NOT NULL DEFAULT 'active',
  url             TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_records
  ADD CONSTRAINT marketing_records_channel_check
    CHECK (channel IN ('google_ads', 'meta', 'seo', 'email', 'other'));

ALTER TABLE public.marketing_records
  ADD CONSTRAINT marketing_records_status_check
    CHECK (status IN ('active', 'paused', 'completed', 'archived'));

CREATE INDEX marketing_records_customer_id_idx
  ON public.marketing_records (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX marketing_records_customer_email_idx
  ON public.marketing_records (customer_email) WHERE customer_email IS NOT NULL;

CREATE INDEX marketing_records_lead_id_idx
  ON public.marketing_records (lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX marketing_records_status_idx
  ON public.marketing_records (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_records TO authenticated;
GRANT ALL ON public.marketing_records TO service_role;

CREATE TRIGGER trg_marketing_records_updated
  BEFORE UPDATE ON public.marketing_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.marketing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketing_records" ON public.marketing_records
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
