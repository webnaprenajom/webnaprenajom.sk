-- =============================================================================
-- Transform preview (DRY RUN) — SELECT only, no writes
-- Shows how staging JSONB would map to canonical columns.
-- Run after staging import. Replace batch_key as needed.
-- =============================================================================

-- CUSTOMERS preview
SELECT
  s.legacy_id AS id,
  lower(trim(s.payload->>'email')) AS email,
  coalesce(nullif(trim(s.payload->>'display_name'), ''), 'Unknown') AS display_name,
  coalesce(s.payload->'metadata', '{}'::jsonb) AS metadata,
  coalesce((s.payload->>'active')::boolean, true) AS active,
  s.payload->>'created_at' AS created_at,
  s.payload->>'updated_at' AS updated_at,
  CASE WHEN c.id IS NOT NULL AND c.id::text <> s.legacy_id THEN 'SKIP_UUID_COLLISION' ELSE 'INSERT' END AS promote_action
FROM public.legacy_import_rows s
JOIN public.legacy_import_batches b ON b.id = s.batch_id
LEFT JOIN public.customers c ON c.id::text = s.legacy_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND s.source_file = 'customers.csv'
LIMIT 50;

-- LEADS preview (customer_id FK)
SELECT
  s.legacy_id AS id,
  s.payload->>'name' AS name,
  s.payload->>'email' AS email,
  s.payload->>'customer_id' AS customer_id,
  s.payload->>'status' AS status,
  CASE
    WHEN c.id IS NOT NULL THEN 'SKIP_UUID_COLLISION'
    WHEN coalesce(s.payload->>'customer_id', '') <> ''
         AND NOT EXISTS (
           SELECT 1 FROM public.legacy_import_rows cx
           WHERE cx.source_file = 'customers.csv' AND cx.legacy_id = s.payload->>'customer_id'
         ) THEN 'REVIEW_ORPHAN_FK'
    ELSE 'INSERT'
  END AS promote_action
FROM public.legacy_import_rows s
JOIN public.legacy_import_batches b ON b.id = s.batch_id
LEFT JOIN public.leads c ON c.id::text = s.legacy_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND s.source_file = 'leads.csv'
LIMIT 50;

-- PAYMENT_RECORDS (FACT) — import as-is, never derive from rental_payments
SELECT
  f.legacy_id AS id,
  f.payload->>'source_table' AS source_table,
  f.payload->>'source_id' AS source_id,
  (f.payload->>'amount')::numeric AS amount,
  f.payload->>'truth_level' AS truth_level,
  f.payload->>'paid_at' AS paid_at,
  CASE WHEN pr.id IS NOT NULL THEN 'SKIP_UUID_COLLISION' ELSE 'INSERT_FACT' END AS promote_action
FROM public.legacy_finance_staging f
JOIN public.legacy_import_batches b ON b.id = f.batch_id
LEFT JOIN public.payment_records pr ON pr.id::text = f.legacy_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND f.source_file = 'payment_records.csv';

-- TASKS — backfill parent_type/parent_id from customer_id (Batch 2 pattern)
SELECT
  s.legacy_id AS id,
  s.payload->>'title' AS title,
  s.payload->>'customer_id' AS customer_id,
  CASE WHEN coalesce(s.payload->>'customer_id', '') <> '' THEN 'customer' END AS parent_type,
  CASE WHEN coalesce(s.payload->>'customer_id', '') <> '' THEN (s.payload->>'customer_id')::uuid END AS parent_id
FROM public.legacy_import_rows s
JOIN public.legacy_import_batches b ON b.id = s.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND s.source_file = 'tasks.csv';

-- USER_ROLES — manual only (preview blocked)
SELECT
  s.legacy_id,
  s.payload->>'user_id' AS legacy_auth_user_id,
  s.payload->>'role' AS role,
  'MANUAL_ONLY' AS promote_action,
  CASE WHEN u.id IS NULL THEN 'auth.users missing on team' ELSE 'auth.users exists' END AS auth_status
FROM public.legacy_import_rows s
JOIN public.legacy_import_batches b ON b.id = s.batch_id
LEFT JOIN auth.users u ON u.id::text = s.payload->>'user_id'
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND s.source_file = 'user_roles.csv';
