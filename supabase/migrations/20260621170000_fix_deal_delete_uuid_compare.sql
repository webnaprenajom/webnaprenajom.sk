-- Fix uuid=text operator errors in deal delete RPCs (commissions.source_id + tasks.parent_id are uuid).

CREATE OR REPLACE FUNCTION private.precheck_project_delete(p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project project_notes%ROWTYPE;
  v_payment_count int;
  v_comm_count int;
BEGIN
  SELECT * INTO v_project FROM project_notes WHERE id = p_entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity_not_found';
  END IF;

  SELECT COUNT(*) INTO v_payment_count
  FROM payment_records pr
  WHERE pr.source_table = 'project_notes' AND pr.source_id = p_entity_id::text;

  SELECT COUNT(*) INTO v_comm_count
  FROM commissions c
  WHERE c.source_type = 'project' AND c.source_id = p_entity_id;

  RETURN jsonb_build_object(
    'entity_type', 'project',
    'entity_id', p_entity_id,
    'entity_label', COALESCE(v_project.title, 'Projekt'),
    'can_delete', v_payment_count = 0 AND v_comm_count = 0,
    'block_reason', CASE
      WHEN v_payment_count > 0 AND v_comm_count > 0 THEN
        'Projekt má naviazané platby a provízie. Najprv ich odstráňte v detaile projektu (záložky Platby a Provízie).'
      WHEN v_payment_count > 0 THEN
        'Projekt má naviazané platby. Najprv ich odstráňte v detaile projektu (záložka Platby).'
      WHEN v_comm_count > 0 THEN
        'Projekt má naviazané provízie. Najprv ich odstráňte v detaile projektu (záložka Provízie).'
      ELSE NULL END,
    'finance_critical', v_payment_count > 0 OR v_comm_count > 0,
    'sections', jsonb_build_array(
      jsonb_build_object('label', 'Platby (payment_records)', 'count', v_payment_count, 'action', 'block'),
      jsonb_build_object('label', 'Provízie', 'count', v_comm_count, 'action', 'block'),
      jsonb_build_object('label', 'Projekt', 'count', 1, 'action', 'delete')
    ),
    'warnings', CASE WHEN v_payment_count > 0 OR v_comm_count > 0
      THEN jsonb_build_array('Zmazanie dealu je možné až po odstránení všetkých naviazaných platieb a provízií.')
      ELSE jsonb_build_array('Úlohy naviazané na projekt sa odpoja (parent_id sa vymaže).') END,
    'blocking_records', '[]'::jsonb,
    'cta_links', jsonb_build_array(
      jsonb_build_object('label', 'Detail projektu', 'path', '/admin/projects/' || p_entity_id::text)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.precheck_marketing_delete(p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marketing marketing_records%ROWTYPE;
  v_payment_count int;
  v_comm_count int;
BEGIN
  SELECT * INTO v_marketing FROM marketing_records WHERE id = p_entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity_not_found';
  END IF;

  SELECT COUNT(*) INTO v_payment_count
  FROM payment_records pr
  WHERE pr.source_table = 'marketing_records' AND pr.source_id = p_entity_id::text;

  SELECT COUNT(*) INTO v_comm_count
  FROM commissions c
  WHERE c.source_type = 'marketing' AND c.source_id = p_entity_id;

  RETURN jsonb_build_object(
    'entity_type', 'marketing',
    'entity_id', p_entity_id,
    'entity_label', COALESCE(v_marketing.title, 'Marketing'),
    'can_delete', v_payment_count = 0 AND v_comm_count = 0,
    'block_reason', CASE
      WHEN v_payment_count > 0 AND v_comm_count > 0 THEN
        'Marketingový záznam má naviazané platby a provízie. Najprv ich odstráňte v detaile (záložky Platby a Provízie).'
      WHEN v_payment_count > 0 THEN
        'Marketingový záznam má naviazané platby. Najprv ich odstráňte v detaile (záložka Platby).'
      WHEN v_comm_count > 0 THEN
        'Marketingový záznam má naviazané provízie. Najprv ich odstráňte v detaile (záložka Provízie).'
      ELSE NULL END,
    'finance_critical', v_payment_count > 0 OR v_comm_count > 0,
    'sections', jsonb_build_array(
      jsonb_build_object('label', 'Platby (payment_records)', 'count', v_payment_count, 'action', 'block'),
      jsonb_build_object('label', 'Provízie', 'count', v_comm_count, 'action', 'block'),
      jsonb_build_object('label', 'Marketing záznam', 'count', 1, 'action', 'delete')
    ),
    'warnings', CASE WHEN v_payment_count > 0 OR v_comm_count > 0
      THEN jsonb_build_array('Zmazanie dealu je možné až po odstránení všetkých naviazaných platieb a provízií.')
      ELSE jsonb_build_array('Úlohy naviazané na marketing sa odpoja (parent_id sa vymaže).') END,
    'blocking_records', '[]'::jsonb,
    'cta_links', jsonb_build_array(
      jsonb_build_object('label', 'Detail marketingu', 'path', '/admin/marketing/' || p_entity_id::text)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.precheck_hosting_delete(p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hosting hosting_records%ROWTYPE;
  v_payment_count int;
  v_comm_count int;
BEGIN
  SELECT * INTO v_hosting FROM hosting_records WHERE id = p_entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity_not_found';
  END IF;

  SELECT COUNT(*) INTO v_payment_count
  FROM payment_records pr
  WHERE pr.source_table = 'hosting_records' AND pr.source_id = p_entity_id::text;

  SELECT COUNT(*) INTO v_comm_count
  FROM commissions c
  WHERE c.source_type = 'hosting' AND c.source_id = p_entity_id;

  RETURN jsonb_build_object(
    'entity_type', 'hosting',
    'entity_id', p_entity_id,
    'entity_label', COALESCE(v_hosting.client_name, v_hosting.provider, 'Hosting'),
    'can_delete', v_payment_count = 0 AND v_comm_count = 0,
    'block_reason', CASE
      WHEN v_payment_count > 0 AND v_comm_count > 0 THEN
        'Hosting má naviazané platby a provízie. Najprv ich odstráňte v detaile hostingu (záložky Platby a Provízie).'
      WHEN v_payment_count > 0 THEN
        'Hosting má naviazané platby. Najprv ich odstráňte v detaile hostingu (záložka Platby).'
      WHEN v_comm_count > 0 THEN
        'Hosting má naviazané provízie. Najprv ich odstráňte v detaile hostingu (záložka Provízie).'
      ELSE NULL END,
    'finance_critical', v_payment_count > 0 OR v_comm_count > 0,
    'sections', jsonb_build_array(
      jsonb_build_object('label', 'Platby (payment_records)', 'count', v_payment_count, 'action', 'block'),
      jsonb_build_object('label', 'Provízie', 'count', v_comm_count, 'action', 'block'),
      jsonb_build_object('label', 'Hosting záznam', 'count', 1, 'action', 'delete')
    ),
    'warnings', CASE WHEN v_payment_count > 0 OR v_comm_count > 0
      THEN jsonb_build_array('Zmazanie dealu je možné až po odstránení všetkých naviazaných platieb a provízií.')
      ELSE jsonb_build_array('Úlohy naviazané na hosting sa odpoja (parent_id sa vymaže).') END,
    'blocking_records', '[]'::jsonb,
    'cta_links', jsonb_build_array(
      jsonb_build_object('label', 'Hosting detail', 'path', '/admin/hosting/' || p_entity_id::text)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.execute_project_delete(p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_precheck jsonb;
  v_det_tasks int;
BEGIN
  v_precheck := private.precheck_project_delete(p_entity_id);
  IF NOT (v_precheck->>'can_delete')::boolean THEN
    RAISE EXCEPTION 'delete_blocked: %', v_precheck->>'block_reason';
  END IF;

  UPDATE tasks
  SET parent_type = NULL, parent_id = NULL
  WHERE parent_type = 'project' AND parent_id = p_entity_id;
  GET DIAGNOSTICS v_det_tasks = ROW_COUNT;

  DELETE FROM project_notes WHERE id = p_entity_id;

  RETURN jsonb_build_object(
    'ok', true,
    'entity_type', 'project',
    'entity_id', p_entity_id,
    'deleted', jsonb_build_object('project_notes', 1),
    'detached', jsonb_build_object('tasks', v_det_tasks)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.execute_marketing_delete(p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_precheck jsonb;
  v_det_tasks int;
BEGIN
  v_precheck := private.precheck_marketing_delete(p_entity_id);
  IF NOT (v_precheck->>'can_delete')::boolean THEN
    RAISE EXCEPTION 'delete_blocked: %', v_precheck->>'block_reason';
  END IF;

  UPDATE tasks
  SET parent_type = NULL, parent_id = NULL
  WHERE parent_type = 'marketing' AND parent_id = p_entity_id;
  GET DIAGNOSTICS v_det_tasks = ROW_COUNT;

  DELETE FROM marketing_records WHERE id = p_entity_id;

  RETURN jsonb_build_object(
    'ok', true,
    'entity_type', 'marketing',
    'entity_id', p_entity_id,
    'deleted', jsonb_build_object('marketing_records', 1),
    'detached', jsonb_build_object('tasks', v_det_tasks)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.execute_hosting_delete(p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_precheck jsonb;
  v_det_tasks int;
BEGIN
  v_precheck := private.precheck_hosting_delete(p_entity_id);
  IF NOT (v_precheck->>'can_delete')::boolean THEN
    RAISE EXCEPTION 'delete_blocked: %', v_precheck->>'block_reason';
  END IF;

  UPDATE tasks
  SET parent_type = NULL, parent_id = NULL
  WHERE parent_type = 'hosting' AND parent_id = p_entity_id;
  GET DIAGNOSTICS v_det_tasks = ROW_COUNT;

  DELETE FROM hosting_records WHERE id = p_entity_id;

  RETURN jsonb_build_object(
    'ok', true,
    'entity_type', 'hosting',
    'entity_id', p_entity_id,
    'deleted', jsonb_build_object('hosting_records', 1),
    'detached', jsonb_build_object('tasks', v_det_tasks)
  );
END;
$$;
