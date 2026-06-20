ALTER TABLE public.rental_websites
  ADD COLUMN IF NOT EXISTS rental_start_date date,
  ADD COLUMN IF NOT EXISTS credits_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS custom_price numeric;