-- Phase 2G: periodic review cadence on finance_review_items (additive)

ALTER TABLE public.finance_review_items
  ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_cadence_days INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

CREATE INDEX finance_review_items_due_at_idx
  ON public.finance_review_items (review_due_at)
  WHERE review_due_at IS NOT NULL;
