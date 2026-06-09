-- Phase 2B: canonical payment/payout facts (additive, non-destructive)

CREATE TABLE public.payment_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table TEXT,
  source_id TEXT,
  customer_email TEXT,
  client_name TEXT,
  rental_website_id UUID REFERENCES public.rental_websites(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  paid_at TIMESTAMPTZ NOT NULL,
  method TEXT,
  reference TEXT,
  note TEXT,
  truth_level TEXT NOT NULL DEFAULT 'legacy_import'
    CHECK (truth_level IN ('payment_fact', 'legacy_import')),
  imported_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payout_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table TEXT,
  source_id TEXT,
  implementer TEXT,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  paid_at TIMESTAMPTZ NOT NULL,
  reference TEXT,
  note TEXT,
  truth_level TEXT NOT NULL DEFAULT 'legacy_import'
    CHECK (truth_level IN ('payout_fact', 'legacy_import')),
  imported_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_records_source_uidx
  ON public.payment_records (source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

CREATE UNIQUE INDEX payout_records_source_uidx
  ON public.payout_records (source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX payment_records_paid_at_idx ON public.payment_records (paid_at DESC);
CREATE INDEX payment_records_rental_website_idx ON public.payment_records (rental_website_id);
CREATE INDEX payout_records_paid_at_idx ON public.payout_records (paid_at DESC);
CREATE INDEX payout_records_implementer_idx ON public.payout_records (implementer);

CREATE TRIGGER trg_payment_records_updated
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_payout_records_updated
  BEFORE UPDATE ON public.payout_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view payment_records" ON public.payment_records
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert payment_records" ON public.payment_records
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update payment_records" ON public.payment_records
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete payment_records" ON public.payment_records
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins view payout_records" ON public.payout_records
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert payout_records" ON public.payout_records
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update payout_records" ON public.payout_records
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete payout_records" ON public.payout_records
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Legacy backfill (idempotent via source unique indexes)
-- SAFE: rental_payments.status='paid' with amount > 0
-- ---------------------------------------------------------------------------
INSERT INTO public.payment_records (
  source_table, source_id, rental_website_id, client_name,
  amount, currency, paid_at, note, truth_level, imported_from, created_at, updated_at
)
SELECT
  'rental_payments',
  rp.id::text,
  rp.website_id,
  rw.client_name,
  rp.amount,
  'EUR',
  COALESCE(rp.paid_at, rp.updated_at, rp.created_at),
  format('Legacy import: prenájom mesiac %s/%s (bez bankovej referencie)', rp.month, rp.year),
  'legacy_import',
  'rental_payments.status=paid',
  rp.created_at,
  rp.updated_at
FROM public.rental_payments rp
LEFT JOIN public.rental_websites rw ON rw.id = rp.website_id
WHERE rp.status = 'paid'
  AND COALESCE(rp.amount, 0) > 0
ON CONFLICT (source_table, source_id) WHERE source_table IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

-- ---------------------------------------------------------------------------
-- SAFE: commissions.payment_status='paid' → payout_records (not payment_records)
-- paid_at = commission date at noon UTC when no timestamp exists
-- ---------------------------------------------------------------------------
INSERT INTO public.payout_records (
  source_table, source_id, implementer,
  amount, currency, paid_at, note, truth_level, imported_from, created_at, updated_at
)
SELECT
  'commissions',
  c.id::text,
  c.implementer,
  c.amount,
  'EUR',
  (c.date::timestamp AT TIME ZONE 'UTC') + interval '12 hours',
  COALESCE(c.note, 'Legacy import: označ. vyplatené bez bankovej referencie'),
  'legacy_import',
  'commissions.payment_status=paid',
  c.created_at,
  c.updated_at
FROM public.commissions c
WHERE c.payment_status = 'paid'
  AND COALESCE(c.amount, 0) > 0
ON CONFLICT (source_table, source_id) WHERE source_table IS NOT NULL AND source_id IS NOT NULL
DO NOTHING;

-- expenses.payment_status='paid' — NOT backfilled (outflow/cost; no cost_records yet)
