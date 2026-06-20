-- =============================================================================
-- Rollback — batch-scoped, partial-safe
-- Deletes ONLY rows linked in legacy_id_map for the given batch_key
-- with match_method = 'uuid_preserve'. Staging never touched.
-- Migration: 20260620190000_legacy_promote_partial_steps.sql
-- =============================================================================

-- Preview what would be deleted:
SELECT m.entity_type, m.legacy_id, m.canonical_id, m.match_method, b.batch_key
FROM public.legacy_id_map m
JOIN public.legacy_import_batches b ON b.id = m.batch_id
WHERE b.batch_key = 'legacy_crm_2026_06_20'
  AND m.match_method = 'uuid_preserve'
ORDER BY
  CASE m.entity_type
    WHEN 'lead_log' THEN 1
    WHEN 'payment_record' THEN 2
    WHEN 'lead' THEN 3
    WHEN 'customer' THEN 4
    ELSE 5
  END,
  m.legacy_id;

-- Full rollback (wired v1 entity types):
-- SELECT public.legacy_rollback_batch('legacy_crm_2026_06_20');

-- Partial rollback (e.g. only lead_logs from this batch):
-- SELECT public.legacy_rollback_batch('legacy_crm_2026_06_20', ARRAY['lead_log']);

-- Entity type filter values: customer, lead, lead_log, payment_record
-- (extend as new SQL promote steps are added)
