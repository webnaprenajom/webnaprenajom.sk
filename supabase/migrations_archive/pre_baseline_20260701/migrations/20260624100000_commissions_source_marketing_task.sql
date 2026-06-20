-- Batch 1: entity commissions UX — marketing + task source types (additive CHECK widen)

ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_source_type_check;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_source_type_check
  CHECK (
    source_type IS NULL
    OR source_type IN (
      'project',
      'rental',
      'hosting',
      'other',
      'marketing',
      'task'
    )
  );
