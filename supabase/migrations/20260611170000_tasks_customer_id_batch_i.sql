-- Batch I: tasks.customer_id for canonical customer linking (additive)

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_customer_id_idx
  ON public.tasks (customer_id)
  WHERE customer_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.customer_id IS
  'Canonical customer link (Batch I). Legacy lead_id and client_name preserved.';

-- Safe backfill: only when lead has an unambiguous customer_id
UPDATE public.tasks t
SET customer_id = l.customer_id
FROM public.leads l
WHERE t.lead_id = l.id
  AND t.customer_id IS NULL
  AND l.customer_id IS NOT NULL;

-- Name-only / ambiguous tasks are intentionally NOT backfilled
