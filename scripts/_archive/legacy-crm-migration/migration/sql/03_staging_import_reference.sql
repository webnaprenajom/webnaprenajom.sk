-- =============================================================================
-- Staging schema reference (already deployed via migration)
-- supabase/migrations/20260618000000_legacy_import_staging.sql
--
-- Phase 2 import targets:
--   legacy_import_rows      — entity / activity / config (JSONB payload)
--   legacy_finance_staging  — workflow + FACT finance CSVs
--   legacy_import_batches   — batch tracking
--   legacy_id_map           — populated during promote (empty in Phase 2)
--   migration_review_queue  — ambiguous rows for human review
-- =============================================================================

-- Optional: verify staging tables empty before first import
SELECT
  (SELECT count(*) FROM public.legacy_import_batches) AS batches,
  (SELECT count(*) FROM public.legacy_import_rows) AS import_rows,
  (SELECT count(*) FROM public.legacy_finance_staging) AS finance_rows,
  (SELECT count(*) FROM public.migration_review_queue) AS review_queue;

-- CSV import is performed via CLI (service role):
--   npm run migrate:legacy:dry-run
--   npm run migrate:legacy:staging -- --batch legacy_crm_2026_06_20 --dir ./crm-export
--
-- Idempotency: UNIQUE (source_file, legacy_id) on staging tables;
-- row_hash detects payload changes for updates.
