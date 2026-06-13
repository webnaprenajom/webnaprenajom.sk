-- Admin-only read of auth.users for human-friendly user management (no model change).

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
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
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
  'Admin-only directory of auth users (id + email + display name) for Settings user management.';
