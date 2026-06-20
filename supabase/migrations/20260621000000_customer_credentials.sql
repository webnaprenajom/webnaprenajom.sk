-- Customer-centric access credentials (decoupled from project_notes)

CREATE TABLE public.customer_credentials (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id         UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_email      TEXT,
  client_name         TEXT,
  lead_id             UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  category            TEXT NOT NULL DEFAULT 'other',
  label               TEXT NOT NULL,
  url                 TEXT,
  login               TEXT,
  password            TEXT,
  note                TEXT,
  linked_entity_type  TEXT,
  linked_entity_id    UUID,
  legacy_source_key   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_credentials
  ADD CONSTRAINT customer_credentials_category_check
    CHECK (category IN (
      'web_admin', 'hosting', 'email', 'domain', 'shoptet', 'wordpress',
      'facebook', 'google_ads', 'other'
    ));

ALTER TABLE public.customer_credentials
  ADD CONSTRAINT customer_credentials_linked_entity_type_check
    CHECK (linked_entity_type IS NULL OR linked_entity_type IN (
      'project', 'hosting', 'marketing', 'rental'
    ));

CREATE UNIQUE INDEX customer_credentials_legacy_source_key_idx
  ON public.customer_credentials (legacy_source_key)
  WHERE legacy_source_key IS NOT NULL;

CREATE INDEX customer_credentials_customer_id_idx
  ON public.customer_credentials (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX customer_credentials_customer_email_idx
  ON public.customer_credentials (customer_email) WHERE customer_email IS NOT NULL;

CREATE INDEX customer_credentials_lead_id_idx
  ON public.customer_credentials (lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX customer_credentials_linked_entity_idx
  ON public.customer_credentials (linked_entity_type, linked_entity_id)
  WHERE linked_entity_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_credentials TO authenticated;
GRANT ALL ON public.customer_credentials TO service_role;

CREATE TRIGGER trg_customer_credentials_updated
  BEFORE UPDATE ON public.customer_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage customer_credentials" ON public.customer_credentials
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "administrator_select_own_customer_credentials" ON public.customer_credentials;
CREATE POLICY "administrator_select_own_customer_credentials"
  ON public.customer_credentials FOR SELECT TO authenticated
  USING (public.is_crm_owner() OR public.is_crm_administrator());

COMMENT ON TABLE public.customer_credentials IS
  'Customer-owned login credentials. Optional link to project/hosting/marketing/rental.';

-- Backfill from project_notes.access_credentials JSON (idempotent via legacy_source_key)
INSERT INTO public.customer_credentials (
  customer_id, customer_email, client_name, lead_id,
  category, label, url, login, password, note,
  linked_entity_type, linked_entity_id, legacy_source_key,
  created_at, updated_at
)
SELECT
  pn.customer_id,
  pn.customer_email,
  pn.client_name,
  pn.lead_id,
  'other',
  COALESCE(NULLIF(trim(elem->>'label'), ''), 'Prístup'),
  NULLIF(trim(elem->>'url'), ''),
  NULLIF(trim(elem->>'login'), ''),
  NULLIF(trim(elem->>'password'), ''),
  NULLIF(trim(elem->>'note'), ''),
  'project',
  pn.id,
  'project_notes:' || pn.id::text || ':' || COALESCE(NULLIF(trim(elem->>'id'), ''), md5(elem::text)),
  pn.updated_at,
  pn.updated_at
FROM public.project_notes pn
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pn.access_credentials, '[]'::jsonb)) AS elem
WHERE (
  NULLIF(trim(elem->>'url'), '') IS NOT NULL
  OR NULLIF(trim(elem->>'login'), '') IS NOT NULL
  OR NULLIF(trim(elem->>'password'), '') IS NOT NULL
)
AND (pn.customer_id IS NOT NULL OR NULLIF(trim(pn.customer_email), '') IS NOT NULL)
ON CONFLICT (legacy_source_key) WHERE legacy_source_key IS NOT NULL DO NOTHING;

-- Backfill legacy single-column credentials when JSON array is empty
INSERT INTO public.customer_credentials (
  customer_id, customer_email, client_name, lead_id,
  category, label, url, login, password, note,
  linked_entity_type, linked_entity_id, legacy_source_key,
  created_at, updated_at
)
SELECT
  pn.customer_id,
  pn.customer_email,
  pn.client_name,
  pn.lead_id,
  'other',
  'Hlavný prístup',
  NULLIF(trim(pn.url), ''),
  NULLIF(trim(pn.username), ''),
  NULLIF(trim(pn.password), ''),
  NULL,
  'project',
  pn.id,
  'project_notes:' || pn.id::text || ':legacy',
  pn.updated_at,
  pn.updated_at
FROM public.project_notes pn
WHERE jsonb_array_length(COALESCE(pn.access_credentials, '[]'::jsonb)) = 0
  AND (
    NULLIF(trim(pn.url), '') IS NOT NULL
    OR NULLIF(trim(pn.username), '') IS NOT NULL
    OR NULLIF(trim(pn.password), '') IS NOT NULL
  )
  AND (pn.customer_id IS NOT NULL OR NULLIF(trim(pn.customer_email), '') IS NOT NULL)
ON CONFLICT (legacy_source_key) WHERE legacy_source_key IS NOT NULL DO NOTHING;
