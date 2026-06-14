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
│   ├── customerWorkbench/      # loadCustomerWorkbench.ts, summary.ts, types.ts – Customer Hub data layer
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
└── test/                       # 22 súborov, väčšina rcN*.test.ts ("release candidate" batch testy)
```

Kód: 307 `.ts`/`.tsx` súborov, ~44 900 riadkov. 58 migrácií v `supabase/migrations/`.

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

### Komunikácia / governance (RC6+, 2026-06-11 až 06-17)
- `communication_events`, `communication_webhook_incidents`
- `design_proposals`, `order_signatures`, `project_notes`, `notifications`
- `lead_logs`, `user_roles`, admin auth user directory RPC (najnovšia migrácia 2026-06-17)

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

DB úroveň prepojenia (`rental_website_id` FK na `payment_records` a `cost_records`) je **funkčná** — golden path
je v databáze realizovaný. Problém je v **prezentačnej vrstve**: `loadCustomerWorkbench.ts` tieto tabuľky
nečíta (pozri AUDIT_FINDINGS.md, 🔴 #1).

### 3.2 Customer identity resolution (`loadCustomerWorkbench.ts`)
1. Vstup: `routeMode` (`"id"` alebo `"email"`) + `routeValue`.
2. `id` mode → `findCustomerById` (priamy lookup do `customers`).
3. `email` mode → `supabase.from("customers").select(...).eq("email", ...)` — ak nič nenájde,
   `viewMode = "heuristic"` (zobrazí sa `HeuristicDataBadge` namiesto `CanonicalCustomerBadge`).
4. Pre každú entitu (leads, tasks, rentals, signatures, notes, hosting, commissions, wheel_spins, designs,
   lead_logs, communication_events) sa spustí **2–3 paralelné query stratégie** (customer_id, email, client_name)
   a výsledky sa dedupujú cez `Map<id, Row>` — pattern opakovaný v ~10 blokoch tohto súboru.
5. `computeWorkbenchSummary()` → KPI chips (projekty, prenájmy, hosting, otvorené úlohy, neuhradené provízie).
6. `computeRecommendedActions()` / `computeUnresolvedIssues()` → prioritizovaný zoznam akcií a upozornení.

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
- Revenue basis: hosting → mesačná cena hostingu; project → suma `payment_records`.
- UI: `<EntityProfitBanner>` (zobrazuje headline+detail+revenue basis) je vykreslený v `<EntityCommissionsPanel>`,
  použitý v `AdminHostingDetail.tsx` a `AdminProjectDetail.tsx` — **NIE** v Customer Hub a **NIE** v `AdminRentals.tsx`.

### 3.5 RBAC (`src/lib/rbac/permissions.ts`)
- `AppRole = "admin" | "user"`. Iba `admin` má `canAccessOperationalCrm`, `canAccessFinanceAdvanced`,
  `canSeeAllCommissions`, `canAccessAdminDiagnostics`.
- `role = "user"` (implementer) vidí len svoje provízie (`filterCommissionsForUser`,
  `commissionVisibleToUser` — case-insensitive match na `implementerName`).
- `resolveScopedCommissionEmpty()` rozlišuje 3 dôvody prázdneho zoznamu (`missing_profile`, `scoped_empty`, `no_data`)
  a vracia užívateľsky zrozumiteľný text — dobrý UX detail.
- **Dôsledok**: Customer Hub (`AdminCustomer.tsx`) je gatovaný `canAccessOperationalCrm(role)` → **iba admin** ho
  vidí načítaný; `role="user"` dostane prázdnu stránku (loading sa ukončí, data ostanú `emptyData()`).

## 4. Identifikované patterny

### 4.1 Hooks / lib organizácia
- Dátová logika je z veľkej časti v `src/lib/**` ako čisté funkcie (testovateľné — 22 testov v `src/test/`),
  ale **fetching** je nekonzistentný: niekedy je v `lib/` (`loadCustomerWorkbench.ts`), niekedy priamo v page
  komponente (`AdminFinance.tsx`, `AdminRentals.tsx`, `Admin.tsx`).

### 4.2 Supabase query patterns
- **Hook/lib-based** (dobrý pattern): `loadCustomerWorkbench.ts` — všetky queries na jednom mieste, dedup cez `Map`.
- **Inline-in-component** (spaghetti riziko): `AdminRentals.tsx` (19×), `Admin.tsx` (18×), `AdminFinance.tsx` (13×),
  `AdminCommissions.tsx` (12×) — `supabase.from(...)` priamo v `useEffect`/handleroch stránky.
- **Map-dedup pattern**: opakovaný v `loadCustomerWorkbench.ts` pre každú entitu s viacerými match-strategiami
  (customer_id vs email vs client_name), s `matchedBy` flagom pre transparentnosť (heuristic vs canonical).

### 4.3 Truth-level pattern
- `TRUTH_LEVEL_LABELS` (text) v `src/lib/finance/labels.ts`; `truthBadge()` v `FinanceRecordsCrud.tsx` renderuje
  `<Badge variant="default"|"secondary">` — badge variant, nie explicitné farby z CLAUDE.md (#22c55e/#f97316/...).
- `isLegacy(truthLevel)` chráni `legacy_import` záznamy pred editáciou/zmazaním (Lock ikona, read-only).

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
