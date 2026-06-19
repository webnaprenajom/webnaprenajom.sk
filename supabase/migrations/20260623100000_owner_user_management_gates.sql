-- Batch 1: owner-safe user management gates (additive — legacy admin policies unchanged).

CREATE OR REPLACE FUNCTION public.admin_list_auth_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  auth_display_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_crm_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::TEXT,
    COALESCE(
      NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(u.raw_user_meta_data->>'name'), '')
    ) AS auth_display_name,
    u.created_at
  FROM auth.users u
  ORDER BY LOWER(u.email);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_auth_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_auth_users() TO authenticated;

COMMENT ON FUNCTION public.admin_list_auth_users IS
  'Owner-only directory of auth users for Settings user management.';

DROP POLICY IF EXISTS "owner_manage_user_roles" ON public.user_roles;
CREATE POLICY "owner_manage_user_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_crm_owner())
  WITH CHECK (public.is_crm_owner());

DROP POLICY IF EXISTS "owner_manage_team_profiles" ON public.team_profiles;
CREATE POLICY "owner_manage_team_profiles"
  ON public.team_profiles FOR ALL TO authenticated
  USING (public.is_crm_owner())
  WITH CHECK (public.is_crm_owner());

DROP POLICY IF EXISTS "owner_read_audit_log" ON public.admin_audit_log;
CREATE POLICY "owner_read_audit_log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_crm_owner());

DROP POLICY IF EXISTS "owner_insert_audit_log" ON public.admin_audit_log;
CREATE POLICY "owner_insert_audit_log"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_crm_owner());
