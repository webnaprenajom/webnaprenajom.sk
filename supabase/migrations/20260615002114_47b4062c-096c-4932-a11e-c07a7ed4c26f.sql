-- =====================================================================
-- 20260613000000_rc4_project_credentials
-- =====================================================================
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

-- =====================================================================
-- 20260613124214 — RC6 team profiles, email accounts, summaries (superset of 20260615000000+01)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.team_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  implementer_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_profiles_implementer_name_unique UNIQUE (implementer_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_profiles TO authenticated;
GRANT ALL ON public.team_profiles TO service_role;
CREATE INDEX IF NOT EXISTS team_profiles_implementer_name_idx
  ON public.team_profiles (implementer_name) WHERE active = true;
ALTER TABLE public.team_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own team profile" ON public.team_profiles;
CREATE POLICY "Users read own team profile"
  ON public.team_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage team profiles" ON public.team_profiles;
CREATE POLICY "Admins manage team profiles"
  ON public.team_profiles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.user_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_email_accounts_user_email_unique UNIQUE (user_id, email_address)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_email_accounts TO authenticated;
GRANT ALL ON public.user_email_accounts TO service_role;
CREATE INDEX IF NOT EXISTS user_email_accounts_user_id_idx ON public.user_email_accounts (user_id);
ALTER TABLE public.user_email_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own email accounts" ON public.user_email_accounts;
CREATE POLICY "Users manage own email accounts"
  ON public.user_email_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.customer_communication_summaries (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  rolling_summary TEXT,
  key_decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  unresolved_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_event_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_communication_summaries TO authenticated;
GRANT ALL ON public.customer_communication_summaries TO service_role;
ALTER TABLE public.customer_communication_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage communication summaries" ON public.customer_communication_summaries;
CREATE POLICY "Admins manage communication summaries"
  ON public.customer_communication_summaries FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "CRM users read communication summaries" ON public.customer_communication_summaries;
CREATE POLICY "CRM users read communication summaries"
  ON public.customer_communication_summaries FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'user'::public.app_role)
  );
DROP POLICY IF EXISTS "CRM users upsert communication summaries" ON public.customer_communication_summaries;
CREATE POLICY "CRM users upsert communication summaries"
  ON public.customer_communication_summaries FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'user'::public.app_role)
  );
DROP POLICY IF EXISTS "CRM users update communication summaries" ON public.customer_communication_summaries;
CREATE POLICY "CRM users update communication summaries"
  ON public.customer_communication_summaries FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'user'::public.app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'user'::public.app_role)
  );

ALTER TABLE public.hosting_records
  ADD COLUMN IF NOT EXISTS operating_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS operating_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "CRM users read own commissions" ON public.commissions;
CREATE POLICY "CRM users read own commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      private.has_role(auth.uid(), 'user'::public.app_role)
      AND implementer = (
        SELECT tp.implementer_name FROM public.team_profiles tp
        WHERE tp.user_id = auth.uid() AND tp.active = true
        LIMIT 1
      )
    )
  );

-- =====================================================================
-- 20260613125139 — admin_audit_log + admin_list_auth_users (RC6.6/RC6.7 superset)
-- =====================================================================
ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS access_credentials JSONB NOT NULL DEFAULT '[]'::jsonb;

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

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON public.admin_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON public.admin_audit_log (actor_user_id);

COMMENT ON TABLE public.admin_audit_log IS 'Append-only audit trail for privileged admin actions.';

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

COMMENT ON FUNCTION public.admin_list_auth_users IS 'Admin-only directory of auth users for CRM user management.';

-- =====================================================================
-- 20260614000000_rc5_rental_customer_identity
-- =====================================================================
ALTER TABLE public.rental_websites
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

COMMENT ON COLUMN public.rental_websites.customer_email IS
  'Normalized customer email — denormalized from customers when customer_id set';

UPDATE public.rental_websites rw
SET customer_email = lower(trim(c.email))
FROM public.customers c
WHERE rw.customer_id = c.id
  AND c.email IS NOT NULL
  AND trim(c.email) <> ''
  AND (rw.customer_email IS NULL OR trim(rw.customer_email) = '');

UPDATE public.rental_websites rw
SET customer_id = sub.proposed_customer_id,
    customer_email = COALESCE(rw.customer_email, sub.proposed_email)
FROM (
  SELECT
    rw2.id AS rental_id,
    l.customer_id AS proposed_customer_id,
    lower(trim(c.email)) AS proposed_email
  FROM public.rental_websites rw2
  INNER JOIN public.leads l
    ON lower(regexp_replace(trim(l.name), '\s+', ' ', 'g')) =
       lower(regexp_replace(trim(rw2.client_name), '\s+', ' ', 'g'))
  LEFT JOIN public.customers c ON c.id = l.customer_id
  WHERE rw2.customer_id IS NULL
    AND rw2.client_name IS NOT NULL
    AND trim(rw2.client_name) <> ''
    AND l.customer_id IS NOT NULL
    AND (
      SELECT count(*)
      FROM public.leads l2
      WHERE lower(regexp_replace(trim(l2.name), '\s+', ' ', 'g')) =
            lower(regexp_replace(trim(rw2.client_name), '\s+', ' ', 'g'))
    ) = 1
) sub
WHERE rw.id = sub.rental_id;

CREATE INDEX IF NOT EXISTS rental_websites_customer_email_idx
  ON public.rental_websites (customer_email)
  WHERE customer_email IS NOT NULL;

-- =====================================================================
-- 20260614142818 — legacy import staging tables (sandbox; dropped immediately after)
-- =====================================================================
CREATE TABLE public._imp_leads (LIKE public.leads INCLUDING DEFAULTS);
CREATE TABLE public._imp_lead_logs (LIKE public.lead_logs INCLUDING DEFAULTS);
CREATE TABLE public._imp_notifications (LIKE public.notifications INCLUDING DEFAULTS);
CREATE TABLE public._imp_rental_websites (LIKE public.rental_websites INCLUDING DEFAULTS);
CREATE TABLE public._imp_rental_payments (LIKE public.rental_payments INCLUDING DEFAULTS);
CREATE TABLE public._imp_expenses (LIKE public.expenses INCLUDING DEFAULTS);
CREATE TABLE public._imp_tasks (LIKE public.tasks INCLUDING DEFAULTS);
CREATE TABLE public._imp_project_notes (LIKE public.project_notes INCLUDING DEFAULTS);
CREATE TABLE public._imp_wheel_spins (LIKE public.wheel_spins INCLUDING DEFAULTS);
CREATE TABLE public._imp_commissions (LIKE public.commissions INCLUDING DEFAULTS);
CREATE TABLE public._imp_design_proposals (LIKE public.design_proposals INCLUDING DEFAULTS);

-- (The sandbox _imp_apply_all() function is intentionally omitted here — it references
--  triggers that don't exist in this DB; staging tables are dropped in next step anyway.)

-- =====================================================================
-- 20260614142901 — drop staging
-- =====================================================================
DROP TABLE IF EXISTS public._imp_leads, public._imp_lead_logs, public._imp_notifications,
  public._imp_rental_websites, public._imp_rental_payments, public._imp_expenses,
  public._imp_tasks, public._imp_project_notes, public._imp_wheel_spins,
  public._imp_commissions, public._imp_design_proposals;

-- =====================================================================
-- 20260614143607 — REVOKE EXECUTE from PUBLIC/anon on trigger functions
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.log_lead_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_notification_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_signature() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lead_status_changed_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_auth_users() FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';