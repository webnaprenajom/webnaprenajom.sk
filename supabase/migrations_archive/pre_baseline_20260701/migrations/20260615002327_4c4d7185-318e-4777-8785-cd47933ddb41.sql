REVOKE EXECUTE ON FUNCTION public.admin_precheck_destructive_delete(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_execute_destructive_delete(text, uuid, jsonb) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION private.destructive_blocking_record(
  p_id uuid, p_record_type text, p_table_name text, p_label text, p_amount numeric, p_detail text, p_cta_path text
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', p_id, 'record_type', p_record_type, 'table_name', p_table_name,
    'label', p_label, 'amount', COALESCE(p_amount, 0), 'detail', p_detail, 'cta_path', p_cta_path
  );
$$;