# Promote Plan — legacy_crm_2026_06_20

- **Dry run:** false
- **Target:** `qosxlmrrkyvobjigsynt`

## Outcomes

| Outcome | Count |
|---------|------:|
| would_insert | 1042 |
| skip_orphan_fk | 40 |
| skip_ambiguous_identity | 6 |

## By source

| Source | Would insert | Skipped | Review queue |
|--------|-------------:|--------:|-------------:|
| customers.csv | 532 | 0 | 0 |
| commission_rules.csv | 4 | 0 | 0 |
| leads.csv | 418 | 3 | 7 |
| hosting_records.csv | 1 | 3 | 3 |
| rental_payments.csv | 0 | 23 | 23 |
| commissions.csv | 15 | 0 | 0 |
| payment_records.csv | 1 | 15 | 15 |
| cost_records.csv | 8 | 0 | 0 |
| payout_records.csv | 7 | 0 | 0 |
| expenses.csv | 19 | 0 | 0 |
| lead_logs.csv | 9 | 2 | 2 |
| design_proposals.csv | 9 | 0 | 0 |
| communication_events.csv | 19 | 0 | 0 |

## SQL RPC wiring status

| Source | Status | SQL step |
|--------|--------|----------|
| customers.csv | sql_wired | customers |
| commission_rules.csv | sql_wired | commission_rules |
| leads.csv | sql_wired | leads |
| rental_websites.csv | sql_wired | rental_websites |
| hosting_records.csv | sql_wired | hosting_records |
| rental_payments.csv | sql_wired | rental_payments |
| commissions.csv | sql_wired | commissions |
| payment_records.csv | sql_wired | payment_records |
| cost_records.csv | sql_wired | cost_records |
| payout_records.csv | sql_wired | payout_records |
| expenses.csv | sql_wired | expenses |
| project_notes.csv | sql_wired | project_notes |
| tasks.csv | sql_wired | tasks |
| lead_logs.csv | sql_wired | lead_logs |
| notifications.csv | sql_wired | notifications |
| wheel_spins.csv | sql_wired | wheel_spins |
| design_proposals.csv | sql_wired | design_proposals |
| communication_events.csv | sql_wired | communication_events |
| user_roles.csv | manual_only | manual |
| team_profiles.csv | skip_policy | — |
| order_signatures.csv | skip_policy | — |
| commission_rule_overrides.csv | skip_policy | — |
| customer_communication_summaries.csv | skip_policy | — |

## Live team DB collisions

- UUID: 0
- Customer email: 0

## Skip reasons by source (top)

- **leads.csv**: skip_ambiguous_identity=3
- **hosting_records.csv**: skip_ambiguous_identity=3
- **rental_payments.csv**: skip_orphan_fk=23
- **payment_records.csv**: skip_orphan_fk=15
- **lead_logs.csv**: skip_orphan_fk=2

## Policies

- Orphan `lead_logs` → **OPTION A skip** (staging + review queue)
- UUID collision → skip, no reassign
- Same email, different customer UUID → skip, no merge
- `user_roles` → manual only
- FACT finance → import as-is, no workflow derivation

## Partial promote (SQL)

Wired steps: `customers`, `commission_rules`, `leads`, `rental_websites`, `hosting_records`, `rental_payments`, `commissions`, `payment_records`, `cost_records`, `payout_records`, `expenses`, `project_notes`, `tasks`, `lead_logs`, `notifications`, `wheel_spins`, `design_proposals`, `communication_events`
```sql
SELECT public.legacy_promote_batch('legacy_crm_2026_06_20', true, ARRAY['customers','leads']);
```