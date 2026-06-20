-- =============================================================================
-- Preflight validation — run AFTER staging import (legacy_import_* populated)
-- Read-only queries against staging JSONB payloads.
-- Replace :batch_key with your batch, e.g. 'legacy_crm_2026_06_20'
-- =============================================================================

-- A) Staging row counts by source file
SELECT r.source_file, count(*) AS rows
FROM public.legacy_import_rows r
JOIN public.legacy_import_batches b ON b.id = r.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
GROUP BY r.source_file
UNION ALL
SELECT f.source_file, count(*)
FROM public.legacy_finance_staging f
JOIN public.legacy_import_batches b ON b.id = f.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
GROUP BY f.source_file
ORDER BY 1;

-- B) Duplicate legacy IDs within batch (should be zero)
SELECT source_file, legacy_id, count(*)
FROM public.legacy_import_rows r
JOIN public.legacy_import_batches b ON b.id = r.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
GROUP BY source_file, legacy_id
HAVING count(*) > 1;

-- C) Orphan customer_id in staged leads
SELECT r.legacy_id, r.payload->>'customer_id' AS customer_id
FROM public.legacy_import_rows r
JOIN public.legacy_import_batches b ON b.id = r.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND r.source_file = 'leads.csv'
  AND coalesce(r.payload->>'customer_id', '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.legacy_import_rows c
    WHERE c.source_file = 'customers.csv'
      AND c.legacy_id = r.payload->>'customer_id'
  );

-- D) Orphan website_id in staged rental_payments
SELECT f.legacy_id, f.payload->>'website_id' AS website_id
FROM public.legacy_finance_staging f
JOIN public.legacy_import_batches b ON b.id = f.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND f.source_file = 'rental_payments.csv'
  AND coalesce(f.payload->>'website_id', '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.legacy_import_rows rw
    WHERE rw.source_file = 'rental_websites.csv'
      AND rw.legacy_id = f.payload->>'website_id'
  );

-- E) FACT payment_records that reference workflow rental_payments (do not re-derive)
SELECT f.legacy_id,
       f.payload->>'source_table' AS source_table,
       f.payload->>'source_id' AS source_id
FROM public.legacy_finance_staging f
JOIN public.legacy_import_batches b ON b.id = f.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND f.source_file = 'payment_records.csv'
  AND f.payload->>'source_table' = 'rental_payments'
  AND EXISTS (
    SELECT 1 FROM public.legacy_finance_staging rp
    WHERE rp.source_file = 'rental_payments.csv'
      AND rp.legacy_id = f.payload->>'source_id'
  );

-- F) UUID collision preview — customers (staging vs team)
SELECT s.legacy_id AS legacy_customer_id,
       s.payload->>'email' AS email,
       c.id AS team_customer_id
FROM public.legacy_import_rows s
JOIN public.legacy_import_batches b ON b.id = s.batch_id
JOIN public.customers c ON lower(trim(c.email)) = lower(trim(s.payload->>'email'))
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND s.source_file = 'customers.csv'
  AND s.legacy_id::uuid <> c.id;

-- G) Review queue pending items
SELECT entity_type, reason, count(*)
FROM public.migration_review_queue
WHERE status = 'pending'
GROUP BY entity_type, reason
ORDER BY count(*) DESC;

-- H) Invalid truth_level in staged FACT rows
SELECT f.source_file, f.legacy_id, f.payload->>'truth_level' AS truth_level
FROM public.legacy_finance_staging f
JOIN public.legacy_import_batches b ON b.id = f.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND f.source_file IN ('payment_records.csv', 'cost_records.csv', 'payout_records.csv')
  AND coalesce(f.payload->>'truth_level', '') NOT IN (
    'legacy_import', 'payment_fact', 'cost_fact', 'payout_fact'
  );
