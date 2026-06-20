-- Lead destructive delete: execute + detach (Batch L2)
-- Lead auth: owner + administrator (scoped); other entities keep assert_admin_destructive.

CREATE OR REPLACE FUNCTION private.assert_lead_delete_access(p_entity_id uuid)
RETURNS leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead leads%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT (public.is_crm_owner() OR public.is_crm_administrator()) THEN
    RAISE EXCEPTION 'insufficient_privileges';
  END IF;

  SELECT * INTO v_lead FROM leads WHERE id = p_entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity_not_found';
  END IF;

  -- ponytail: SECURITY DEFINER bypasses RLS — mirror administrator_write_own_leads scope
  IF public.is_crm_administrator() AND NOT public.is_crm_owner() THEN
    IF NOT public.rbac_name_matches(v_lead.assigned_to) THEN
      RAISE EXCEPTION 'insufficient_privileges';
    END IF;
  END IF;

  RETURN v_lead;
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
  v_lead := private.assert_lead_delete_access(p_entity_id);

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

CREATE OR REPLACE FUNCTION private.execute_lead_delete(p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead leads%ROWTYPE;
  v_det_tasks int := 0;
  v_det_notes int := 0;
BEGIN
  v_lead := private.assert_lead_delete_access(p_entity_id);

  -- Lead delete: warnings only at precheck; no finance hard block (Maros decision)
  UPDATE tasks SET lead_id = NULL WHERE lead_id = p_entity_id;
  GET DIAGNOSTICS v_det_tasks = ROW_COUNT;

  UPDATE project_notes SET lead_id = NULL WHERE lead_id = p_entity_id;
  GET DIAGNOSTICS v_det_notes = ROW_COUNT;

  -- marketing_records.lead_id: FK ON DELETE SET NULL
  DELETE FROM leads WHERE id = p_entity_id;

  RETURN jsonb_build_object(
    'ok', true,
    'entity_type', 'lead',
    'entity_id', p_entity_id,
    'deleted', jsonb_build_object('leads', 1),
    'detached', jsonb_build_object(
      'tasks', v_det_tasks,
      'project_notes', v_det_notes
    )
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
  IF p_entity_type = 'lead' THEN
    RETURN private.precheck_lead_delete(p_entity_id);
  END IF;

  PERFORM private.assert_admin_destructive();

  CASE p_entity_type
    WHEN 'hosting' THEN RETURN private.precheck_hosting_delete(p_entity_id);
    WHEN 'rental_website' THEN RETURN private.precheck_rental_website_delete(p_entity_id);
    WHEN 'customer' THEN RETURN private.precheck_customer_delete(p_entity_id);
    ELSE RAISE EXCEPTION 'invalid_entity_type';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_execute_destructive_delete(
  p_entity_type text,
  p_entity_id uuid,
  p_options jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_entity_type = 'lead' THEN
    RETURN private.execute_lead_delete(p_entity_id);
  END IF;

  PERFORM private.assert_admin_destructive();

  CASE p_entity_type
    WHEN 'hosting' THEN RETURN private.execute_hosting_delete(p_entity_id);
    WHEN 'rental_website' THEN RETURN private.execute_rental_website_delete(p_entity_id);
    WHEN 'customer' THEN RETURN private.execute_customer_delete(p_entity_id);
    ELSE RAISE EXCEPTION 'invalid_entity_type';
  END CASE;
END;
$$;

COMMENT ON FUNCTION private.assert_lead_delete_access IS
  'Auth + ownership gate for lead destructive precheck/execute (owner or scoped administrator).';
COMMENT ON FUNCTION private.execute_lead_delete IS
  'Detach tasks/project_notes lead_id, delete lead row. No finance hard block.';
