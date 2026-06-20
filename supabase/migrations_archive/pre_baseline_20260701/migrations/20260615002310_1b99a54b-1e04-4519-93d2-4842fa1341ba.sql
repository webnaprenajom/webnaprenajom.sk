-- =====================================================================
-- 20260618000000_legacy_import_staging
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.legacy_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key TEXT NOT NULL UNIQUE,
  source_env TEXT,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'dry_run')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_import_batches TO authenticated;
GRANT ALL ON public.legacy_import_batches TO service_role;

CREATE TABLE IF NOT EXISTS public.legacy_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.legacy_import_batches(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  row_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_file, legacy_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_import_rows TO authenticated;
GRANT ALL ON public.legacy_import_rows TO service_role;
CREATE INDEX IF NOT EXISTS legacy_import_rows_batch_idx ON public.legacy_import_rows (batch_id);
CREATE INDEX IF NOT EXISTS legacy_import_rows_source_idx ON public.legacy_import_rows (source_file);

CREATE TABLE IF NOT EXISTS public.legacy_id_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.legacy_import_batches(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  canonical_id UUID,
  match_method TEXT,
  confidence TEXT CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, legacy_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_id_map TO authenticated;
GRANT ALL ON public.legacy_id_map TO service_role;
CREATE INDEX IF NOT EXISTS legacy_id_map_canonical_idx ON public.legacy_id_map (entity_type, canonical_id) WHERE canonical_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.migration_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.legacy_import_batches(id) ON DELETE SET NULL,
  source_file TEXT,
  entity_type TEXT NOT NULL,
  legacy_id TEXT,
  reason TEXT NOT NULL,
  detail TEXT,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.migration_review_queue TO authenticated;
GRANT ALL ON public.migration_review_queue TO service_role;
CREATE INDEX IF NOT EXISTS migration_review_queue_status_idx ON public.migration_review_queue (status, created_at DESC);
CREATE INDEX IF NOT EXISTS migration_review_queue_batch_idx ON public.migration_review_queue (batch_id);

CREATE TABLE IF NOT EXISTS public.legacy_finance_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.legacy_import_batches(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  row_hash TEXT NOT NULL,
  linked_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  linked_rental_id UUID,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'matched', 'ignored', 'manual')),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_file, legacy_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_finance_staging TO authenticated;
GRANT ALL ON public.legacy_finance_staging TO service_role;
CREATE INDEX IF NOT EXISTS legacy_finance_staging_batch_idx ON public.legacy_finance_staging (batch_id);

CREATE TRIGGER trg_legacy_import_rows_updated BEFORE UPDATE ON public.legacy_import_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_legacy_id_map_updated BEFORE UPDATE ON public.legacy_id_map FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_legacy_finance_staging_updated BEFORE UPDATE ON public.legacy_finance_staging FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.legacy_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_finance_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage legacy_import_batches" ON public.legacy_import_batches FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage legacy_import_rows" ON public.legacy_import_rows FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage legacy_id_map" ON public.legacy_id_map FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage migration_review_queue" ON public.migration_review_queue FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage legacy_finance_staging" ON public.legacy_finance_staging FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================================
-- 20260619000000_destructive_delete_rpcs
-- =====================================================================
CREATE OR REPLACE FUNCTION private.assert_admin_destructive()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'insufficient_privileges'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.destructive_blocking_record(
  p_id uuid, p_record_type text, p_table_name text, p_label text, p_amount numeric, p_detail text, p_cta_path text
) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'id', p_id, 'record_type', p_record_type, 'table_name', p_table_name,
    'label', p_label, 'amount', COALESCE(p_amount, 0), 'detail', p_detail, 'cta_path', p_cta_path
  );
$$;

CREATE OR REPLACE FUNCTION private.precheck_hosting_delete(p_entity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hosting hosting_records%ROWTYPE;
  v_blocking jsonb := '[]'::jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_legacy_payments int;
BEGIN
  SELECT * INTO v_hosting FROM hosting_records WHERE id = p_entity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'entity_not_found'; END IF;

  SELECT COALESCE(jsonb_agg(private.destructive_blocking_record(
      pr.id, 'payment_fact', 'payment_records',
      'Platba ' || pr.amount::text || ' €', pr.amount,
      to_char(pr.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      '/admin/finance?advanced=1&legacy=payments')
  ), '[]'::jsonb) INTO v_blocking
  FROM payment_records pr
  WHERE pr.source_table = 'hosting_records' AND pr.source_id = p_entity_id::text AND pr.truth_level = 'payment_fact';

  SELECT COUNT(*) INTO v_legacy_payments FROM payment_records pr
  WHERE pr.source_table = 'hosting_records' AND pr.source_id = p_entity_id::text AND pr.truth_level = 'legacy_import';

  v_sections := jsonb_build_array(
    jsonb_build_object('label', 'Legacy platby hostingu', 'count', v_legacy_payments, 'action', 'delete'),
    jsonb_build_object('label', 'Hosting záznam', 'count', 1, 'action', 'delete')
  );

  RETURN jsonb_build_object(
    'entity_type', 'hosting', 'entity_id', p_entity_id,
    'entity_label', COALESCE(v_hosting.client_name, v_hosting.provider, 'Hosting'),
    'can_delete', jsonb_array_length(v_blocking) = 0,
    'block_reason', CASE WHEN jsonb_array_length(v_blocking) > 0
      THEN 'Hosting má potvrdené finančné platby (payment_fact). Najprv ich vyriešte vo Finance.' ELSE NULL END,
    'finance_critical', jsonb_array_length(v_blocking) > 0,
    'sections', v_sections,
    'warnings', CASE WHEN v_legacy_payments > 0
      THEN jsonb_build_array('Po zmazaní sa odstránia aj legacy import platby naviazané na tento hosting.')
      ELSE '[]'::jsonb END,
    'blocking_records', v_blocking,
    'cta_links', jsonb_build_array(
      jsonb_build_object('label', 'Finance — platby', 'path', '/admin/finance?advanced=1&legacy=payments'),
      jsonb_build_object('label', 'Hosting detail', 'path', '/admin/hosting/' || p_entity_id::text))
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.precheck_rental_website_delete(p_entity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rental rental_websites%ROWTYPE;
  v_blocking jsonb := '[]'::jsonb;
  v_payment_block jsonb; v_cost_block jsonb; v_payout_block jsonb;
  v_rp_count int; v_comm_count int; v_hosting_count int;
  v_legacy_pay int; v_legacy_cost int;
BEGIN
  SELECT * INTO v_rental FROM rental_websites WHERE id = p_entity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'entity_not_found'; END IF;

  SELECT COALESCE(jsonb_agg(private.destructive_blocking_record(
      pr.id, 'payment_fact', 'payment_records',
      'Platba ' || pr.amount::text || ' € · ' || COALESCE(v_rental.name, 'Prenájom'),
      pr.amount, to_char(pr.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      '/admin/finance?advanced=1&legacy=payments')
  ), '[]'::jsonb) INTO v_payment_block
  FROM payment_records pr WHERE pr.rental_website_id = p_entity_id AND pr.truth_level = 'payment_fact';

  SELECT COALESCE(jsonb_agg(private.destructive_blocking_record(
      cr.id, 'cost_fact', 'cost_records',
      'Náklad ' || cr.amount::text || ' € · ' || COALESCE(v_rental.name, 'Prenájom'),
      cr.amount,
      COALESCE(to_char(cr.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), to_char(cr.incurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '—'),
      '/admin/finance?advanced=1&legacy=costs')
  ), '[]'::jsonb) INTO v_cost_block
  FROM cost_records cr WHERE cr.rental_website_id = p_entity_id AND cr.truth_level = 'cost_fact';

  SELECT COALESCE(jsonb_agg(private.destructive_blocking_record(
      po.id, 'payout_fact', 'payout_records',
      'Výplata provízie ' || po.amount::text || ' € · ' || COALESCE(po.implementer, '—'),
      po.amount, to_char(po.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      '/admin/finance?advanced=1&legacy=payouts')
  ), '[]'::jsonb) INTO v_payout_block
  FROM payout_records po
  JOIN commissions c ON po.source_table = 'commissions' AND po.source_id = c.id::text
  WHERE c.source_type = 'rental' AND c.source_id = p_entity_id::text AND po.truth_level = 'payout_fact';

  v_blocking := v_payment_block || v_cost_block || v_payout_block;

  SELECT COUNT(*) INTO v_rp_count FROM rental_payments WHERE website_id = p_entity_id;
  SELECT COUNT(*) INTO v_comm_count FROM commissions WHERE source_type = 'rental' AND source_id = p_entity_id::text;
  SELECT COUNT(*) INTO v_hosting_count FROM hosting_records WHERE rental_website_id = p_entity_id;
  SELECT COUNT(*) INTO v_legacy_pay FROM payment_records WHERE rental_website_id = p_entity_id AND truth_level = 'legacy_import';
  SELECT COUNT(*) INTO v_legacy_cost FROM cost_records WHERE rental_website_id = p_entity_id AND truth_level = 'legacy_import';

  RETURN jsonb_build_object(
    'entity_type', 'rental_website', 'entity_id', p_entity_id,
    'entity_label', COALESCE(v_rental.name, v_rental.client_name, 'Prenájom'),
    'can_delete', jsonb_array_length(v_blocking) = 0,
    'block_reason', CASE WHEN jsonb_array_length(v_blocking) > 0
      THEN 'Prenájom má potvrdené finančné fakty. Najprv ich vyriešte vo Finance.' ELSE NULL END,
    'finance_critical', jsonb_array_length(v_blocking) > 0,
    'sections', jsonb_build_array(
      jsonb_build_object('label', 'Mesačné faktúry (rental_payments)', 'count', v_rp_count, 'action', 'delete'),
      jsonb_build_object('label', 'Legacy platby', 'count', v_legacy_pay, 'action', 'delete'),
      jsonb_build_object('label', 'Legacy náklady', 'count', v_legacy_cost, 'action', 'delete'),
      jsonb_build_object('label', 'Provízie (odpojí sa)', 'count', v_comm_count, 'action', 'detach'),
      jsonb_build_object('label', 'Hosting väzby (odpojí sa)', 'count', v_hosting_count, 'action', 'detach'),
      jsonb_build_object('label', 'Prenájom webu', 'count', 1, 'action', 'delete')
    ),
    'warnings', CASE WHEN v_comm_count > 0 OR v_hosting_count > 0
      THEN jsonb_build_array('Provízie a hosting zostanú v systéme, ale stratia väzbu na tento prenájom.')
      ELSE '[]'::jsonb END,
    'blocking_records', v_blocking,
    'cta_links', jsonb_build_array(
      jsonb_build_object('label', 'Finance — platby', 'path', '/admin/finance?advanced=1&legacy=payments'),
      jsonb_build_object('label', 'Finance — náklady', 'path', '/admin/finance?advanced=1&legacy=costs'),
      jsonb_build_object('label', 'Prenájmy', 'path', '/admin/rentals'),
      jsonb_build_object('label', 'Provízie', 'path', '/admin/commissions'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.precheck_customer_delete(p_entity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer customers%ROWTYPE;
  v_email text;
  v_rental_ids uuid[];
  v_blocking jsonb := '[]'::jsonb;
  v_pay_block jsonb; v_cost_block jsonb; v_payout_block jsonb; v_host_pay_block jsonb;
BEGIN
  SELECT * INTO v_customer FROM customers WHERE id = p_entity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'entity_not_found'; END IF;

  v_email := lower(trim(COALESCE(v_customer.email, '')));

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_rental_ids
  FROM rental_websites rw
  WHERE rw.customer_id = p_entity_id
     OR (v_email <> '' AND lower(trim(COALESCE(rw.customer_email, ''))) = v_email);

  SELECT COALESCE(jsonb_agg(sub.rec), '[]'::jsonb) INTO v_pay_block FROM (
    SELECT private.destructive_blocking_record(
      pr.id, 'payment_fact', 'payment_records',
      'Platba ' || pr.amount::text || ' €', pr.amount,
      to_char(pr.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      '/admin/finance?advanced=1&legacy=payments') AS rec
    FROM payment_records pr
    WHERE pr.truth_level = 'payment_fact'
      AND ((v_email <> '' AND lower(trim(COALESCE(pr.customer_email, ''))) = v_email)
        OR (cardinality(v_rental_ids) > 0 AND pr.rental_website_id = ANY(v_rental_ids)))
  ) sub;

  SELECT COALESCE(jsonb_agg(sub.rec), '[]'::jsonb) INTO v_cost_block FROM (
    SELECT private.destructive_blocking_record(
      cr.id, 'cost_fact', 'cost_records',
      'Náklad ' || cr.amount::text || ' €', cr.amount,
      COALESCE(to_char(cr.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '—'),
      '/admin/finance?advanced=1&legacy=costs') AS rec
    FROM cost_records cr
    WHERE cr.truth_level = 'cost_fact'
      AND cardinality(v_rental_ids) > 0
      AND cr.rental_website_id = ANY(v_rental_ids)
  ) sub;

  SELECT COALESCE(jsonb_agg(sub.rec), '[]'::jsonb) INTO v_payout_block FROM (
    SELECT private.destructive_blocking_record(
      po.id, 'payout_fact', 'payout_records',
      'Výplata ' || po.amount::text || ' € · ' || COALESCE(c.title, 'Provízia'),
      po.amount, to_char(po.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      '/admin/finance?advanced=1&legacy=payouts') AS rec
    FROM payout_records po
    JOIN commissions c ON po.source_table = 'commissions' AND po.source_id = c.id::text
    WHERE po.truth_level = 'payout_fact'
      AND (c.customer_id = p_entity_id
        OR (v_email <> '' AND lower(trim(COALESCE(c.customer_email, ''))) = v_email))
  ) sub;

  SELECT COALESCE(jsonb_agg(sub.rec), '[]'::jsonb) INTO v_host_pay_block FROM (
    SELECT private.destructive_blocking_record(
      pr.id, 'payment_fact', 'payment_records',
      'Hosting platba ' || pr.amount::text || ' €', pr.amount,
      to_char(pr.paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      '/admin/finance?advanced=1&legacy=payments') AS rec
    FROM payment_records pr
    JOIN hosting_records h ON pr.source_table = 'hosting_records' AND pr.source_id = h.id::text
    WHERE pr.truth_level = 'payment_fact'
      AND (h.customer_id = p_entity_id
        OR (v_email <> '' AND lower(trim(COALESCE(h.customer_email, ''))) = v_email))
  ) sub;

  v_blocking := v_pay_block || v_cost_block || v_payout_block || v_host_pay_block;

  RETURN jsonb_build_object(
    'entity_type', 'customer', 'entity_id', p_entity_id,
    'entity_label', COALESCE(v_customer.display_name, v_customer.email, 'Klient'),
    'can_delete', jsonb_array_length(v_blocking) = 0,
    'block_reason', CASE WHEN jsonb_array_length(v_blocking) > 0
      THEN 'Klient má potvrdené finančné fakty. Najprv ich vyriešte vo Finance.' ELSE NULL END,
    'finance_critical', jsonb_array_length(v_blocking) > 0,
    'sections', jsonb_build_array(
      jsonb_build_object('label', 'Leady (odpojí customer_id)', 'count', (SELECT COUNT(*) FROM leads WHERE customer_id = p_entity_id), 'action', 'detach'),
      jsonb_build_object('label', 'Úlohy (odpojí customer_id)', 'count', (SELECT COUNT(*) FROM tasks WHERE customer_id = p_entity_id), 'action', 'detach'),
      jsonb_build_object('label', 'Projekty (odpojí customer_id)', 'count', (SELECT COUNT(*) FROM project_notes WHERE customer_id = p_entity_id), 'action', 'detach'),
      jsonb_build_object('label', 'Prenájmy (odpojí customer_id)', 'count', (SELECT COUNT(*) FROM rental_websites WHERE customer_id = p_entity_id), 'action', 'detach'),
      jsonb_build_object('label', 'Hosting (odpojí customer_id)', 'count', (SELECT COUNT(*) FROM hosting_records WHERE customer_id = p_entity_id), 'action', 'detach'),
      jsonb_build_object('label', 'Provízie (odpojí customer_id)', 'count', (SELECT COUNT(*) FROM commissions WHERE customer_id = p_entity_id), 'action', 'detach'),
      jsonb_build_object('label', 'Komunikácia (odpojí customer_id)', 'count', (SELECT COUNT(*) FROM communication_events WHERE customer_id = p_entity_id), 'action', 'detach'),
      jsonb_build_object('label', 'Komunikačný súhrn', 'count', 1, 'action', 'delete'),
      jsonb_build_object('label', 'Canonical klient', 'count', 1, 'action', 'delete')
    ),
    'warnings', jsonb_build_array(
      'CRM záznamy zostanú v systéme, ale stratia prepojenie customer_id (heuristický pohľad podľa e-mailu/mena ostáva).',
      'Pred zmazaním odporúčame skontrolovať aktívne prenájmy a hosting.'
    ),
    'blocking_records', v_blocking,
    'cta_links', jsonb_build_array(
      jsonb_build_object('label', 'Finance — platby', 'path', '/admin/finance?advanced=1&legacy=payments'),
      jsonb_build_object('label', 'Finance — náklady', 'path', '/admin/finance?advanced=1&legacy=costs'),
      jsonb_build_object('label', 'Finance — výplaty', 'path', '/admin/finance?advanced=1&legacy=payouts'),
      jsonb_build_object('label', 'Klientsky hub', 'path', '/admin/customers/' || p_entity_id::text),
      jsonb_build_object('label', 'Hosting', 'path', '/admin/hosting'),
      jsonb_build_object('label', 'Prenájmy', 'path', '/admin/rentals'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_precheck_destructive_delete(p_entity_type text, p_entity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.assert_admin_destructive();
  CASE p_entity_type
    WHEN 'hosting' THEN RETURN private.precheck_hosting_delete(p_entity_id);
    WHEN 'rental_website' THEN RETURN private.precheck_rental_website_delete(p_entity_id);
    WHEN 'customer' THEN RETURN private.precheck_customer_delete(p_entity_id);
    ELSE RAISE EXCEPTION 'invalid_entity_type';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION private.execute_hosting_delete(p_entity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_precheck jsonb; v_deleted_legacy int;
BEGIN
  v_precheck := private.precheck_hosting_delete(p_entity_id);
  IF NOT (v_precheck->>'can_delete')::boolean THEN
    RAISE EXCEPTION 'delete_blocked: %', v_precheck->>'block_reason';
  END IF;
  DELETE FROM payment_records WHERE source_table = 'hosting_records' AND source_id = p_entity_id::text AND truth_level = 'legacy_import';
  GET DIAGNOSTICS v_deleted_legacy = ROW_COUNT;
  DELETE FROM hosting_records WHERE id = p_entity_id;
  RETURN jsonb_build_object('ok', true, 'entity_type', 'hosting', 'entity_id', p_entity_id,
    'deleted', jsonb_build_object('hosting_records', 1, 'legacy_payments', v_deleted_legacy),
    'detached', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION private.execute_rental_website_delete(p_entity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_precheck jsonb; v_del_pay int; v_del_cost int; v_det_comm int; v_del_rp int;
BEGIN
  v_precheck := private.precheck_rental_website_delete(p_entity_id);
  IF NOT (v_precheck->>'can_delete')::boolean THEN
    RAISE EXCEPTION 'delete_blocked: %', v_precheck->>'block_reason';
  END IF;
  DELETE FROM payment_records WHERE rental_website_id = p_entity_id AND truth_level = 'legacy_import';
  GET DIAGNOSTICS v_del_pay = ROW_COUNT;
  DELETE FROM cost_records WHERE rental_website_id = p_entity_id AND truth_level = 'legacy_import';
  GET DIAGNOSTICS v_del_cost = ROW_COUNT;
  UPDATE commissions SET source_type = NULL, source_id = NULL, updated_at = now()
  WHERE source_type = 'rental' AND source_id = p_entity_id::text;
  GET DIAGNOSTICS v_det_comm = ROW_COUNT;
  SELECT COUNT(*) INTO v_del_rp FROM rental_payments WHERE website_id = p_entity_id;
  DELETE FROM rental_websites WHERE id = p_entity_id;
  RETURN jsonb_build_object('ok', true, 'entity_type', 'rental_website', 'entity_id', p_entity_id,
    'deleted', jsonb_build_object('rental_websites', 1, 'rental_payments', v_del_rp, 'legacy_payments', v_del_pay, 'legacy_costs', v_del_cost),
    'detached', jsonb_build_object('commissions', v_det_comm));
END;
$$;

CREATE OR REPLACE FUNCTION private.execute_customer_delete(p_entity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_precheck jsonb;
BEGIN
  v_precheck := private.precheck_customer_delete(p_entity_id);
  IF NOT (v_precheck->>'can_delete')::boolean THEN
    RAISE EXCEPTION 'delete_blocked: %', v_precheck->>'block_reason';
  END IF;
  DELETE FROM customers WHERE id = p_entity_id;
  RETURN jsonb_build_object('ok', true, 'entity_type', 'customer', 'entity_id', p_entity_id,
    'deleted', jsonb_build_object('customers', 1, 'communication_summaries', 1),
    'detached', jsonb_build_object('note', 'FK ON DELETE SET NULL applied to linked CRM entities'));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_execute_destructive_delete(
  p_entity_type text, p_entity_id uuid, p_options jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.assert_admin_destructive();
  CASE p_entity_type
    WHEN 'hosting' THEN RETURN private.execute_hosting_delete(p_entity_id);
    WHEN 'rental_website' THEN RETURN private.execute_rental_website_delete(p_entity_id);
    WHEN 'customer' THEN RETURN private.execute_customer_delete(p_entity_id);
    ELSE RAISE EXCEPTION 'invalid_entity_type';
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_precheck_destructive_delete(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_execute_destructive_delete(text, uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';