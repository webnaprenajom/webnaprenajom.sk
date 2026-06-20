-- Batch F1: canonical customers table + nullable customer_id FKs

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  display_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customers IS 'Canonical CRM customer — email normalized lowercase when present';
COMMENT ON COLUMN public.customers.email IS 'Normalized lowercase email; nullable for name-only records during rollout';

CREATE UNIQUE INDEX customers_email_unique_idx
  ON public.customers (email)
  WHERE email IS NOT NULL;

CREATE INDEX customers_display_name_idx
  ON public.customers (lower(display_name));

CREATE TRIGGER trg_customers_updated
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Nullable customer_id rollout columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.rental_websites
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.hosting_records
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_customer_id_idx
  ON public.leads (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_notes_customer_id_idx
  ON public.project_notes (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rental_websites_customer_id_idx
  ON public.rental_websites (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS hosting_records_customer_id_idx
  ON public.hosting_records (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commissions_customer_id_idx
  ON public.commissions (customer_id) WHERE customer_id IS NOT NULL;
