# GOVERNANCE.md — CRM ownership, scoping & Plan Mode

> Ultimate owner: **Maroš Seman** · Agents/devs: read before touching revenue-critical code.
> Code is source of truth; this doc tracks intentional boundaries.

## 1. Domain ownership (routes)

| Route / page | Business area | Revenue-critical | Domain owner |
|--------------|---------------|------------------|--------------|
| `/admin` (`Admin.tsx`) | Leads pipeline, quick-create | **Yes** | Maroš · operational CRM dev |
| `/admin/customer/:key` | Customer Hub, golden path canvas | **Yes** | Maroš · identity/customer dev |
| `/admin/finance` | Finance overview, records, reconciliation, governance | **Yes** | Maroš · finance dev |
| `/admin/rentals` | Rental websites, MRR, payments | **Yes** | Maroš · rentals dev |
| `/admin/commissions` | Commissions, expenses, payout clarity | **Yes** | Maroš · commissions dev |
| `/admin/tasks` | Internal tasks | No (safer) | Maroš · any dev (shared UI rules) |
| `/admin/today` | Today dashboard / priorities | No | Maroš · any dev |
| `/admin/wheel-leads` | Wheel lead capture | Low | Maroš · marketing dev |
| `/admin/projects`, `/admin/project/:id` | Projects, notes, credentials | Medium | Maroš · delivery dev |
| `/admin/hosting`, `/admin/hosting/:id` | Hosting records, billing | Medium | Maroš · hosting dev |
| `/admin/designs` | Design proposals | Low | Maroš · delivery dev |
| `/admin/signatures` | Order signatures | Low | Maroš · delivery dev |
| `/admin/communication-ops` | Communication events ops | Medium | Maroš · comms dev |
| `/admin/rollout-health` | Rollout / legacy health | Medium | Maroš · platform dev |
| `/admin/clients` | Unified client directory | Medium | Maroš · identity dev |
| `/admin/logs` | Lead logs | Low | Maroš · any dev |
| `/admin/passwords` | Credential vault | Medium (security) | Maroš only |
| `/admin/settings` | App settings, team | Medium | Maroš only |
| `/admin/debug` | Dev diagnostics | **Dev only** | Never in production |

## 2. Canonical shared modules (technical ownership)

| Module | Role | API contract (summary) |
|--------|------|------------------------|
| `loadCustomerHubAggregate.ts` | Customer Hub data loader | Input: route key → `CustomerHubAggregate` with per-section errors via `sectionFetch`; never silent `[]` on failure |
| `buildFinanceSnapshot.ts` | Finance ledger truth | Raw datasets + year → `FinanceSnapshot` rows with `truthLevel`, totals, reconciliation issues |
| `profitCalculator.ts` / `profitContext.ts` | Profit display rules | `computeProfit`, `resolveProfitDisplayContext` — never show profit without known revenue basis |
| `permissions.ts` / `writePermissions.ts` / `routeAccess.ts` | RBAC | `AppRole`, scoped filters, write gates; legacy `admin`/`user` normalized in `useAdminAccess` |
| `crmLookup/*` | Identity bridge | Heuristic + FK resolution; `customers.ts` is write path for identity |
| `destructive/client.ts` + RPCs | Hard deletes | Precheck → execute; blocks on `*_fact` records |
| `audit/auditLog.ts` | Governance audit trail | Structured admin events |
| `crmPersistence/*` | Draft + view restore UX | Phase 1 foundation; pilot + Phase 2 scopes only unless Plan Mode rollout |
| `TruthLevelBadge.tsx` | Finance truth UI | Single color map: fact=green, legacy=orange, workflow=gray |
| `FinanceRecordsCrud.tsx` | Confirmed finance records CRUD | Inserts `*_fact`; legacy read-only |
| `AdminDialog` + `useAdminCloseGuard` | Modal + unsaved guard | All edit modals; wraps `useUnsavedChangesGuard` + route blocker |
| `useDestructiveAction` | Destructive delete UX | RPC precheck modal; lead pipeline wired (Admin.tsx) |

**Helper / non-canonical:** page-local state, one-off hooks, marketing components, most `components/ui/*`.

## 3. UI pattern ownership

| Pattern | Canonical location | Known deviations (do not extend) |
|---------|-------------------|----------------------------------|
| Admin modals | `AdminDialog.tsx` | Raw `Dialog` in `AdminCommissions`, `AdminDesigns`, `AdminSignatures`, `FinanceReconciliation`, `CustomerQuickCreateDialogs`, … |
| Unsaved guard | `useAdminCloseGuard` → `useUnsavedChangesGuard` | Legacy pages without guard; CLAUDE still documents `useUnsavedChangesGuard` — **use `useAdminCloseGuard` for new CRM modals** |
| Long notes | `AdminLongTextField` | `NoteTextarea` in older forms (Commissions, project notes) |
| Truth badge | `TruthLevelBadge` + `FINANCE_TRUTH_DISCLAIMER` | Resolved in daily finance (Fáza 3) |
| Destructive delete | `useDestructiveAction` + `ConfirmDestructiveActionModal` | Tasks/FinanceRecordsCrud `window.confirm`; bulk lead delete uses dedicated AlertDialog + `bulkDeleteLeads` |
| Admin tables | `Table` in `rounded-xl border overflow-x-auto` | Some card grids in marketing/debug |
| Customer Hub | `CustomerWorkbench.tsx` | Golden path canvas — extend via hub sections, not duplicate loaders in pages |

## 4. Scoping rules

### A) Domain scoping

**Plan Mode mandatory** (see §5): Leads, Customer Hub, Finance, Rentals, Commissions, identity/RBAC/destructive.

**Safer playground** (still use AdminDialog + guards for new edit modals): Tasks, Today, Wheel leads, Debug.

**Medium care:** Projects, Hosting, Communication, Clients — respect RBAC and destructive flows.

### B) Technical scoping

- **Never grow inline `supabase.from()` on:** `AdminFinance.tsx`, `AdminRentals.tsx`, `Admin.tsx`, `AdminCommissions.tsx` without extracting to `src/lib/**` + tests.
- **Protected write tables:** `payment_records`, `payout_records`, `cost_records`, `customers`, commission rules — writes via canonical components/RPCs only.
- **Allowed inline queries:** small pages (`AdminToday`), wheel leads, designs, logs — prefer lib extraction when query grows past ~3 calls.

### C) Anti-patterns (forbidden without Plan Mode approval)

- Ad-hoc modals outside `AdminDialog` in revenue-critical flows
- Ad-hoc destructive deletes outside `useDestructiveAction`
- Editing deployed migrations
- Changing truth levels or retroactive payout recalc
- New inline queries to protected tables from pages

## 5. Plan Mode in practice

### When Plan Mode is **required**

1. Touch **3+ files** in one critical domain
2. Change any **canonical module** (§2)
3. Change **finance / profit / identity / RBAC / destructive delete**
4. Any **database migration**

### Workflow

1. Write plan in session (or `RELEASE.md` for releases): scope, files, rollback, **must-not-change** list
2. Set `VITE_PLAN_MODE=1` in `.env.local` while executing (enables dev acknowledge; see `assertPlanModeAcknowledged`)
3. Run `evaluatePlanModeScope(changedFiles)` from `src/lib/governance/planMode.ts` before large diffs
4. After change: `npm run build` → `npm test` → update `CLAUDE.md` if constraints changed

### Must-not-change (every Plan Mode)

- Deployed migrations
- Truth level semantics
- RBAC role model without Maroš sign-off
- Commission split JSON without migration
- `legacy_import` deletion

## 6. Ownership files

This file is the root governance doc. Future optional splits (change only in Plan Mode):

- `docs/FINANCE.md` — finance canonical modules + reconciliation rules
- `docs/CUSTOMER_HUB.md` — loader sections + identity fallback rules

## 7. Registry in code

Machine-readable lists: `src/lib/governance/planMode.ts`

- `CRITICAL_DOMAINS`
- `CANONICAL_MODULE_PREFIXES`
- `INLINE_QUERY_PAGE_PREFIXES`
- `evaluatePlanModeScope()`
- `assertPlanModeAcknowledged()`
