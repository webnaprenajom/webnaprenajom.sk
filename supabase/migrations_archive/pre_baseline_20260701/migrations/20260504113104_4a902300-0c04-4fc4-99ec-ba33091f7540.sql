ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS imported boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_batch text;

CREATE INDEX IF NOT EXISTS idx_leads_imported ON public.leads(imported);
CREATE INDEX IF NOT EXISTS idx_leads_import_batch ON public.leads(import_batch);