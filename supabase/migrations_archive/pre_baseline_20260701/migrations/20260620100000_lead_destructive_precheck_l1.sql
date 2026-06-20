-- Lead destructive delete: precheck only (Batch L1)
-- Adds lead entity to admin_precheck_destructive_delete; no execute path.

CREATE OR REPLACE FUNCTION private.customer_has_finance_facts(p_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_rental_ids uuid[];
BEGIN
  SELECT lower(trim(COALESCE(email, ''))) INTO v_email
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_rental_ids
  FROM rental_websites rw
  WHERE rw.customer_id = p_customer_id
     OR (v_email <> '' AND lower(trim(COALESCE(rw.customer_email, ''))) = v_email);

  IF EXISTS (
    SELECT 1 FROM payment_records pr
    WHERE pr.truth_level = 'payment_fact'
      AND (
        (v_email <> '' AND lower(trim(COALESCE(pr.customer_email, ''))) = v_email)
        OR (cardinality(v_rental_ids) > 0 AND pr.rental_website_id = ANY(v_rental_ids))
      )
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM cost_records cr
    WHERE cr.truth_level = 'cost_fact'
      AND cardinality(v_rental_ids) > 0
      AND cr.rental_website_id = ANY(v_rental_ids)
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM payout_records po
    JOIN commissions c ON po.source_table = 'commissions' AND po.source_id = c.id::text
    WHERE po.truth_level = 'payout_fact'
      AND (
        c.customer_id = p_customer_id
        OR (v_email <> '' AND lower(trim(COALESCE(c.customer_email, ''))) = v_email)
      )
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM payment_records pr
    JOIN hosting_records h ON pr.source_table = 'hosting_records' AND pr.source_id = h.id::text
    WHERE pr.truth_level = 'payment_fact'
      AND (
        h.customer_id = p_customer_id
        OR (v_email <> '' AND lower(trim(COALESCE(h.customer_email, ''))) = v_email)
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.precheck_lead_delete(p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead leads%ROWTYPE;
  v_tasks_count int := 0;
  v_notes_count int := 0;
  v_marketing_count int := 0;
  v_logs_count int := 0;
  v_sections jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_cta jsonb := '[]'::jsonb;
  v_has_finance boolean := false;
  v_rentals_count int := 0;
  v_hosting_count int := 0;
  v_is_risky boolean := false;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity_not_found';
  END IF;

  SELECT COUNT(*) INTO v_tasks_count FROM tasks WHERE lead_id = p_entity_id;
  SELECT COUNT(*) INTO v_notes_count FROM project_notes WHERE lead_id = p_entity_id;
  SELECT COUNT(*) INTO v_marketing_count FROM marketing_records WHERE lead_id = p_entity_id;
  SELECT COUNT(*) INTO v_logs_count FROM lead_logs WHERE lead_id = p_entity_id;

  IF v_lead.customer_id IS NOT NULL THEN
    v_has_finance := private.customer_has_finance_facts(v_lead.customer_id);

    SELECT COUNT(*) INTO v_rentals_count
    FROM rental_websites
    WHERE customer_id = v_lead.customer_id;

    SELECT COUNT(*) INTO v_hosting_count
    FROM hosting_records
    WHERE customer_id = v_lead.customer_id;

    v_sections := v_sections || jsonb_build_array(
      jsonb_build_object(
        'key', 'customerLink',
        'severity', CASE WHEN v_has_finance THEN 'warning' ELSE 'info' END,
        'count', 1,
        'linked_customer', jsonb_build_object(
          'customer_id', v_lead.customer_id,
          'has_finance_facts', v_has_finance,
          'rentals_count', v_rentals_count,
          'hosting_count', v_hosting_count
        )
      )
    );

    IF v_has_finance THEN
      v_warnings := v_warnings || jsonb_build_array(
        'Prepojený klient má potvrdené finančné fakty (payment_fact / cost_fact / payout_fact). Zmazanie leadu NEMAŽE klienta ani platby.'
      );
      v_is_risky := true;
    END IF;

    v_cta := jsonb_build_array(
      jsonb_build_object('label', 'Klientsky hub', 'path', '/admin/customers/' || v_lead.customer_id::text),
      jsonb_build_object('label', 'Finance — prehľad', 'path', '/admin/finance')
    );
  END IF;

  IF v_tasks_count > 0 THEN
    v_sections := v_sections || jsonb_build_array(
      jsonb_build_object('key', 'tasks', 'severity', 'info', 'count', v_tasks_count, 'action', 'detach')
    );
  END IF;

  IF v_notes_count > 0 THEN
    v_sections := v_sections || jsonb_build_array(
      jsonb_build_object('key', 'projectNotes', 'severity', 'info', 'count', v_notes_count, 'action', 'detach')
    );
  END IF;

  IF v_marketing_count > 0 THEN
    v_sections := v_sections || jsonb_build_array(
      jsonb_build_object('key', 'marketing', 'severity', 'info', 'count', v_marketing_count, 'action', 'detach')
    );
  END IF;

  IF v_logs_count > 0 THEN
    v_sections := v_sections || jsonb_build_array(
      jsonb_build_object('key', 'leadLogs', 'severity', 'info', 'count', v_logs_count, 'action', 'keep')
    );
  END IF;

  RETURN jsonb_build_object(
    'entity_type', 'lead',
    'entity_id', p_entity_id,
    'entity_label', COALESCE(NULLIF(trim(v_lead.name), ''), NULLIF(trim(v_lead.email), ''), 'Lead'),
    'can_delete', true,
    'block_reason', NULL,
    'finance_critical', v_has_finance,
    'sections', '[]'::jsonb,
    'lead_impact', jsonb_build_object(
      'is_risky', v_is_risky,
      'sections', v_sections
    ),
    'warnings', v_warnings,
    'blocking_records', '[]'::jsonb,
    'cta_links', v_cta
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_precheck_destructive_delete(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM private.assert_admin_destructive();

  CASE p_entity_type
    WHEN 'hosting' THEN RETURN private.precheck_hosting_delete(p_entity_id);
    WHEN 'rental_website' THEN RETURN private.precheck_rental_website_delete(p_entity_id);
    WHEN 'customer' THEN RETURN private.precheck_customer_delete(p_entity_id);
    WHEN 'lead' THEN RETURN private.precheck_lead_delete(p_entity_id);
    ELSE RAISE EXCEPTION 'invalid_entity_type';
  END CASE;
END;
$$;

COMMENT ON FUNCTION private.customer_has_finance_facts IS
  'True when customer has any payment_fact, cost_fact, or payout_fact (same scope as customer destructive precheck).';
COMMENT ON FUNCTION private.precheck_lead_delete IS
  'Lead delete impact summary (L1): warnings only, no hard finance block. Execute not implemented yet.';
