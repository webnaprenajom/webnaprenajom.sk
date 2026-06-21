-- Assign implementer (realizátor) on delivery records — same string model as leads/tasks.assignee.

ALTER TABLE public.project_notes
  ADD COLUMN IF NOT EXISTS assigned_to TEXT;

ALTER TABLE public.marketing_records
  ADD COLUMN IF NOT EXISTS assigned_to TEXT;

CREATE INDEX IF NOT EXISTS project_notes_assigned_to_idx
  ON public.project_notes (assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS marketing_records_assigned_to_idx
  ON public.marketing_records (assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.project_notes.assigned_to IS
  'CRM implementer name (crm_implementers); mirrors leads.assigned_to / tasks.assignee semantics.';

COMMENT ON COLUMN public.marketing_records.assigned_to IS
  'CRM implementer name (crm_implementers); campaign owner for administrator scoping (future RLS).';
