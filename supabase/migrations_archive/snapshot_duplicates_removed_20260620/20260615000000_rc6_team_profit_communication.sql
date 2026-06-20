-- RC6: team profiles, entity operating costs, communication summaries, email accounts

-- Link auth users to implementer identity (commissions.implementer)
CREATE TABLE IF NOT EXISTS public.team_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  implementer_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_profiles_implementer_name_unique UNIQUE (implementer_name)
);

CREATE INDEX IF NOT EXISTS team_profiles_implementer_name_idx
  ON public.team_profiles (implementer_name) WHERE active = true;

COMMENT ON TABLE public.team_profiles IS
  'Maps app users to commission implementer names for RBAC scoping.';

ALTER TABLE public.team_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own team profile"
  ON public.team_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage team profiles"
  ON public.team_profiles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Per-user email integration (provider wiring can follow)
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

CREATE INDEX IF NOT EXISTS user_email_accounts_user_id_idx ON public.user_email_accounts (user_id);

ALTER TABLE public.user_email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email accounts"
  ON public.user_email_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- AI / handoff communication summary per customer
CREATE TABLE IF NOT EXISTS public.customer_communication_summaries (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  rolling_summary TEXT,
  key_decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  unresolved_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_event_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_communication_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage communication summaries"
  ON public.customer_communication_summaries FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "CRM users read communication summaries"
  ON public.customer_communication_summaries FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'user'::public.app_role)
  );

-- Operating costs reduce profit base for commissions (hosting / projects)
ALTER TABLE public.hosting_records
  ADD COLUMN IF NOT EXISTS operating_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS operating_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.hosting_records.operating_cost IS
  'Monthly/direct costs deducted from revenue before profit-based commission calculation.';
COMMENT ON COLUMN public.project_notes.operating_cost IS
  'Project costs deducted from revenue before profit-based commission calculation.';

-- User-scoped commission read for role=user (admin retains full access via existing policies)
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

-- team_profiles rows are created via Settings → User management when admin assigns users.
