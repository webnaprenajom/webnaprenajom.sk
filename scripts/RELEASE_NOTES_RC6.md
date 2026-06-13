# Release Notes — Batch RC6

Team CRM: profit-aware commissions, RBAC, email contract, communication summaries, UX unification.

## Migrations

- `20260615000000_rc6_team_profit_communication.sql` — `team_profiles`, `user_email_accounts`, `customer_communication_summaries`, `operating_cost` on hosting/projects, commission read RLS for role=user
- `20260615000001_rc6_summary_upsert_policy.sql` — CRM users can upsert communication summaries

## Profitability

- `src/lib/profit/profitCalculator.ts` — profit = max(0, revenue − operatingCost)
- Hosting detail: edit `operating_cost`, profit banner, commission panel shows profit base
- Project detail: edit `operating_cost`, revenue from `payment_records`, profit banner on provízie tab
- Formula assumption: commission **amounts** are still entered manually; UI guides profit-based decisions (auto-recalc of amounts is future work)

## RBAC

- `useAdminAccess` — admin + user roles, `team_profiles` implementer mapping
- `AdminLayout` — allows role `user` (not only admin)
- Settings — admin-only (user redirected); email account settings for all CRM users
- `UserManagementPanel` — admin assigns roles + implementer profile
- Finance — non-admins see scoped implementer totals; advanced finance admin-only
- DB RLS — role=user reads only commissions matching `team_profiles.implementer_name`

## Email integration (status)

- **Model:** `user_email_accounts` (provider, status, last_sync_at, config JSONB)
- **UI:** Settings → E-mail a synchronizácia (`EmailAccountSettings`)
- **Ingestion:** existing `communication_events` pipeline; matching by email identity + customer_id
- **Not in RC6:** live IMAP/OAuth sync worker — accounts can be registered and marked pending

## Communication summaries

- Table `customer_communication_summaries`
- `buildSummaryFromEvents` — deterministic handoff summary (no external AI)
- `CommunicationSummaryPanel` on customer workbench (prehľad + komunikácia tabs)
- Raw timeline remains source of truth

## UI cleanup

- Removed user-facing links to rollout-health / communication-ops from workbench sidebar (admin-only)
- Workspace adoption metrics hidden from non-admins
- Recommended action for unlinked email → komunikácia tab (not ops page)

## UX unification

- `AdminDialog` — shared dialog shell (used in EntityCommissionsPanel)
- Rentals implementer dialog — paid/unpaid toggle on commission rows

## Tests

- `rc6ProfitCalculator.test.ts`
- `rc6Rbac.test.ts`
- `rc6SummaryModel.test.ts`

## QA checklist

- [ ] Apply both RC6 migrations on Supabase
- [ ] Admin: Settings → add user role + team profile for each implementer
- [ ] User login: no Settings nav; Finance shows only own implementer row
- [ ] Rentals → implementer detail: toggle paid/unpaid on commission rows; Finance totals update
- [ ] Hosting/Project detail: save operating_cost; profit banner visible on provízie
- [ ] Settings: add email account, mark pending
- [ ] Customer workbench: communication summary refresh
- [ ] Mobile: dialogs and commission tables scroll correctly

## Unresolved risks

- Rental JSON `%` implementer shares still coexist with normalized commissions (by design)
- Project revenue = payment_records sum only; projects without payment records show cost-only profit
- Email provider sync not implemented — pending status is manual stub
- Summary builder is heuristic, not LLM — quality depends on event titles/previews
- Admin must create `team_profiles` for each user role or RLS hides all commissions
