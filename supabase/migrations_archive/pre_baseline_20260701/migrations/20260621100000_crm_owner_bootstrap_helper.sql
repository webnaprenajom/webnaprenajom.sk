-- Fresh-project admin bootstrap helper (additive, no hardcoded user_id).
-- Call from Supabase SQL Editor AFTER creating the first Auth user:
--   SELECT public.grant_crm_owner_by_email('your@email.com');
--
-- Requires app_role 'owner' (added in 20260619000000_rbac_owner_administrator.sql).

CREATE OR REPLACE FUNCTION public.grant_crm_owner_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_email text := lower(trim(p_email));
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_user_not_found', 'email', v_email);
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'owner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'email', v_email,
    'role', 'owner'
  );
END;
$$;

COMMENT ON FUNCTION public.grant_crm_owner_by_email(text) IS
  'One-shot CRM bootstrap: grant owner role to an existing auth.users row by email. Run manually after first signup.';

REVOKE ALL ON FUNCTION public.grant_crm_owner_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_crm_owner_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_crm_owner_by_email(text) TO postgres;
