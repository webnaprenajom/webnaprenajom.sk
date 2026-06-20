-- Batch F1: safe email-first customer backfill (no ambiguous name merges)

-- 1) Seed customers from distinct normalized emails across CRM sources
INSERT INTO public.customers (email, display_name, metadata)
SELECT DISTINCT ON (src.email_norm)
  src.email_norm,
  src.display_name,
  jsonb_build_object('backfill_batch', 'F1', 'backfill_source', src.source_table, 'backfill_at', now())
FROM (
  SELECT lower(trim(email)) AS email_norm,
         trim(name) AS display_name,
         'leads' AS source_table,
         created_at
  FROM public.leads
  WHERE email IS NOT NULL AND trim(email) <> '' AND email LIKE '%@%'

  UNION ALL

  SELECT lower(trim(email)),
         coalesce(nullif(trim(client_name), ''), split_part(lower(trim(email)), '@', 1)),
         'order_signatures',
         coalesce(signed_at, created_at)
  FROM public.order_signatures
  WHERE email IS NOT NULL AND trim(email) <> '' AND email LIKE '%@%'

  UNION ALL

  SELECT lower(trim(customer_email)),
         coalesce(nullif(trim(client_name), ''), split_part(lower(trim(customer_email)), '@', 1)),
         'project_notes',
         updated_at
  FROM public.project_notes
  WHERE customer_email IS NOT NULL AND trim(customer_email) <> '' AND customer_email LIKE '%@%'

  UNION ALL

  SELECT lower(trim(customer_email)),
         coalesce(nullif(trim(client_name), ''), split_part(lower(trim(customer_email)), '@', 1)),
         'hosting_records',
         created_at
  FROM public.hosting_records
  WHERE customer_email IS NOT NULL AND trim(customer_email) <> '' AND customer_email LIKE '%@%'

  UNION ALL

  SELECT lower(trim(customer_email)),
         coalesce(nullif(trim(title), ''), split_part(lower(trim(customer_email)), '@', 1)),
         'commissions',
         (date::timestamptz)
  FROM public.commissions
  WHERE customer_email IS NOT NULL AND trim(customer_email) <> '' AND customer_email LIKE '%@%'

  UNION ALL

  SELECT lower(trim(email)),
         coalesce(nullif(trim(client_name), ''), split_part(lower(trim(email)), '@', 1)),
         'design_proposals',
         (sent_date::timestamptz)
  FROM public.design_proposals
  WHERE email IS NOT NULL AND trim(email) <> '' AND email LIKE '%@%'
) src
WHERE src.email_norm IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.email = src.email_norm
  )
ORDER BY src.email_norm, src.created_at DESC;

-- Prefer earliest lead name when customer already exists without display refresh
UPDATE public.customers c
SET display_name = sub.display_name
FROM (
  SELECT DISTINCT ON (lower(trim(l.email)))
    lower(trim(l.email)) AS email_norm,
    trim(l.name) AS display_name
  FROM public.leads l
  WHERE l.email IS NOT NULL AND trim(l.email) <> ''
  ORDER BY lower(trim(l.email)), l.created_at ASC
) sub
WHERE c.email = sub.email_norm
  AND (c.display_name IS NULL OR c.display_name = split_part(c.email, '@', 1));

-- 2) Auto-link by normalized email (only where customer_id is still null)
UPDATE public.leads l
SET customer_id = c.id
FROM public.customers c
WHERE l.customer_id IS NULL
  AND c.email = lower(trim(l.email))
  AND l.email IS NOT NULL AND trim(l.email) <> '';

UPDATE public.project_notes pn
SET customer_id = c.id
FROM public.customers c
WHERE pn.customer_id IS NULL
  AND c.email = lower(trim(pn.customer_email))
  AND pn.customer_email IS NOT NULL AND trim(pn.customer_email) <> '';

UPDATE public.hosting_records hr
SET customer_id = c.id
FROM public.customers c
WHERE hr.customer_id IS NULL
  AND c.email = lower(trim(hr.customer_email))
  AND hr.customer_email IS NOT NULL AND trim(hr.customer_email) <> '';

UPDATE public.commissions cm
SET customer_id = c.id
FROM public.customers c
WHERE cm.customer_id IS NULL
  AND c.email = lower(trim(cm.customer_email))
  AND cm.customer_email IS NOT NULL AND trim(cm.customer_email) <> '';

-- rental_websites: email link only via hosting/leads indirect — name-based deferred to review script
