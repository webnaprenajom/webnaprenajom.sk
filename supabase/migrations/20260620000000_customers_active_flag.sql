-- Phase 1 (Inactive customers foundation): add active flag to customers.
-- Additive only — no rename/drop, no backfill beyond DB default.
-- Existing rows implicitly become active = true.

ALTER TABLE public.customers
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX customers_active_idx ON public.customers (active);
