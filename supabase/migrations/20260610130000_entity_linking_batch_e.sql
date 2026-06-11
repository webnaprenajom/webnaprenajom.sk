-- Batch E: additive entity linking (commissions + project_notes)

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IS NULL OR source_type IN ('project', 'rental', 'hosting', 'other')),
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS project_type TEXT
    CHECK (project_type IS NULL OR project_type IN ('wordpress', 'shoptet', 'custom', 'other')),
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS lead_id UUID;

CREATE INDEX IF NOT EXISTS commissions_source_idx
  ON public.commissions (source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commissions_customer_email_idx
  ON public.commissions (customer_email)
  WHERE customer_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_notes_lead_id_idx
  ON public.project_notes (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_notes_customer_email_idx
  ON public.project_notes (customer_email)
  WHERE customer_email IS NOT NULL;
