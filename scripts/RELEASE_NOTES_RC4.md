# Release notes — Batch RC4

Commission source isolation, unified client directory, multi-row credentials, and mobile admin UX.

---

## Root causes / changes

### A. Commission source isolation

| Issue | Fix |
|-------|-----|
| Rentals implementer dialog showed all commission rows regardless of `source_type` | `bucketCommissionsBySection()` — rental-linked vs legacy vs cross-section |
| Legacy rows mixed with section-owned rows | Separate legacy block with amber badge in Rentals drill-down |
| Hosting/Projects already filtered in `EntityCommissionsPanel` | Unchanged DB filter; added full field parity |

### B. Shared commission model

| Gap | Fix |
|-----|-----|
| Entity panel missing `payment_form` and payment status editor | `CommissionFormFields` shared component |
| Inconsistent table columns | Payment form + status in entity panel (desktop + mobile cards) |

### C. Finance implementer drill-down

| Gap | Fix |
|-----|-----|
| Missing `payment_form` column | Added with `paymentFormLabel` |
| Dense table on mobile | Card fallback below `md` breakpoint |
| Legacy count not visible | Summary shows linked + legacy counts |

### D. Unified Clients

| Gap | Fix |
|-----|-----|
| Search-only page, no cross-section view | `loadUnifiedClientDirectory()` + browse grid |
| Dedupe only at search time | `mergeUnifiedClientSeeds()` — customer_id → email → name |
| No relationship summary | Section count badges (proj / host / pren) |

### E. Access credentials

| Gap | Fix |
|-----|-----|
| Single url/username/password columns | `access_credentials` JSONB + migration backfill |
| No multi-login support | `AccessCredentialsEditor` — add/remove rows with label, URL, login, password, note |
| Legacy compatibility | First credential syncs to legacy columns |

### F. Mobile responsiveness

- Entity commission panel: mobile cards, responsive dialog
- Finance implementer dialog: full-width on phone, card list
- Project edit dialog: stacked grids, full-width CTAs
- Admin Clients: stacked search, touch-friendly list rows (min 44px)
- Rentals implementer dialog: responsive width

---

## Files changed

| Area | Files |
|------|-------|
| Commission filters | `commissionFilters.ts`, `commissionSource.ts` |
| Shared commission UI | `CommissionFormFields.tsx`, `EntityCommissionsPanel.tsx` |
| Rentals isolation | `ImplementerCommissionDetailDialog.tsx`, `AdminRentals.tsx` |
| Finance drill-down | `FinanceImplementerDetailDialog.tsx` |
| Unified clients | `unifiedClientDedupe.ts`, `loadUnifiedClientDirectory.ts`, `AdminClients.tsx` |
| Credentials | `projectCredentials.ts`, `AccessCredentialsEditor.tsx`, `ProjectNotesView.tsx`, `shared.ts`, migration |
| Workbench | `loadCustomerWorkbench.ts` |
| Tests | `rc4CommissionFilters.test.ts`, `rc4UnifiedClients.test.ts`, `rc4ProjectCredentials.test.ts` |

---

## QA checklist

- [ ] **Prenájmy**: Implementer drill-down shows only `source_type=rental` in main commission rows
- [ ] **Prenájmy**: Legacy rows appear in separate section, not mixed with rental %
- [ ] **Hosting detail**: Commission tab — add/edit with payment form + paid status
- [ ] **Project detail**: Same commission fields as hosting
- [ ] **Financie**: Click implementer → all sections visible, payment form column, source links work
- [ ] **Financie mobile**: Card layout readable on phone width
- [ ] **Klienti**: Browse grid shows deduped clients with section counts
- [ ] **Klienti**: Search still finds leads + promoted customers
- [ ] **Heslá**: Add multiple credential rows, save, reload — all rows persist
- [ ] **Heslá**: Legacy projects with old url/username/password still display after migration
- [ ] **Mobile**: Create hosting/project/commission on narrow viewport

---

## Remaining edge cases

- Rental `%` shares remain in `rental_websites.implementers` JSON — separate from `commissions` table (by design)
- Unified client directory matches rentals by `client_name` only (no `customer_id` on rentals yet)
- Duplicate `customers` rows with different emails are not auto-merged
- Commission quick-create from workbench still creates legacy rows (fix in future batch)
- `types.ts` still stale vs migrations

---

## Migration

Run: `20260613000000_rc4_project_credentials.sql`
