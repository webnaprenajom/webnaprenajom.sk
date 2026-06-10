-- Add payment form to commission records (additive)

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS payment_form TEXT
    CHECK (payment_form IS NULL OR payment_form IN ('cash', 'iban', 'crypto', 'faktura', 'ine'));
