-- RC5: rental customer identity hardening (additive, conservative backfill)

-- Denormalized email for rental save path + lookup (mirrors hosting/project pattern)
ALTER TABLE public.rental_websites
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

COMMENT ON COLUMN public.rental_websites.customer_email IS
  'Normalized customer email — denormalized from customers when customer_id set';

-- Backfill customer_email from linked customers
UPDATE public.rental_websites rw
SET customer_email = lower(trim(c.email))
FROM public.customers c
WHERE rw.customer_id = c.id
  AND c.email IS NOT NULL
  AND trim(c.email) <> ''
  AND (rw.customer_email IS NULL OR trim(rw.customer_email) = '');

-- High-confidence customer_id backfill: single lead with exact normalized name + customer_id
UPDATE public.rental_websites rw
SET customer_id = sub.proposed_customer_id,
    customer_email = COALESCE(rw.customer_email, sub.proposed_email)
FROM (
  SELECT
    rw2.id AS rental_id,
    l.customer_id AS proposed_customer_id,
    lower(trim(c.email)) AS proposed_email
  FROM public.rental_websites rw2
  INNER JOIN public.leads l
    ON lower(regexp_replace(trim(l.name), '\s+', ' ', 'g')) =
       lower(regexp_replace(trim(rw2.client_name), '\s+', ' ', 'g'))
  LEFT JOIN public.customers c ON c.id = l.customer_id
  WHERE rw2.customer_id IS NULL
    AND rw2.client_name IS NOT NULL
    AND trim(rw2.client_name) <> ''
    AND l.customer_id IS NOT NULL
    AND (
      SELECT count(*)
      FROM public.leads l2
      WHERE lower(regexp_replace(trim(l2.name), '\s+', ' ', 'g')) =
            lower(regexp_replace(trim(rw2.client_name), '\s+', ' ', 'g'))
    ) = 1
) sub
WHERE rw.id = sub.rental_id;

CREATE INDEX IF NOT EXISTS rental_websites_customer_email_idx
  ON public.rental_websites (customer_email)
  WHERE customer_email IS NOT NULL;
