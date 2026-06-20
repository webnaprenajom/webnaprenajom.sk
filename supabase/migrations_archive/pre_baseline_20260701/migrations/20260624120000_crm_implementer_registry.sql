-- Batch 1: owner-managed implementer name registry (commissions.implementer strings unchanged).

CREATE TABLE IF NOT EXISTS public.crm_implementers (
  name TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_implementers_name_nonempty CHECK (length(trim(name)) >= 2)
);

INSERT INTO public.crm_implementers (name)
VALUES ('Peter'), ('Maroš'), ('Matuš')
ON CONFLICT (name) DO NOTHING;

GRANT SELECT ON public.crm_implementers TO authenticated;
GRANT ALL ON public.crm_implementers TO service_role;

ALTER TABLE public.crm_implementers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_crm_implementers" ON public.crm_implementers;
CREATE POLICY "authenticated_read_crm_implementers"
  ON public.crm_implementers FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "owner_manage_crm_implementers" ON public.crm_implementers;
CREATE POLICY "owner_manage_crm_implementers"
  ON public.crm_implementers FOR ALL TO authenticated
  USING (public.is_crm_owner())
  WITH CHECK (public.is_crm_owner());

COMMENT ON TABLE public.crm_implementers IS
  'Owner-managed catalog of implementer names; commissions.implementer remains string truth.';
