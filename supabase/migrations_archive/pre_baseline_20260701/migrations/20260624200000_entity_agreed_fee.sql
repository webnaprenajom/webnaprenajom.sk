-- Batch 3: minimum revenue basis for opt-in payment fact drafts (project + marketing)

ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS agreed_fee NUMERIC;

ALTER TABLE public.marketing_records
  ADD COLUMN IF NOT EXISTS agreed_fee NUMERIC;

COMMENT ON COLUMN public.project_notes.agreed_fee IS
  'Dohodnutá cena projektu (€) — základ pre opt-in payment fact draft, nie auditovaný príjem.';

COMMENT ON COLUMN public.marketing_records.agreed_fee IS
  'Dohodnutý poplatok kampane (€) — základ pre opt-in payment fact draft.';
