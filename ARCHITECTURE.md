# ARCHITECTURE.md — webnaprenajom.sk CRM

> Generované auditom (KROK 2–3 self-executing prompt). Odráža reálny stav kódu, nie len plán.

## 1. Štruktúra `src/`

```
src/
├── pages/                     # 28 route-level stránok (Admin* = admin CRM)
├── components/
│   ├── admin/                 # admin UI – najväčší strom (workbench, finance, rentals, commissions...)
│   │   ├── customerWorkbench/ # Customer Hub UI (CustomerWorkbench.tsx + podkomponenty)
│   │   ├── finance/           # Finance tab komponenty (records/reconciliation/governance/settlement/...)
│   │   ├── rentals/           # rental-specific dialógy (ImplementerCommissionDetailDialog...)
│   │   └── commissions/       # CommissionFormFields a pod.
│   ├── ui/                    # shadcn-ui primitíva (Button, Table, Dialog, Select, Badge...)
│   ├── hero/                  # marketingová homepage
│   └── localized/             # lokalizované verzie verejných stránok
├── lib/
│   ├── customerWorkbench/      # loadCustomerHubAggregate.ts, summary.ts, types.ts – Customer Hub data layer (loadCustomerWorkbench = thin wrapper)
│   ├── finance/                 # 17 súborov – buildFinanceSnapshot, dismissals, commissionRules, reconciliation, labels, types
│   ├── profit/                  # profitCalculator.ts, profitContext.ts – "čistý zisk" logika
│   ├── rbac/                    # permissions.ts, routeAccess.ts, writePermissions.ts
│   ├── crmLookup/                # 21 súborov – customers.ts, identity bridge heuristiky
│   ├── communication/            # communication_events helpers
│   ├── audit/                    # auditLog.ts – governance audit trail
│   └── rollout/                  # rollout health helpers
├── hooks/                      # useAdminAccess, useAccessContext, useCrmUserDirectory, use-toast
├── contexts/LanguageContext.tsx
├── integrations/supabase/      # client.ts, types.ts (generovaný DB typ)
└── test/                       # 36+ súborov (Vitest), rcN batch testy + customer hub / RBAC / finance helpers
```

Kód: ~340 `.ts`/`.tsx` súborov. 58+ migrácií v `supabase/migrations/`.

### Admin stránky (`src/pages/Admin*.tsx`)
`Admin.tsx` (Leads pipeline), `AdminCustomer.tsx` (Customer Hub), `AdminFinance.tsx`, `AdminRentals.tsx`,
`AdminCommissions.tsx` + `AdminCommissionsRedirect.tsx`, `AdminTasks.tsx`, `AdminWheelLeads.tsx`,
`AdminProjects.tsx` / `AdminProjectDetail.tsx` / `AdminProjectNotes.tsx`, `AdminHosting.tsx` / `AdminHostingDetail.tsx`,
`AdminDesigns.tsx`, `AdminSignatures.tsx`, `AdminCommunicationOps.tsx`, `AdminRolloutHealth.tsx`,
`AdminClients.tsx`, `AdminLogs.tsx`, `AdminPasswords.tsx`, `AdminSettings.tsx`, `AdminToday.tsx`, `AdminDebug.tsx` (dev only).

## 2. Databázová schéma (z `src/integrations/supabase/types.ts` + migrácií)

### CRM jadro (pôvodné tabuľky)
- `leads`, `rental_websites`, `rental_payments`, `commissions`, `expenses`, `tasks`, `wheel_spins`

### Customer identity (Batch F1 / RC5 — 2026-06-11 a 2026-06-14)
- `customers` (id, email *unique kde not null*, display_name, metadata jsonb)
- Nullable `customer_id` FK pridané do: `leads`, `project_notes`, `rental_websites`, `hosting_records`, `commissions`
- `rental_websites.customer_email` (denormalizovaný, backfillovaný z `customers` aj z `leads` cez meno)

### Finance (5 migrácií, 2026-06-09)
- `payment_records` (truth_level: `payment_fact` | `legacy_import`, **`rental_website_id` FK → rental_websites**)
- `payout_records` (truth_level: `payout_fact` | `legacy_import`)
- `cost_records` (truth_level: `cost_fact` | `legacy_import`, **`rental_website_id` FK → rental_websites**, unique `(source_table, source_id)`)
- `finance_issue_dismissals`, `finance_policy_settings`, `finance_review_items`, commission rules: `commission_rules`, `commission_rule_overrides`
- `hosting_records`

### Komunikácia / governance (RC6+, 2026-06-11 až 06-19)
- `communication_events`, `communication_webhook_incidents`
- `design_proposals`, `order_signatures`, `project_notes`, `notifications`
- `lead_logs`, `user_roles`, admin auth user directory RPC
- Destructive delete RPCs: `admin_precheck_destructive_delete`, `admin_execute_destructive_delete` (Fáza 2c — customer, hosting, rental_website; hard block na `*_fact`)

## 3. Dátové toky

### 3.1 Golden Path (Lead → Payout)
```
leads ──┬─→ customers (cez customer_id FK, F1/RC5 backfill)
        │
        ├─→ rental_websites (customer_id, customer_email)
        │        │
        │        ├─→ payment_records (rental_website_id FK)   ─┐
        │        ├─→ cost_records     (rental_website_id FK)   ├─→ buildFinanceSnapshot → FinanceSnapshot
        │        └─→ rental_payments (legacy, pred finance migráciou)
        │
        ├─→ hosting_records (customer_id)
        ├─→ commissions (source_type/source_id → rental|hosting|project|other, customer_id/customer_email)
        │        └─→ payout_records (cez implementer, truth_level)
        └─→ tasks / project_notes / design_proposals / communication_events (customer_id alebo email/meno heuristika)
```

DB úroveň prepojenia (`rental_website_id` FK na `payment_records` a `cost_records`) je **funkčná**.
Prezentačná vrstva: Customer Hub (`loadCustomerHubAggregate` → `CustomerFinancePanel`, `CustomerHubFinanceSnapshot`) načítava
`payment_records`, `cost_records`, `payout_records`, `rental_payments` a zobrazuje truth-level badge + čistý zisk (`entityKind: "customer"`).
**Backlog:** `EntityProfitBanner` v `AdminRentals.tsx` (list/detail prenájmu) ešte chýba.

### 3.2 Customer Hub loader (`loadCustomerHubAggregate.ts`)
Runtime path: `AdminCustomer.tsx` → `useCustomerHub` → **`loadCustomerHubAggregate`** (Fáza 2/2b).
`loadCustomerWorkbench.ts` je tenký wrapper spätnej kompatibility.

1. Vstup: `resolveCustomerIdentity` — `routeMode` (`"id"` | `"email"`) + `routeValue`.
2. `id` mode → priamy lookup do `customers`; `email` mode → canonical alebo `viewMode = "heuristic"` (`HeuristicDataBadge`).
3. Sekčné fetch (`sectionFetch` / manuálne multi-query): leads, tasks, rentals, hosting, commissions, payments, costs, payouts, timeline, atď.
4. `computeCustomerFinanceSummary()` + `CustomerFinancePanel` — príjem/náklady/profit s truth-level badge.
5. `computeRecommendedActions()` / `computeUnresolvedIssues()` — prioritizované akcie.

### 3.3 Finance snapshot (`buildFinanceSnapshot.ts`)
Vstup: 7 surových datasetov (`commissions`, `expenses`, `websites`, `payments` [rental_payments legacy],
`paymentRecords`, `payoutRecords`, `costRecords`) + `filterYear`.
Výstup: `FinanceSnapshot` = `{ rows: FinanceLedgerRow[], totals: FinanceSnapshotTotals, reconciliation }`.
- Každý riadok dostane `truthLevel` (`payment_fact|payout_fact|cost_fact|legacy_import|workflow_only|derived`).
- Cross-referencing cez `sourceKey(table,id)` zisťuje, či workflow-only záznam má aj fakt-záznam (`hasPaymentFact` atď.).
- `CREDIT_COST = 0.30 €/credit` → `derived` riadky pre AI credit náklady.
- `buildReconciliation()` generuje `ReconciliationIssue[]` (typ, závažnosť) pre nekonzistencie.

### 3.4 Profit / "čistý zisk" (`profitCalculator.ts` + `profitContext.ts`)
- `computeProfit({revenue, operatingCost}) = max(0, revenue - operatingCost)`.
- `resolveProfitDisplayContext()` rozhoduje, či sa zisk vôbec **smie zobraziť** (status `complete | no_revenue_yet
  | zero_revenue | cost_without_revenue`) — nikdy nenaznačí zisk bez známeho revenue základu.
- Revenue basis: hosting → mesačná cena hostingu; project → suma `payment_records`; customer hub → agregát `payment_records`/`cost_records`.
- UI: `<EntityProfitBanner>` v `EntityCommissionsPanel` (hosting/project), **`CustomerFinancePanel`** (customer), `AdminHostingDetail`, `AdminProjectDetail`.
- **Backlog:** `AdminRentals.tsx` (hlavný MRR stream) ešte bez `EntityProfitBanner`.

### 3.5 RBAC (`src/lib/rbac/permissions.ts` + `writePermissions.ts`)
- **`AppRole = "owner" | "administrator"`** (DB môže mať legacy `admin`/`user` — normalizované v `useAdminAccess`).
- **Owner:** plný CRM + finance advanced + settings + všetky provízie/klienti (read/write podľa `writePermissions`).
- **Administrator:** operational CRM (vrátane Customer Hub a daily finance), scoped provízie/rentals/leads podľa `team_profiles.implementer_name` / `assigned_to`; **write = owner-only**.
- `filterCommissionsForUser`, `commissionVisibleToUser`, `resolveScopedCommissionEmpty` — scoped empty states s user-friendly textom.

## 4. Identifikované patterny

### 4.1 Hooks / lib organizácia
- Dátová logika je z veľkej časti v `src/lib/**` ako čisté funkcie (36 test súborov / 240 testov).
- **Fetching:** Customer Hub centralizovaný (`loadCustomerHubAggregate`); Finance/Rentals/Leads stále mix page + lib (backlog: shared loadery).

### 4.2 Supabase query patterns
- **Hook/lib-based (vzor):** `loadCustomerHubAggregate.ts`, `loadUnifiedClientDirectory.ts`, čiastočne `AdminFinance.load()`.
- **Inline-in-page (dlh):** `AdminRentals.tsx`, `Admin.tsx`, `AdminFinance.tsx`, `AdminCommissions.tsx` — `supabase.from(...)` v page komponente.
- **Map-dedup / multi-strategy identity:** v hub loaderi pre entity bez `customer_id` (heuristika email/meno).

### 4.3 Truth-level pattern
- **`TruthLevelBadge.tsx`** — jediný zdroj farieb (CLAUDE.md: zelená=fact, oranžová=legacy, sivá=workflow/derived); použitý v daily finance, records CRUD, Customer Hub.
- `isLegacy(truthLevel)` chráni `legacy_import` pred editáciou/zmazaním.

### 4.4 Profit/Commission pattern
- `<EntityCommissionsPanel>` + `<EntityProfitBanner>` = opakovateľný "card" pattern pre hosting/project entity
  (provízie tabuľka + profit banner + RBAC write-gate `canWriteCommissions`).
- `classifyCommissionSource()` rozlišuje `normalized | legacy | rental_json` — základ pre `detectRentalDualModelWarning`
  (varovanie pred dvojitým počítaním rental % podielov vs normalizovaných provízií), použité v
  `ImplementerCommissionDetailDialog.tsx`.

### 4.5 UI komponenty
- shadcn `<Select>` v 16 súboroch, raw `<select>` v 7 (`AdminFinance.tsx`, `AdminRentals.tsx`,
  `FinanceCommissionRulesPanel.tsx`, `FinanceReconciliation.tsx`, `FinanceSettlementDrafts.tsx`,
  `PayrollExportPanel.tsx`, `ImplementerCommissionDetailDialog.tsx`).
