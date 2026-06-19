-- Restore authenticated EXECUTE on private.has_role for RLS policy evaluation.
-- 20260619000001_rbac_owner_administrator.sql re-issued REVOKE without re-granting to authenticated,
-- which breaks every RLS policy that calls private.has_role ("permission denied for function has_role").
-- Re-applies intent of 20260525173148_a8b2130b-f56b-4577-a7b1-60198b8ef4a7.sql (idempotent).

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
