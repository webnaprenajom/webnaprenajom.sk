ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS access_credentials JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.project_notes.access_credentials IS
  'Array of credential objects: {id, label, url, login, password, note}';

UPDATE public.project_notes
SET access_credentials = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'label', 'Hlavný prístup',
    'url', COALESCE(NULLIF(trim(url), ''), ''),
    'login', COALESCE(NULLIF(trim(username), ''), ''),
    'password', COALESCE(NULLIF(trim(password), ''), ''),
    'note', ''
  )
)
WHERE jsonb_array_length(access_credentials) = 0
  AND (
    NULLIF(trim(url), '') IS NOT NULL
    OR NULLIF(trim(username), '') IS NOT NULL
    OR NULLIF(trim(password), '') IS NOT NULL
  );

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  summary TEXT,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON public.admin_audit_log (target_type, target_id);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON public.admin_audit_log (actor_user_id);

COMMENT ON TABLE public.admin_audit_log IS
  'Append-only audit trail for privileged admin actions.';

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins read audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins insert own audit entries" ON public.admin_audit_log;
CREATE POLICY "Admins insert own audit entries"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    AND actor_user_id = auth.uid()
  );

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
  'Admin-only directory of auth users for CRM user management.';

NOTIFY pgrst, 'reload schema';