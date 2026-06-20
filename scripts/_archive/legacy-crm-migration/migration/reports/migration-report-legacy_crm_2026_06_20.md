# Legacy CRM Migration Report — legacy_crm_2026_06_20

- **Dry run:** false
- **Target:** team Supabase `qosxlmrrkyvobjigsynt`
- **Directory:** D:\web-rent-wizard-759d8d0e\crm-export
- **Started:** 2026-06-20T12:16:27.807Z
- **Finished:** 2026-06-20T12:26:47.382Z

## Totals

| Metric | Count |
|--------|------:|
| Rows parsed | 3317 |
| Rows staged (entity/activity) | 3229 |
| Finance rows staged | 88 |
| Review items | 716 |
| Would promote (migrate policy) | 3315 |
| Would skip (empty/manual/skip policy) | 0 |
| Manual review rows | 2 |

## Import stats

| Source | Parsed | Inserted | Updated | Unchanged | Skipped |
|--------|-------:|---------:|--------:|----------:|--------:|
| commissions.csv | 15 | 15 | 0 | 0 | 0 |
| commission_rules.csv | 4 | 4 | 0 | 0 | 0 |
| commission_rule_overrides.csv | 0 | 0 | 0 | 0 | 0 |
| communication_events.csv | 19 | 19 | 0 | 0 | 0 |
| cost_records.csv | 8 | 8 | 0 | 0 | 0 |
| customers.csv | 532 | 532 | 0 | 0 | 0 |
| customer_communication_summaries.csv | 0 | 0 | 0 | 0 | 0 |
| design_proposals.csv | 9 | 9 | 0 | 0 | 0 |
| expenses.csv | 19 | 19 | 0 | 0 | 0 |
| hosting_records.csv | 4 | 4 | 0 | 0 | 0 |
| leads.csv | 486 | 486 | 0 | 0 | 0 |
| lead_logs.csv | 1606 | 1606 | 0 | 0 | 0 |
| notifications.csv | 529 | 529 | 0 | 0 | 0 |
| order_signatures.csv | 0 | 0 | 0 | 0 | 0 |
| payment_records.csv | 16 | 16 | 0 | 0 | 0 |
| payout_records.csv | 7 | 7 | 0 | 0 | 0 |
| project_notes.csv | 8 | 8 | 0 | 0 | 0 |
| rental_payments.csv | 23 | 23 | 0 | 0 | 0 |
| rental_websites.csv | 12 | 12 | 0 | 0 | 0 |
| tasks.csv | 6 | 6 | 0 | 0 | 0 |
| team_profiles.csv | 0 | 0 | 0 | 0 | 0 |
| user_roles.csv | 2 | 2 | 0 | 0 | 0 |
| wheel_spins.csv | 12 | 12 | 0 | 0 | 0 |

## Review summary

- **duplicate_email:** 4
- **ambiguous_customer_match:** 12
- **orphan_fk:** 633
- **sensitive_payload:** 8

## Duplicate email groups

- `kamenictvidiamond@gmail.com` → 2 leads (0470b6c1-4023-443d-a3f4-d618d279ed48, 0e2ace15-a96c-4d36-94b7-1e22d5fc9edf)
- `spravca@reality69.sk` → 2 leads (3ea7efd8-960a-4ca4-84e7-db04b38ba2d6, 664e977d-07e7-46c1-aae8-f91f9acce0b9)
- `greta.danielova@gmail.com` → 2 leads (22609120-09b4-4106-9422-5c9e4d982105, 52b71620-0d76-4b2f-a658-7c9cc2779150)
- `stano.pp@centrum.sk` → 2 leads (74a7365e-f266-4cef-a31a-04dac2337dbe, 834522fa-c4a9-4723-ac33-83334e73ecdc)

## UUID collisions (sample)

_None_

## Orphan FK risks (sample)

- [orphan_fk] lead_logs.csv / 61265ddd-a331-4a54-a5b2-ab61c9c3d7de: lead_id=af787e7f-28bc-4881-b9df-486edfac2675 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / 881df452-a730-48db-8c04-d12ed9d6fa15: lead_id=701f6593-6697-409c-bd97-5e5f11b30c24 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / 5b152be5-8520-4760-a0e4-994b74b1eeb3: lead_id=af787e7f-28bc-4881-b9df-486edfac2675 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / cf4b8742-a302-4eb5-a7d8-69c9378412e6: lead_id=961df627-1a32-43fa-aeb0-9882925a5988 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / 616fd427-2c62-4065-ac7d-47e4cb8b7701: lead_id=96768ecf-8f13-4824-b93c-d43c35537023 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / 99dfc9a4-0749-4c29-935a-64fa821c22d4: lead_id=66b34a54-eefb-49bd-999c-62848f4804b1 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / d4821a77-06fb-4a7c-98bc-c2046c7a0c29: lead_id=3e32a8e6-eeb0-4b66-8997-8c11eedef92c not found in staged leads.csv
- [orphan_fk] lead_logs.csv / c4c13f70-e2cd-480b-b7c3-96019813a954: lead_id=c9a55b78-6d14-4984-8a03-05dae7d3a31c not found in staged leads.csv
- [orphan_fk] lead_logs.csv / 39126774-389d-4034-b351-91a251891f87: lead_id=45dda642-7e8d-46f6-a291-003899d90da5 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / f67f9905-e66d-4403-b34f-1e3d368ede6f: lead_id=2472991f-676b-4e8f-afc7-2fd482a383ee not found in staged leads.csv
- [orphan_fk] lead_logs.csv / 360315e8-09a0-4a61-9888-75ab7db156b6: lead_id=cdd7ed2a-0698-4c55-8558-f79fa85a9d24 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / 9f4dd594-5116-41f1-82ea-ec2ba6405554: lead_id=a013731b-7ab5-4fed-94d1-95b5cb8c04b6 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / b450552f-ba5f-4217-953b-ec7557266dee: lead_id=88dfcfbc-dce1-40e1-ac30-18892db18541 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / 4cb0308f-be50-416c-936b-07b7ffd81103: lead_id=bcb4013a-90ba-4ec8-ad8a-0dcca7f00671 not found in staged leads.csv
- [orphan_fk] lead_logs.csv / d41434e3-3ada-45e6-b49a-7d38ca1872e6: lead_id=95de2ffb-a1c6-43af-8147-8d716b77bcf3 not found in staged leads.csv
- _…and 618 more_

## Sensitive payloads

Count: 8 (values redacted in reports)

## Reconciliation

- FACT payment_records: 16
- FACT cost_records: 8
- FACT payout_records: 7
- FACT derived from workflow in export: 16
- Rule: FACT rows imported as-is; do NOT re-derive from workflow when export FACT exists

### Promote plan

| Source | Rows | Policy | Staging |
|--------|-----:|--------|---------|
| customers.csv | 532 | migrate | legacy_import_rows |
| team_profiles.csv | 0 | skip | legacy_import_rows |
| user_roles.csv | 2 | manual | legacy_import_rows |
| leads.csv | 486 | migrate | legacy_import_rows |
| rental_websites.csv | 12 | migrate | legacy_import_rows |
| hosting_records.csv | 4 | migrate | legacy_import_rows |
| rental_payments.csv | 23 | migrate | legacy_finance_staging |
| commission_rules.csv | 4 | migrate | legacy_import_rows |
| commission_rule_overrides.csv | 0 | skip | legacy_import_rows |
| commissions.csv | 15 | migrate | legacy_finance_staging |
| payment_records.csv | 16 | migrate | legacy_finance_staging |
| cost_records.csv | 8 | migrate | legacy_finance_staging |
| payout_records.csv | 7 | migrate | legacy_finance_staging |
| expenses.csv | 19 | migrate | legacy_finance_staging |
| tasks.csv | 6 | migrate | legacy_import_rows |
| project_notes.csv | 8 | migrate | legacy_import_rows |
| lead_logs.csv | 1606 | migrate | legacy_import_rows |
| notifications.csv | 529 | migrate | legacy_import_rows |
| wheel_spins.csv | 12 | migrate | legacy_import_rows |
| design_proposals.csv | 9 | migrate | legacy_import_rows |
| order_signatures.csv | 0 | skip | legacy_import_rows |
| communication_events.csv | 19 | migrate | legacy_import_rows |
| customer_communication_summaries.csv | 0 | skip | legacy_import_rows |

### Manual only

- user_roles.csv: 2 rows — Requires auth.users review — never auto-promote

### Identity gaps (sample)

- [ambiguous_customer_match] leads.csv / 3ce5c737-c618-4aa2-b4d0-a885e449c67a: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] leads.csv / 1fb2e945-c7d2-43f4-94f8-b5ebdecb3176: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] leads.csv / 99a7ef58-d5ac-4765-bc50-2aaf4391af58: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] leads.csv / 792f0a3c-30cb-47c2-a945-8774302b9339: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] leads.csv / b82eb266-4adc-4ae6-b44e-cb00ade8271c: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] leads.csv / 3678b24a-2168-42a2-b998-fe2663946a1f: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] leads.csv / 3453c6b5-e5ec-4363-be4f-91e823262ee3: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] rental_websites.csv / 6e2453b0-c4db-4b83-8b1f-26f4d578377d: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] rental_websites.csv / ba8de981-2435-452f-abfb-c93737ed0e13: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] rental_websites.csv / 383c6b9e-4a57-4c9d-891d-3ac0cc863322: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] rental_websites.csv / 5e950efa-0b55-4b71-bc88-75d4029f726c: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] rental_websites.csv / 6ca36175-483e-4173-b29d-6a07d6de96a6: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] rental_websites.csv / 78c9ca4b-6431-4949-80e3-3a73b1e646d5: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] rental_websites.csv / 9794d927-d1af-465b-b8ce-a868a7f45623: Missing customer_id — bridge via email/name on promote
- [ambiguous_customer_match] rental_websites.csv / 38d07878-94d1-4af2-a902-316c71658fa8: Missing customer_id — bridge via email/name on promote
- _…and 44 more_

## Customer email collisions with team DB (sample)

_None_