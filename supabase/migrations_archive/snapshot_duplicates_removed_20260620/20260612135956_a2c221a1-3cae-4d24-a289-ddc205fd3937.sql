
-- =====================================================================
-- 20260609120000_finance_payment_payout_records
-- =====================================================================
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT ALL ON public.payment_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_records TO authenticated;
GRANT ALL ON public.payout_records TO service_role;

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

CREATE TRIGGER trg_payment_records_updated BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payout_records_updated BEFORE UPDATE ON public.payout_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view payment_records" ON public.payment_records FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert payment_records" ON public.payment_records FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update payment_records" ON public.payment_records FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete payment_records" ON public.payment_records FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins view payout_records" ON public.payout_records FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert payout_records" ON public.payout_records FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update payout_records" ON public.payout_records FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete payout_records" ON public.payout_records FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.payment_records (source_table, source_id, rental_website_id, client_name, amount, currency, paid_at, note, truth_level, imported_from, created_at, updated_at)
SELECT 'rental_payments', rp.id::text, rp.website_id, rw.client_name, rp.amount, 'EUR',
  COALESCE(rp.paid_at, rp.updated_at, rp.created_at),
  format('Legacy import: prenájom mesiac %s/%s (bez bankovej referencie)', rp.month, rp.year),
  'legacy_import', 'rental_payments.status=paid', rp.created_at, rp.updated_at
FROM public.rental_payments rp
LEFT JOIN public.rental_websites rw ON rw.id = rp.website_id
WHERE rp.status = 'paid' AND COALESCE(rp.amount, 0) > 0
ON CONFLICT (source_table, source_id) WHERE source_table IS NOT NULL AND source_id IS NOT NULL DO NOTHING;

INSERT INTO public.payout_records (source_table, source_id, implementer, amount, currency, paid_at, note, truth_level, imported_from, created_at, updated_at)
SELECT 'commissions', c.id::text, c.implementer, c.amount, 'EUR',
  (c.date::timestamp AT TIME ZONE 'UTC') + interval '12 hours',
  COALESCE(c.note, 'Legacy import: označ. vyplatené bez bankovej referencie'),
  'legacy_import', 'commissions.payment_status=paid', c.created_at, c.updated_at
FROM public.commissions c
WHERE c.payment_status = 'paid' AND COALESCE(c.amount, 0) > 0
ON CONFLICT (source_table, source_id) WHERE source_table IS NOT NULL AND source_id IS NOT NULL DO NOTHING;

-- =====================================================================
-- 20260609130000_finance_cost_records
-- =====================================================================
CREATE TABLE public.cost_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table TEXT, source_id TEXT, category TEXT, vendor TEXT, client_name TEXT,
  rental_website_id UUID REFERENCES public.rental_websites(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  paid_at TIMESTAMPTZ, incurred_at TIMESTAMPTZ, reference TEXT, note TEXT,
  truth_level TEXT NOT NULL DEFAULT 'legacy_import' CHECK (truth_level IN ('cost_fact', 'legacy_import')),
  imported_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (paid_at IS NOT NULL OR incurred_at IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_records TO authenticated;
GRANT ALL ON public.cost_records TO service_role;

CREATE UNIQUE INDEX cost_records_source_uidx ON public.cost_records (source_table, source_id) WHERE source_table IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX cost_records_paid_at_idx ON public.cost_records (paid_at DESC);
CREATE INDEX cost_records_incurred_at_idx ON public.cost_records (incurred_at DESC);
CREATE INDEX cost_records_rental_website_idx ON public.cost_records (rental_website_id);

CREATE TRIGGER trg_cost_records_updated BEFORE UPDATE ON public.cost_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.cost_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view cost_records" ON public.cost_records FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert cost_records" ON public.cost_records FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update cost_records" ON public.cost_records FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete cost_records" ON public.cost_records FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.cost_records (source_table, source_id, category, amount, currency, incurred_at, paid_at, note, truth_level, imported_from, created_at, updated_at)
SELECT 'expenses', e.id::text, e.category, e.amount, 'EUR',
  (e.date::timestamp AT TIME ZONE 'UTC') + interval '12 hours',
  (e.date::timestamp AT TIME ZONE 'UTC') + interval '12 hours',
  trim(format('%s%s', e.title, CASE WHEN e.note IS NOT NULL AND e.note <> '' THEN ' — ' || e.note ELSE '' END)),
  'legacy_import', 'expenses.payment_status=paid', e.created_at, e.updated_at
FROM public.expenses e
WHERE e.payment_status = 'paid' AND COALESCE(e.amount, 0) > 0
ON CONFLICT (source_table, source_id) WHERE source_table IS NOT NULL AND source_id IS NOT NULL DO NOTHING;

-- =====================================================================
-- 20260609140000_finance_issue_dismissals
-- =====================================================================
CREATE TABLE public.finance_issue_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_key TEXT NOT NULL UNIQUE,
  issue_type TEXT NOT NULL,
  dismissal_type TEXT NOT NULL DEFAULT 'dismissed' CHECK (dismissal_type IN ('dismissed', 'false_positive')),
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_issue_dismissals TO authenticated;
GRANT ALL ON public.finance_issue_dismissals TO service_role;
CREATE INDEX finance_issue_dismissals_type_idx ON public.finance_issue_dismissals (issue_type);
CREATE INDEX finance_issue_dismissals_created_at_idx ON public.finance_issue_dismissals (created_at DESC);
ALTER TABLE public.finance_issue_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view finance_issue_dismissals" ON public.finance_issue_dismissals FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert finance_issue_dismissals" ON public.finance_issue_dismissals FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete finance_issue_dismissals" ON public.finance_issue_dismissals FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================================
-- 20260609150000_finance_rules_hosting_governance
-- =====================================================================
CREATE TABLE public.commission_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  revenue_stream_kind TEXT NOT NULL CHECK (revenue_stream_kind IN ('rental', 'project', 'hosting', 'other_fee')),
  default_rate NUMERIC NOT NULL DEFAULT 0 CHECK (default_rate >= 0 AND default_rate <= 100),
  implementer TEXT, active BOOLEAN NOT NULL DEFAULT true, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.commission_rule_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  customer_email TEXT, client_name TEXT,
  rental_website_id UUID REFERENCES public.rental_websites(id) ON DELETE SET NULL,
  revenue_stream_kind TEXT CHECK (revenue_stream_kind IS NULL OR revenue_stream_kind IN ('rental', 'project', 'hosting', 'other_fee')),
  override_rate NUMERIC NOT NULL CHECK (override_rate >= 0 AND override_rate <= 100),
  reason TEXT, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.hosting_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT, client_name TEXT,
  rental_website_id UUID REFERENCES public.rental_websites(id) ON DELETE SET NULL,
  provider TEXT, domains_count INTEGER, monthly_price NUMERIC, yearly_price NUMERIC,
  acquired_by TEXT, commissionable BOOLEAN NOT NULL DEFAULT false,
  commission_rule_override_id UUID REFERENCES public.commission_rule_overrides(id) ON DELETE SET NULL,
  note TEXT, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.finance_review_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_key TEXT NOT NULL UNIQUE,
  item_type TEXT NOT NULL CHECK (item_type IN ('dismissed_issue', 'commission_override', 'hosting_commissionable', 'settlement_warning')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'still_valid', 'reopened')),
  review_note TEXT, reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.finance_policy_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_key TEXT NOT NULL UNIQUE,
  policy_value TEXT NOT NULL, label TEXT NOT NULL, description TEXT,
  is_active_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rule_overrides TO authenticated;
GRANT ALL ON public.commission_rule_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_records TO authenticated;
GRANT ALL ON public.hosting_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_review_items TO authenticated;
GRANT ALL ON public.finance_review_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_policy_settings TO authenticated;
GRANT ALL ON public.finance_policy_settings TO service_role;

CREATE INDEX commission_rules_stream_idx ON public.commission_rules (revenue_stream_kind) WHERE active = true;
CREATE INDEX commission_rule_overrides_client_idx ON public.commission_rule_overrides (client_name);
CREATE INDEX commission_rule_overrides_email_idx ON public.commission_rule_overrides (customer_email);
CREATE INDEX hosting_records_active_idx ON public.hosting_records (active);
CREATE INDEX finance_review_items_status_idx ON public.finance_review_items (status);

CREATE TRIGGER trg_commission_rules_updated BEFORE UPDATE ON public.commission_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_commission_rule_overrides_updated BEFORE UPDATE ON public.commission_rule_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hosting_records_updated BEFORE UPDATE ON public.hosting_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_finance_review_items_updated BEFORE UPDATE ON public.finance_review_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_finance_policy_settings_updated BEFORE UPDATE ON public.finance_policy_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_policy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission_rules" ON public.commission_rules FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage commission_rule_overrides" ON public.commission_rule_overrides FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage hosting_records" ON public.hosting_records FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage finance_review_items" ON public.finance_review_items FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage finance_policy_settings" ON public.finance_policy_settings FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.commission_rules (name, revenue_stream_kind, default_rate, note) VALUES
  ('Prenájom — default implementér podiel', 'rental', 30, 'Foundation only. Aktuálne split je stále v rental_websites.implementers JSON — tento rule je referenčný default.'),
  ('Projekt — default', 'project', 30, 'Manuálne provízie v commissions module.'),
  ('Hosting — default', 'hosting', 0, 'Hosting bez provízie, kým hosting_record.commissionable = true.'),
  ('Ostatný poplatok', 'other_fee', 0, 'Jednorazové poplatky mimo rental/hosting.');

INSERT INTO public.finance_policy_settings (policy_key, policy_value, label, description, is_active_default) VALUES
  ('payout_on_paid_fact', 'available', 'Výplata pri confirmed payment/payout fact', 'Odporúčaná politika pre auditovateľné výplaty.', false),
  ('payout_on_month_close', 'available', 'Výplata po uzavretí mesiaca', 'Settlement draft review na konci obdobia.', false),
  ('payout_on_manual_approval', 'active', 'Výplata po manuálnom schválení', 'Aktuálny CRM default: settlement draft + batch/review confirm.', true);

-- =====================================================================
-- 20260609160000_finance_review_cadence
-- =====================================================================
ALTER TABLE public.finance_review_items
  ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_cadence_days INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
CREATE INDEX finance_review_items_due_at_idx ON public.finance_review_items (review_due_at) WHERE review_due_at IS NOT NULL;

-- =====================================================================
-- 20260610120000_commissions_payment_form
-- =====================================================================
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS payment_form TEXT
    CHECK (payment_form IS NULL OR payment_form IN ('cash', 'iban', 'crypto', 'faktura', 'ine'));

-- =====================================================================
-- 20260610130000_entity_linking_batch_e
-- =====================================================================
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IS NULL OR source_type IN ('project', 'rental', 'hosting', 'other')),
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IS NULL OR project_type IN ('wordpress', 'shoptet', 'custom', 'other')),
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS lead_id UUID;

CREATE INDEX IF NOT EXISTS commissions_source_idx ON public.commissions (source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commissions_customer_email_idx ON public.commissions (customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_notes_customer_email_idx ON public.project_notes (customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_notes_lead_id_idx ON public.project_notes (lead_id) WHERE lead_id IS NOT NULL;

-- =====================================================================
-- 20260611100000_customers_foundation
-- =====================================================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT, display_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
COMMENT ON TABLE public.customers IS 'Canonical CRM customer — email normalized lowercase when present';
CREATE UNIQUE INDEX customers_email_unique_idx ON public.customers (email) WHERE email IS NOT NULL;
CREATE INDEX customers_display_name_idx ON public.customers (lower(display_name));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage customers" ON public.customers FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.project_notes ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.rental_websites ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.hosting_records ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_customer_id_idx ON public.leads (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_notes_customer_id_idx ON public.project_notes (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rental_websites_customer_id_idx ON public.rental_websites (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hosting_records_customer_id_idx ON public.hosting_records (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commissions_customer_id_idx ON public.commissions (customer_id) WHERE customer_id IS NOT NULL;

-- =====================================================================
-- 20260611100100_customers_email_backfill
-- =====================================================================
INSERT INTO public.customers (email, display_name, metadata)
SELECT DISTINCT ON (src.email_norm)
  src.email_norm, src.display_name,
  jsonb_build_object('backfill_batch', 'F1', 'backfill_source', src.source_table, 'backfill_at', now())
FROM (
  SELECT lower(trim(email)) AS email_norm, trim(name) AS display_name, 'leads' AS source_table, created_at
  FROM public.leads WHERE email IS NOT NULL AND trim(email) <> '' AND email LIKE '%@%'
  UNION ALL
  SELECT lower(trim(email)), coalesce(nullif(trim(client_name), ''), split_part(lower(trim(email)), '@', 1)), 'order_signatures', coalesce(signed_at, created_at)
  FROM public.order_signatures WHERE email IS NOT NULL AND trim(email) <> '' AND email LIKE '%@%'
  UNION ALL
  SELECT lower(trim(customer_email)), coalesce(nullif(trim(client_name), ''), split_part(lower(trim(customer_email)), '@', 1)), 'project_notes', updated_at
  FROM public.project_notes WHERE customer_email IS NOT NULL AND trim(customer_email) <> '' AND customer_email LIKE '%@%'
  UNION ALL
  SELECT lower(trim(customer_email)), coalesce(nullif(trim(client_name), ''), split_part(lower(trim(customer_email)), '@', 1)), 'hosting_records', created_at
  FROM public.hosting_records WHERE customer_email IS NOT NULL AND trim(customer_email) <> '' AND customer_email LIKE '%@%'
  UNION ALL
  SELECT lower(trim(customer_email)), coalesce(nullif(trim(title), ''), split_part(lower(trim(customer_email)), '@', 1)), 'commissions', (date::timestamptz)
  FROM public.commissions WHERE customer_email IS NOT NULL AND trim(customer_email) <> '' AND customer_email LIKE '%@%'
  UNION ALL
  SELECT lower(trim(email)), coalesce(nullif(trim(client_name), ''), split_part(lower(trim(email)), '@', 1)), 'design_proposals', (sent_date::timestamptz)
  FROM public.design_proposals WHERE email IS NOT NULL AND trim(email) <> '' AND email LIKE '%@%'
) src
WHERE src.email_norm IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.email = src.email_norm)
ORDER BY src.email_norm, src.created_at DESC;

UPDATE public.customers c SET display_name = sub.display_name
FROM (
  SELECT DISTINCT ON (lower(trim(l.email))) lower(trim(l.email)) AS email_norm, trim(l.name) AS display_name
  FROM public.leads l WHERE l.email IS NOT NULL AND trim(l.email) <> ''
  ORDER BY lower(trim(l.email)), l.created_at ASC
) sub
WHERE c.email = sub.email_norm AND (c.display_name IS NULL OR c.display_name = split_part(c.email, '@', 1));

UPDATE public.leads l SET customer_id = c.id FROM public.customers c
WHERE l.customer_id IS NULL AND c.email = lower(trim(l.email)) AND l.email IS NOT NULL AND trim(l.email) <> '';
UPDATE public.project_notes pn SET customer_id = c.id FROM public.customers c
WHERE pn.customer_id IS NULL AND c.email = lower(trim(pn.customer_email)) AND pn.customer_email IS NOT NULL AND trim(pn.customer_email) <> '';
UPDATE public.hosting_records hr SET customer_id = c.id FROM public.customers c
WHERE hr.customer_id IS NULL AND c.email = lower(trim(hr.customer_email)) AND hr.customer_email IS NOT NULL AND trim(hr.customer_email) <> '';
UPDATE public.commissions cm SET customer_id = c.id FROM public.customers c
WHERE cm.customer_id IS NULL AND c.email = lower(trim(cm.customer_email)) AND cm.customer_email IS NOT NULL AND trim(cm.customer_email) <> '';

-- =====================================================================
-- 20260611120000_communication_events_f2
-- =====================================================================
CREATE TABLE public.communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('email_out','note','status_change','payment','commission','project_event','rental_event','hosting_event')),
  title TEXT NOT NULL, body_preview TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_table TEXT, source_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_events TO authenticated;
GRANT ALL ON public.communication_events TO service_role;
COMMENT ON TABLE public.communication_events IS 'Persistent customer communication & activity log (Batch F2)';
CREATE INDEX communication_events_customer_id_idx ON public.communication_events (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX communication_events_customer_email_idx ON public.communication_events (customer_email) WHERE customer_email IS NOT NULL;
CREATE INDEX communication_events_kind_idx ON public.communication_events (kind);
CREATE INDEX communication_events_occurred_at_idx ON public.communication_events (occurred_at DESC);
CREATE INDEX communication_events_source_idx ON public.communication_events (source_table, source_id) WHERE source_table IS NOT NULL AND source_id IS NOT NULL;
CREATE UNIQUE INDEX communication_events_resend_id_unique ON public.communication_events ((metadata->>'resend_id')) WHERE kind = 'email_out' AND (metadata->>'resend_id') IS NOT NULL;
CREATE TRIGGER trg_communication_events_updated BEFORE UPDATE ON public.communication_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage communication_events" ON public.communication_events FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================================
-- 20260611140000_communication_events_f25_hardening
-- =====================================================================
CREATE UNIQUE INDEX communication_events_idempotency_key_unique
  ON public.communication_events ((metadata->>'idempotency_key'))
  WHERE (metadata->>'idempotency_key') IS NOT NULL;

-- =====================================================================
-- 20260611150000_inbound_email_batch_g
-- =====================================================================
ALTER TABLE public.communication_events DROP CONSTRAINT IF EXISTS communication_events_kind_check;
ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_kind_check
  CHECK (kind IN ('email_out','email_in','note','status_change','payment','commission','project_event','rental_event','hosting_event'));
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS thread_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT;
CREATE INDEX IF NOT EXISTS communication_events_thread_id_idx ON public.communication_events (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS communication_events_sender_email_idx ON public.communication_events (sender_email) WHERE sender_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS communication_events_message_id_idx ON public.communication_events (message_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS communication_events_inbound_provider_id_unique
  ON public.communication_events ((metadata->>'provider_email_id'))
  WHERE kind = 'email_in' AND (metadata->>'provider_email_id') IS NOT NULL;

-- =====================================================================
-- 20260611160000_communication_ops_g5
-- =====================================================================
CREATE TABLE public.communication_webhook_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type TEXT NOT NULL CHECK (incident_type IN ('verify_failed','fetch_failed','malformed','insert_failed','deduped_inbound')),
  provider_email_id TEXT, sender_email TEXT, customer_email TEXT,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_webhook_incidents TO authenticated;
GRANT ALL ON public.communication_webhook_incidents TO service_role;
CREATE INDEX communication_webhook_incidents_type_idx ON public.communication_webhook_incidents (incident_type, occurred_at DESC);
CREATE INDEX communication_webhook_incidents_occurred_at_idx ON public.communication_webhook_incidents (occurred_at DESC);
ALTER TABLE public.communication_webhook_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage communication_webhook_incidents" ON public.communication_webhook_incidents FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================================
-- 20260611170000_tasks_customer_id_batch_i
-- =====================================================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_customer_id_idx ON public.tasks (customer_id) WHERE customer_id IS NOT NULL;
UPDATE public.tasks t SET customer_id = l.customer_id
FROM public.leads l
WHERE t.lead_id = l.id AND t.customer_id IS NULL AND l.customer_id IS NOT NULL;

-- =====================================================================
-- 20260612000000_rc2_project_ai_type
-- =====================================================================
ALTER TABLE public.project_notes DROP CONSTRAINT IF EXISTS project_notes_project_type_check;
ALTER TABLE public.project_notes ADD CONSTRAINT project_notes_project_type_check
  CHECK (project_type IS NULL OR project_type IN ('wordpress', 'shoptet', 'custom', 'other', 'ai'));

-- =====================================================================
-- Reload PostgREST schema cache
-- =====================================================================
NOTIFY pgrst, 'reload schema';
