# Release Notes — Batch RC6.5

Post-RC6 stabilization: RBAC hardening, profit fallbacks, team profile guardrails, finance UX.

## Bugs fixed

- **Finance scope leak:** role=user saw org-wide rental KPIs (paid invoices, received sums) — now hidden; only own commission totals shown.
- **Silent empty finance:** users without `team_profiles` saw generic “no records” — now explicit missing-mapping message.
- **False profit on projects:** profit banner could imply zisk when no `payment_records` existed — now shows “tržby nie sú známe” / “zatiaľ bez tržieb”.
- **Route leaks:** role=user could open operational URLs — redirected to `/admin/finance` or blocked via `AdminOnlyGate`.
- **Settings redirect:** non-admin hitting settings redirected to `/admin/today` (also admin-only) — now `/admin/finance`.

## Files added

- `src/lib/profit/profitContext.ts` — revenue basis + safe display states
- `src/lib/finance/commissionConsistency.ts` — source classification, dual-model warnings
- `src/lib/rbac/routeAccess.ts` — route-level rules
- `src/hooks/useAccessContext.ts` — shared AccessContext hook
- `src/components/admin/rbac/ScopedEmptyState.tsx`
- `src/components/admin/rbac/TeamProfileNotice.tsx`
- `src/components/admin/rbac/AdminOnlyGate.tsx`
- `src/components/admin/settings/TeamSetupDiagnostics.tsx`
- Tests: `rc65ProfitContext.test.ts`, `rc65RbacHardening.test.ts`, `rc65CommissionConsistency.test.ts`

## RBAC & team profile

- Sidebar for role=user: Financie only
- `TeamProfileNotice` on Finance + Settings (when applicable)
- User Management: warning count, “Chýba team profile” badge, one-click assign implementer
- Admin Settings: soft diagnostics (missing profiles, legacy commissions, cost without revenue)

## Profit fallback states

| State | Behavior |
|-------|----------|
| `no_revenue_yet` | No profit number; explains missing payment basis |
| `zero_revenue` | Known 0 € revenue |
| `cost_without_revenue` | Costs shown; profit withheld |
| `complete` | Full profit calculation with labeled revenue basis |

## QA checklist

- [ ] User without team profile: amber notice + scoped empty state on Finance
- [ ] User with profile: only own implementer row; no org KPIs
- [ ] User visiting `/admin/rentals` → redirect to Finance
- [ ] Admin: Team Setup Diagnostics shows actionable counts
- [ ] Project with 0 payments: banner does not show false profit
- [ ] Hosting without monthly_price: banner explains missing price
- [ ] Rental implementer dialog: dual-model warning when JSON + normalized rows coexist
- [ ] Mobile: Finance table scrolls; empty states readable

## Unresolved risks (candidate RC7)

- Full route guard wrapper on every operational page (some pages still rely on redirect-at-mount only)
- Automatic commission amount from profit × rate
- Email provider sync
- Write RLS for commissions beyond read scoping
