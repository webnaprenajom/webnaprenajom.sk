# Legacy CRM → Team Supabase — Schema Mapping

> Batch: `legacy_crm_2026_06_20` · Target: `qosxlmrrkyvobjigsynt` · Export: `crm-export/`

## Policies (binding)

| Rule | Action |
|------|--------|
| UUID exists on team | **Skip** + `migration_review_queue` |
| Same email, different customer UUID | **Skip** — no auto-merge |
| `user_roles` | **Manual** after `auth.users` review |
| FACT in export | Import FACT as-is — **do not** derive from workflow |
| Sensitive fields | Stage raw; redact in reports |

## Staging destination

| Kind | Staging table |
|------|---------------|
| entity, activity, config | `legacy_import_rows` |
| finance (workflow + FACT) | `legacy_finance_staging` |

---

## Table mapping

### customers.csv → `public.customers`

| Old column | New column | Transform | Confidence |
|------------|------------|-----------|:----------:|
| id | id | preserve UUID | HIGH |
| email | email | `lower(trim())` | HIGH |
| display_name | display_name | required; default `Unknown` if empty | HIGH |
| metadata | metadata | JSONB cast | HIGH |
| active | active | boolean, default true | HIGH |
| created_at | created_at | timestamptz | HIGH |
| updated_at | updated_at | timestamptz | HIGH |

**Policy:** migrate · **Order:** 1

---

### team_profiles.csv → `public.team_profiles`

| Old column | New column | Notes |
|------------|------------|-------|
| user_id | user_id | PK; requires auth.users |
| display_name | display_name | |
| implementer_name | implementer_name | |
| active | active | |

**Policy:** skip (empty export) · **Order:** —

---

### user_roles.csv → `public.user_roles`

| Old column | New column | Notes |
|------------|------------|-------|
| id | id | preserve UUID |
| user_id | user_id | **Must exist in team auth.users** |
| role | role | `app_role` enum |
| created_at | created_at | |

**Policy:** **manual only** · **Order:** after auth setup

---

### leads.csv → `public.leads`

| Old column | New column | Transform | Confidence |
|------------|------------|-----------|:----------:|
| id | id | preserve UUID | HIGH |
| name | name | required | HIGH |
| email | email | required | HIGH |
| phone | phone | | HIGH |
| message | message | multiline CSV safe | HIGH |
| type | type | default `ai` | HIGH |
| consultation_date | consultation_date | timestamptz | HIGH |
| consultation_time | consultation_time | | HIGH |
| language | language | default `sk` | HIGH |
| status | status | | HIGH |
| notes | notes | | HIGH |
| source | source | | HIGH |
| temperature | temperature | | HIGH |
| assigned_to | assigned_to | | HIGH |
| amount | amount | numeric | HIGH |
| status_changed_at | status_changed_at | | HIGH |
| imported | imported | | HIGH |
| import_batch | import_batch | | HIGH |
| follow_up_date | follow_up_date | date | HIGH |
| customer_id | customer_id | FK → customers; 7 rows missing in export | MEDIUM |
| created_at | created_at | | HIGH |
| updated_at | updated_at | | HIGH |

**Policy:** migrate · **Order:** 3

---

### rental_websites.csv → `public.rental_websites`

| Old column | New column | Notes |
|------------|------------|-------|
| id | id | preserve UUID |
| name | name | required |
| url | url | |
| client_name | client_name | |
| monthly_price | monthly_price | |
| year | year | |
| note | note | |
| source | source | |
| rental_start_date | rental_start_date | |
| credits_used | credits_used | |
| implementers | implementers | JSONB |
| customer_id | customer_id | **0 in export** — bridge via customer_email |
| customer_email | customer_email | legacy bridge |
| created_at / updated_at | same | |

**Policy:** migrate · **Order:** 4

---

### hosting_records.csv → `public.hosting_records`

All export columns map 1:1 including `operating_cost`, `period_from`, `period_to`, `payment_status`, `payment_note`.

**Policy:** migrate · **Order:** 5

---

### rental_payments.csv → `public.rental_payments` (workflow)

| Old column | New column |
|------------|------------|
| id | id |
| website_id | website_id |
| year, month | year, month |
| amount | amount |
| paid | paid |
| paid_at | paid_at |
| status | status |
| custom_price | custom_price |

**Policy:** migrate · **Order:** 6 · **Not** auto-promoted to payment_records

---

### commission_rules.csv → `public.commission_rules`

1:1 mapping. **Order:** 2

### commission_rule_overrides.csv → `public.commission_rule_overrides`

Empty export. **Policy:** skip

---

### commissions.csv → `public.commissions` (workflow)

Includes `payment_form`, `source_type`, `source_id`, `customer_email`, `customer_id`.

**Policy:** migrate · **Order:** 7 · **Not** auto-promoted to payout_records

---

### payment_records.csv → `public.payment_records` (FACT)

| truth_level | Valid values |
|-------------|--------------|
| export | `legacy_import`, `payment_fact` |

Preserve `source_table` + `source_id` unique index. **Order:** 8a

### cost_records.csv → `public.cost_records` (FACT)

**Order:** 8b

### payout_records.csv → `public.payout_records` (FACT)

**Order:** 8c

---

### expenses.csv → `public.expenses` (workflow/legacy)

**Policy:** migrate · **Order:** 9 · Do not duplicate into cost_records if FACT exists

---

### tasks.csv → `public.tasks`

| Old column | New column | Notes |
|------------|------------|-------|
| * | * | 1:1 |
| customer_id | customer_id | |
| — | parent_type | backfill `'customer'` when customer_id set |
| — | parent_id | backfill customer_id |

**Policy:** migrate · **Order:** 10

---

### project_notes.csv → `public.project_notes`

Sensitive: `username`, `password`, `access_credentials` — review queue, redacted reports.

**Policy:** migrate · **Order:** 10

---

### lead_logs.csv → `public.lead_logs`

**Policy:** migrate · **Order:** 11 · Disable `trg_log_lead_changes` during promote only

---

### notifications.csv → `public.notifications`

**Order:** 11 · Disable `trg_log_notification_insert` during promote only

---

### wheel_spins.csv, design_proposals.csv, order_signatures.csv

Standard 1:1. order_signatures empty → skip.

---

### communication_events.csv → `public.communication_events`

Validate `kind` enum. FK `customer_id`.

---

### customer_communication_summaries.csv

PK = `customer_id`. Empty → skip.

---

## Excluded (not in export)

`admin_audit_log`, `finance_issue_dismissals`, `finance_policy_settings`, `finance_review_items`, `legacy_import_*` (target infra), `communication_webhook_incidents`, `user_email_accounts`, `marketing_records` (new-only).

---

## Identity resolution

1. Preserve legacy UUID (`ON CONFLICT DO NOTHING`)
2. `legacy_id_map` records skips
3. Missing `customer_id`: match email → single customer only
4. Ambiguous: `migration_review_queue`
