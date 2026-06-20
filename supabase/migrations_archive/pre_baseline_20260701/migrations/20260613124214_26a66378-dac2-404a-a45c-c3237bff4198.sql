-- RC6: team profiles, user email accounts, communication summaries, operating costs

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

NOTIFY pgrst, 'reload schema';