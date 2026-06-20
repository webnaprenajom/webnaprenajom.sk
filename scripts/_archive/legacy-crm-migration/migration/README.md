# Legacy CRM Migration — Phase 2–5

Staging-first import, live analysis, promote dry-run. **No production promote** without explicit approval + env vars.

## Operator sequence

See **`promote/README.md`** for the full step-by-step table (db push → staging → dry-run → review → optional execute).

## Prerequisites

1. Migrations on team DB:
   - `20260618000000_legacy_import_staging.sql`
   - `20260620180000_legacy_promote_batch.sql`
   - `20260620190000_legacy_promote_partial_steps.sql`
2. Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Commands

```bash
npm run migrate:legacy:dry-run
npm run migrate:legacy:dry-run -- --write-staging
npm run migrate:legacy:promote -- --batch legacy_crm_2026_06_20 --dry-run
npm run migrate:legacy:promote -- --dry-run --steps customers,leads
```

Execute requires `MIGRATION_ALLOW_PROMOTE=true` and `MIGRATION_APPROVED_BATCH=legacy_crm_2026_06_20`.

## SQL wired vs TODO

| SQL wired (4) | CLI plan only (14) |
|---------------|-------------------|
| customers, leads, lead_logs, payment_records | see promote/README.md |

## Docs

- `docs/migration/SCHEMA_MAPPING.md`
- `promote/README.md`
