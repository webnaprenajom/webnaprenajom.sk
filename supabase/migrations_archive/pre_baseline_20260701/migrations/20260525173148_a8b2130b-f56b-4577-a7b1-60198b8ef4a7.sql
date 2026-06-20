-- The private schema is not exposed via PostgREST API, so granting EXECUTE
-- on private.has_role to authenticated is safe — it only allows the function
-- to be invoked from within RLS policies. Without this grant, RLS policies
-- that call private.has_role throw "permission denied for function has_role",
-- breaking all admin reads (including the user_roles "Admins can view all roles"
-- policy that blocks even the self-read fallback).

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;