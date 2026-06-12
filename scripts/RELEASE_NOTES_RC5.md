# Release notes — Batch RC5

Customer identity hardening, commission normalization, and data quality guardrails.

---

## Identity rules implemented

| Precedence | Level | Behavior |
|------------|-------|----------|
| 1 | `customer_id` | Canonical UUID from picker or FK |
| 2 | `email` | Normalized email → link or guarded create |
| 3 | `manual_link` | Explicit picker selection |
| 4 | `name_heuristic` | Limited; never auto-creates without guardrails |

**Duplicate prevention:** `ensureCustomerByEmail` checks name collisions before insert — links to existing name-only row, blocks ambiguous multi-match, warns on email/name mismatch.

**Merge readiness:** `findDuplicateCustomerCandidates`, `pickCanonicalCustomerRecord`, `mergePriorityFields` — prep for future merge UI (no merge executor in RC5).

---

## Rental → customer linkage

- Migration adds `rental_websites.customer_email` (denormalized)
- Conservative SQL backfill: `customer_id` only when exactly one lead matches name with `customer_id`
- `AdminRentals` save passes `customer_email` via `ClientPicker`
- Workbench loads rentals by `customer_id`, `customer_email`, or `client_name`
- Unified client directory uses rental `customer_id` + email

---

## Commission normalization

- `buildCommissionInsertPayload()` — shared insert validation
- Workbench quick-create: requires implementer, sets `source_type: other`, links customer
- Rental JSON % shares and `commissions` table coexist by design (`RENTAL_COMMISSION_COEXISTENCE_NOTE`)

---

## Data quality visibility

Extended `/admin/rollout-health` (devOnly nav) with RC5 metrics:
- Rentals without `customer_id`
- Rentals backfillable via single lead
- Commissions without customer
- Duplicate customer candidates
- Customers without email
- (Plus RC1 legacy commission/task/lead counts)

---

## Migrations

`20260614000000_rc5_rental_customer_identity.sql`

---

## QA checklist

- [ ] Create customer via project save — no duplicate when email exists
- [ ] Attempt duplicate name with different email — warning or block
- [ ] Rental save with ClientPicker — `customer_id` + `customer_email` persisted
- [ ] Customer 360 shows rentals linked by `customer_id`
- [ ] Workbench commission create — requires implementer, has customer link
- [ ] Rollout health shows RC5 identity metrics
- [ ] Migration backfill: only single-lead name matches updated

---

## Remaining edge cases

- No customer merge UI yet — candidates are report-only
- Rental JSON implementers not synced to commissions table (intentional)
- `findCustomersByDisplayName` scans up to 300 customers in memory
- Full merge repointing FKs not implemented
- AdminCommissions default form still allows legacy source (operator choice)
