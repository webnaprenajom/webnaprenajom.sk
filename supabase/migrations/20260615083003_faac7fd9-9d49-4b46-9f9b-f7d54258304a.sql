ALTER TABLE public.hosting_records
  ADD COLUMN IF NOT EXISTS period_from DATE,
  ADD COLUMN IF NOT EXISTS period_to DATE,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_note TEXT;