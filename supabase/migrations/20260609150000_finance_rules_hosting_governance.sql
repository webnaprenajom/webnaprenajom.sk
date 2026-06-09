-- Phase 2F: commission rules, hosting foundation, review governance (additive)

CREATE TABLE public.commission_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  revenue_stream_kind TEXT NOT NULL
    CHECK (revenue_stream_kind IN ('rental', 'project', 'hosting', 'other_fee')),
  default_rate NUMERIC NOT NULL DEFAULT 0 CHECK (default_rate >= 0 AND default_rate <= 100),
  implementer TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_rule_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  customer_email TEXT,
  client_name TEXT,
  rental_website_id UUID REFERENCES public.rental_websites(id) ON DELETE SET NULL,
  revenue_stream_kind TEXT
    CHECK (revenue_stream_kind IS NULL OR revenue_stream_kind IN ('rental', 'project', 'hosting', 'other_fee')),
  override_rate NUMERIC NOT NULL CHECK (override_rate >= 0 AND override_rate <= 100),
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hosting_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT,
  client_name TEXT,
  rental_website_id UUID REFERENCES public.rental_websites(id) ON DELETE SET NULL,
  provider TEXT,
  domains_count INTEGER,
  monthly_price NUMERIC,
  yearly_price NUMERIC,
  acquired_by TEXT,
  commissionable BOOLEAN NOT NULL DEFAULT false,
  commission_rule_override_id UUID REFERENCES public.commission_rule_overrides(id) ON DELETE SET NULL,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_review_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_key TEXT NOT NULL UNIQUE,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('dismissed_issue', 'commission_override', 'hosting_commissionable', 'settlement_warning')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'still_valid', 'reopened')),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_policy_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_key TEXT NOT NULL UNIQUE,
  policy_value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_active_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX commission_rules_stream_idx ON public.commission_rules (revenue_stream_kind) WHERE active = true;
CREATE INDEX commission_rule_overrides_client_idx ON public.commission_rule_overrides (client_name);
CREATE INDEX commission_rule_overrides_email_idx ON public.commission_rule_overrides (customer_email);
CREATE INDEX hosting_records_active_idx ON public.hosting_records (active);
CREATE INDEX finance_review_items_status_idx ON public.finance_review_items (status);

CREATE TRIGGER trg_commission_rules_updated
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_commission_rule_overrides_updated
  BEFORE UPDATE ON public.commission_rule_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hosting_records_updated
  BEFORE UPDATE ON public.hosting_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_finance_review_items_updated
  BEFORE UPDATE ON public.finance_review_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_finance_policy_settings_updated
  BEFORE UPDATE ON public.finance_policy_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_policy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission_rules" ON public.commission_rules
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage commission_rule_overrides" ON public.commission_rule_overrides
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage hosting_records" ON public.hosting_records
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage finance_review_items" ON public.finance_review_items
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage finance_policy_settings" ON public.finance_policy_settings
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Default rules (implementer share % — matches rental_websites.implementers JSON convention)
INSERT INTO public.commission_rules (name, revenue_stream_kind, default_rate, note) VALUES
  ('Prenájom — default implementér podiel', 'rental', 30,
   'Foundation only. Aktuálne split je stále v rental_websites.implementers JSON — tento rule je referenčný default.'),
  ('Projekt — default', 'project', 30, 'Manuálne provízie v commissions module.'),
  ('Hosting — default', 'hosting', 0, 'Hosting bez provízie, kým hosting_record.commissionable = true.'),
  ('Ostatný poplatok', 'other_fee', 0, 'Jednorazové poplatky mimo rental/hosting.');

-- Payout timing policies (documented, not enforced)
INSERT INTO public.finance_policy_settings (policy_key, policy_value, label, description, is_active_default) VALUES
  ('payout_on_paid_fact', 'available', 'Výplata pri confirmed payment/payout fact',
   'Odporúčaná politika pre auditovateľné výplaty.', false),
  ('payout_on_month_close', 'available', 'Výplata po uzavretí mesiaca',
   'Settlement draft review na konci obdobia.', false),
  ('payout_on_manual_approval', 'active', 'Výplata po manuálnom schválení',
   'Aktuálny CRM default: settlement draft + batch/review confirm.', true);
