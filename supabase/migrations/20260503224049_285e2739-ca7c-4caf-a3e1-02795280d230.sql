
ALTER TABLE public.rental_websites ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.rental_payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'none';
