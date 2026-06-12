# Release notes — Batch RC3 (hotfix)

Production stabilization for core CRM create/search flows.

---

## Root causes fixed

### 1. Hosting — „record not found“ after create

| Cause | Fix |
|-------|-----|
| Missing `linkLeadAfterDelivery` import → runtime error mid-save | Import + try/finally |
| Success toast even when insert `.select("id")` returned null (RLS footgun) | `parseInsertRowId()` — fail with clear message |
| Navigate to detail without verified UUID | Navigate only after confirmed `insertResult.id` |
| Detail page silent redirect on miss | Actionable error panel + UUID guard |

### 2. Lead → Klient visibility in Clients

| Cause | Fix |
|-------|-----|
| Won leads with `customer_id` still listed as „Lead“ only | `mapLeadSearchRow()` promotes to `kind: customer` |
| Search dedupe hid customer when email matched but name differed | `mergeClientSearchResults()` dedupes by email + customer_id |
| ClientPicker dropped `lead_id` when picking promoted customer | Preserve `meta.lead_id` on customer select |

### 3. Project create — email / client resolution

| Cause | Fix |
|-------|-----|
| Save relied on form email only; lead email not loaded | `resolveFormCustomerLink()` enriches from `lead_id` |
| Generic „Uloženie zlyhalo“ on silent insert failure | `parseInsertRowId()` + specific toasts |
| `/admin/projects/:id` route missing (404 on Detail links) | Route added in `App.tsx` |

---

## QA checklist

- [ ] Hosting: create → auto-open detail with valid UUID
- [ ] Hosting: invalid URL id → error panel, not blank screen
- [ ] Hosting: failed insert → toast, stay on dialog
- [ ] Klienti: search won lead by name → shows as **Klient**
- [ ] Klienti: search by email after won → finds customer
- [ ] Lead → Zrealizovaný → searchable in Klienti
- [ ] Projekt: pick lead from lookup → saves with email from lead
- [ ] Projekt: invalid email → validation before submit
- [ ] Projekt: Detail link opens `/admin/projects/:id`

---

## Files touched (RC3)

| Area | Files |
|------|-------|
| Hosting create/detail | `FinanceHostingPanel.tsx`, `AdminHostingDetail.tsx` |
| Clients search | `fetchLookup.ts`, `clientSearch.ts`, `AdminClients.tsx`, `ClientPicker.tsx` |
| Project create | `ProjectNotesView.tsx`, `App.tsx` (project detail route) |
| Shared helpers | `resolveFormCustomerLink.ts`, `entitySaveHelpers.ts`, `entityIds.ts`, `adminDebugLog.ts` |
| Lifecycle | `leadCustomerLifecycle.ts`, `customerLink.ts` |
| Tests | `rc3FlowFixes.test.ts` |

## Dev debugging

In development builds, console logs use prefix `[crm:scope]` via `adminDebugLog` (hosting detail fetch, insert, lead lifecycle, form customer link).

---

## Remaining edge cases

- Leads won without email — not auto-promoted; visible only as Lead
- Bulk lead status change — no lifecycle hook (by design)
- Insert RLS misconfiguration — user sees explicit „chýba ID“ message; fix is DB policy
