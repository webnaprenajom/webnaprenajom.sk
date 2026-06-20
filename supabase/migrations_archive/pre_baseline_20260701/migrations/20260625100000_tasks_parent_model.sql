-- Batch 2: canonical task parent (customer | project | hosting | marketing | rental)

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_type TEXT,
  ADD COLUMN IF NOT EXISTS parent_id UUID;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_parent_type_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_parent_type_check
  CHECK (
    parent_type IS NULL
    OR parent_type IN ('customer', 'project', 'hosting', 'marketing', 'rental')
  );

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_parent_pair_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_parent_pair_check
  CHECK (
    (parent_type IS NULL AND parent_id IS NULL)
    OR (parent_type IS NOT NULL AND parent_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS tasks_parent_idx
  ON public.tasks (parent_type, parent_id)
  WHERE parent_type IS NOT NULL AND parent_id IS NOT NULL;

COMMENT ON COLUMN public.tasks.parent_type IS
  'Canonical parent entity kind — customer, project, hosting, marketing, or rental (Batch 2).';
COMMENT ON COLUMN public.tasks.parent_id IS
  'UUID of the parent row for parent_type. Nullable for legacy orphan tasks.';

-- ponytail: safe backfill customer_id → parent customer only; lead/name-only rows stay orphan
UPDATE public.tasks
SET parent_type = 'customer',
    parent_id = customer_id
WHERE customer_id IS NOT NULL
  AND parent_type IS NULL;
