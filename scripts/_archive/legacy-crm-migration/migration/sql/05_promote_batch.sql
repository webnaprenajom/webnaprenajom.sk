-- =============================================================================
-- Phase 5 promote — SQL Editor entrypoint
-- Migrations: 20260620180000 + 20260620190000
-- =============================================================================

-- Full dry-run (all wired SQL steps):
SELECT public.legacy_promote_batch('legacy_crm_2026_06_20', true);

-- Partial dry-run (subset only):
SELECT public.legacy_promote_batch(
  'legacy_crm_2026_06_20',
  true,
  ARRAY['customers', 'leads']
);

-- Allowed p_steps values ONLY:
--   customers, leads, lead_logs, payment_records
-- NULL p_steps = all wired steps.

-- EXECUTE (BLOCKED at CLI without MIGRATION_ALLOW_PROMOTE + MIGRATION_APPROVED_BATCH):
-- SELECT public.legacy_promote_batch('legacy_crm_2026_06_20', false, ARRAY['customers']);

-- See scripts/migration/promote/README.md for full vs partial promote matrix.
