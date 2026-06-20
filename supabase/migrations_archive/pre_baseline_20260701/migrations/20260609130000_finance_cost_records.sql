-- Phase 2C: canonical cost/outflow records (additive, non-destructive)

CREATE TABLE public.cost_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table TEXT,
  source_id TEXT,
  category TEXT,
  vendor TEXT,
  client_name TEXT,
  rental_website_id UUID REFERENCES public.rental_websites(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  paid_at TIMESTAMPTZ,
  incurred_at TIMESTAMPTZ,
  reference TEXT,
  note TEXT,
  truth_level TEXT NOT NULL DEFAULT 'legacy_import'
    CHECK (truth_level IN ('cost_fact', 'legacy_import')),
  imported_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (paid_at IS NOT NULL OR incurred_at IS NOT NULL)
);

CREATE UNIQUE INDEX cost_records_source_uidx
  ON public.cost_records (source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX cost_records_paid_at_idx ON public.cost_records (paid_at DESC);
CREATE INDEX cost_records_incurred_at_idx ON public.cost_records (incurred_at DESC);
CREATE INDEX cost_records_rental_website_idx ON public.cost_records (rental_website_id);

CREATE TRIGGER trg_cost_records_updated
  BEFORE UPDATE ON public.cost_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cost_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view cost_records" ON public.cost_records
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert cost_records" ON public.cost_records
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update cost_records" ON public.cost_records
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete cost_records" ON public.cost_records
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Legacy backfill: expenses.payment_status='paid' with amount > 0
-- Symmetric to payout_records ← commissions; paid_at is estimated from date
-- ---------------------------------------------------------------------------
INSERT INTO public.cost_records (
  source_table, source_id, category,
  amount, currency, incurred_at, paid_at, note,
  truth_level, imported_from, created_at, updated_at
)
SELECT
  'expenses',
  e.id::text,
  e.category,
  e.amount,
  'EUR',
  (e.date::timestamp AT TIME ZONE 'UTC') + interval '12 hours',
  (e.date::timestamp AT TIME ZONE 'UTC') + interval '12 hours',
  trim(format('%s%s', e.title, CASE WHEN e.note IS NOT NULL AND e.note <> '' THEN ' — ' || e.note ELSE '' END)),
  'legacy_import',
  'expenses.payment_status=paid',
  e.created_at,
  e.updated_at
FROM public.expenses e
WHERE e.payment_status = 'paid'
  AND COALESCE(e.amount, 0) > 0
ON CONFLICT (source_table, source_id) WHERE source_table IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;
