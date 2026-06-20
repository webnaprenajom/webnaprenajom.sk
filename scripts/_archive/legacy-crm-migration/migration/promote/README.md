# Phase 5 — Promote runbook (team Supabase `qosxlmrrkyvobjigsynt`)

**Production promote is blocked** until you send **both**:

1. Explicit message: `approve promote for batch legacy_crm_2026_06_20 against team DB`
2. Environment:
   ```powershell
   $env:MIGRATION_ALLOW_PROMOTE = "true"
   $env:MIGRATION_APPROVED_BATCH = "legacy_crm_2026_06_20"
   ```

Nothing runs `--execute` automatically.

### Approval contract (full promote — 18 wired tables)

Until you send an explicit approval message, treat all `--execute` as off-limits.

**Example approval message:**

```text
approve promote for batch legacy_crm_2026_06_20 against team DB
```

**You must also set:**

```powershell
$env:MIGRATION_ALLOW_PROMOTE = "true"
$env:MIGRATION_APPROVED_BATCH = "legacy_crm_2026_06_20"
```

**Full execute (all 18 business steps, README order):**

```powershell
npm run migrate:legacy:promote -- --execute --batch legacy_crm_2026_06_20
```

**Partial execute** (subset only — must match approved steps):

```powershell
npm run migrate:legacy:promote -- --execute --batch legacy_crm_2026_06_20 --steps customers,leads
```

Allowed `--steps` values: all 18 in `SQL_WIRED_STEPS` (see `promoteTableRegistry.ts`).

---

## Operator sequence (exact order)

| Step | Command / action | Touches production? |
|------|-------------------|---------------------|
| **0** | Set `SUPABASE_SERVICE_ROLE_KEY` in `.env` or `.env.team` | No |
| **1** | `npx supabase link --project-ref qosxlmrrkyvobjigsynt` | No |
| **2** | `npx supabase db push` (applies staging + promote migrations) | Schema only |
| **3** | SQL Editor: `sql/01_preflight_introspection.sql` | Read-only |
| **4** | `npm run migrate:legacy:dry-run` | Read-only |
| **5** | `npm run migrate:legacy:dry-run -- --write-staging` | **Staging only** |
| **6** | SQL Editor: `sql/02_preflight_validation.sql` | Read-only |
| **7** | `npm run migrate:legacy:promote -- --batch legacy_crm_2026_06_20 --dry-run` | Read-only |
| **8** | Review `reports/promote-plan-*.md`, `promote-skipped-*.csv`, `user-roles-mapping-*.yaml` | No |
| **9** | Manual: create team `auth.users`, fill user_roles mapping | Maybe auth only |
| **10** | **Only after approval:** partial or full `--execute` | **Yes** |

---

## Table wiring matrix

### SQL RPC wired (`legacy_promote_batch` — all 18 business tables)

These have full column-mapping SQL and can be promoted via RPC (dry-run or execute) in README dependency order:

| SQL step | Source CSV | Canonical table | Notes |
|----------|------------|-----------------|-------|
| `customers` | customers.csv | customers | UUID + email collision skip |
| `commission_rules` | commission_rules.csv | commission_rules | config |
| `leads` | leads.csv | leads | 3 triggers disabled **only** during this insert |
| `rental_websites` | rental_websites.csv | rental_websites | customer_email bridge |
| `hosting_records` | hosting_records.csv | hosting_records | customer bridge required |
| `rental_payments` | rental_payments.csv | rental_payments | workflow — never derive FACT |
| `commissions` | commissions.csv | commissions | workflow — never derive FACT |
| `payment_records` | payment_records.csv | payment_records | FACT as exported |
| `cost_records` | cost_records.csv | cost_records | FACT as exported |
| `payout_records` | payout_records.csv | payout_records | FACT as exported |
| `expenses` | expenses.csv | expenses | workflow/legacy |
| `project_notes` | project_notes.csv | project_notes | credentials as exported |
| `tasks` | tasks.csv | tasks | parent_type backfill when customer_id |
| `lead_logs` | lead_logs.csv | lead_logs | **OPTION A** — skip orphan `lead_id` |
| `notifications` | notifications.csv | notifications | `trg_log_notification_insert` off during bulk |
| `wheel_spins` | wheel_spins.csv | wheel_spins | skip rows without email |
| `design_proposals` | design_proposals.csv | design_proposals | |
| `communication_events` | communication_events.csv | communication_events | kind enum validated |

**Partial promote example:**

```powershell
npm run migrate:legacy:promote -- --batch legacy_crm_2026_06_20 --dry-run --steps customers,leads
```

```sql
SELECT public.legacy_promote_batch('legacy_crm_2026_06_20', true, ARRAY['customers','leads']);
```

**Full promote dry-run:**

```powershell
npm run migrate:legacy:promote -- --batch legacy_crm_2026_06_20 --dry-run
```

```sql
SELECT public.legacy_promote_batch('legacy_crm_2026_06_20', true);
```

### Manual only

| Source | Policy |
|--------|--------|
| user_roles.csv | Fill `user-roles-mapping-*.yaml` → manual SQL insert |

### Skipped by policy (empty or n/a)

`team_profiles`, `order_signatures`, `commission_rule_overrides`, `customer_communication_summaries`

---

## Binding policies

| Policy | Behavior |
|--------|----------|
| Orphan lead_logs | **OPTION A** — skip; staging + review queue |
| UUID collision | Skip; `legacy_id_map`; no UUID reassignment |
| Email collision | Skip; no customer merge |
| Identity gaps | Email bridge when unique; **no auto-create customer** |
| Duplicate-email leads | Each lead inserts separately; `reviewQueue: true` |
| FACT vs workflow | FACT imported as-is; never derive from rental_payments |
| Triggers | Only 3 named triggers off during lead bulk insert |
| Overwrite | `ON CONFLICT DO NOTHING` only |

---

## CLI reference

```powershell
# Full CLI promote plan + live collisions (all 18 ordered tables)
npm run migrate:legacy:promote -- --batch legacy_crm_2026_06_20 --dry-run

# Partial SQL RPC preview
npm run migrate:legacy:promote -- --dry-run --steps customers,leads,lead_logs

# Execute (BLOCKED without approval env vars)
$env:MIGRATION_ALLOW_PROMOTE = "true"
$env:MIGRATION_APPROVED_BATCH = "legacy_crm_2026_06_20"
npm run migrate:legacy:promote -- --execute --steps customers,leads
```

Dry-run console output includes:

- Global outcomes (`would_insert`, `skip_orphan_fk`, …)
- Live UUID / email collision counts
- Per-table: would / skip / review / SQL wired?
- Top skip reasons per table

---

## Rollback (batch-scoped, partial-safe)

Rollback deletes **only** rows where:

- `legacy_id_map.batch_id` = this batch
- `legacy_id_map.match_method` = `uuid_preserve`
- DELETE uses `USING legacy_id_map` join — **never** touches unmapped rows

Preview:

```sql
-- sql/06_rollback_batch.sql
```

Partial rollback (lead_logs only):

```sql
SELECT public.legacy_rollback_batch('legacy_crm_2026_06_20', ARRAY['lead_log']);
```

Full rollback (all 18 business entity types, children first):

```sql
SELECT public.legacy_rollback_batch('legacy_crm_2026_06_20');
-- or entity filter: ARRAY['lead_log','lead','customer']
```

Staging tables (`legacy_import_*`) are **never** deleted by rollback.

---

## user_roles (manual)

1. Run promote dry-run → generates `user-roles-mapping-<batch>.yaml`
2. Create users in team Auth dashboard
3. Fill `team_user_id` per row
4. Insert manually — never into `profiles`

---

## Migrations required on team DB

| Migration | Purpose |
|-----------|---------|
| `20260618000000_legacy_import_staging.sql` | Staging tables |
| `20260620180000_legacy_promote_batch.sql` | Promote RPCs v1 |
| `20260620190000_legacy_promote_partial_steps.sql` | Partial steps + safer rollback |

---

## What NOT to do

- Run `--execute` without approval message + env vars
- Full `--execute` while 14 tables remain SQL-TODO
- `TRUNCATE` production tables
- Auto-merge customers or leads
- Derive FACT from workflow
- Drop FK constraints for orphan lead_logs
- Disable all triggers globally
