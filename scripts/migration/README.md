# Legacy CRM Migration — Phase 1 (Staging)

Import legacy CSV exports into staging tables and generate conflict reports.
**Does not promote into canonical business tables.**

## Prerequisites

1. Apply migration `supabase/migrations/20260618000000_legacy_import_staging.sql`
2. Set env vars (see `.env.example`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Commands

```bash
# Dry-run (parse + analyze + reports, no DB writes)
npm run migrate:legacy:staging -- --dry-run --batch legacy_crm_2026_06 --dir "C:/Users/.../Downloads"

# Staging import + analysis + DB review queue
npm run migrate:legacy:staging -- --batch legacy_crm_2026_06 --dir "./data/legacy-csv"
```

## Outputs

Written to `scripts/migration/reports/`:

- `migration-report-<batch>.json`
- `migration-report-<batch>.md`
- `review-queue-<batch>.csv`

## Supported CSV filenames

See `scripts/migration/lib/sources.ts` for aliases (e.g. `rental_websites-2.csv`).
