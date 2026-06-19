# AUDIT_FINDINGS.md — webnaprenajom.sk CRM

> Pôvodný audit KROK 3. **Living doc** — nižšie status k jednotlivým nálezom (aktualizované po Fázach 1–2c, 3, 5 a cleanup batchoch).
>
> **Aktuálny stav (stručne):** Customer Hub finance ✅ · AdminFinance error surfacing ✅ · destructive delete (customer/hosting/rental) ✅ · `customers` + FK foundation ✅ · RBAC `owner`/`administrator` ✅ · truth badges v daily finance ✅.
> **Otvorené:** scoped KPI pre administratora (#5) · inline page queries (#6) · `EntityProfitBanner` v Rentals (#8) · projects/marketing/designs bez ownership scoping.

## 🔴 KRITICKÉ

### 1. Customer Hub nemá kompletný finančný obraz klienta — ✅ RESOLVED (Fáza 2/2b, 2026-06-14)
- **Lokalizácia**: `loadCustomerHubAggregate.ts`, `CustomerFinancePanel.tsx`, `CustomerHubFinanceSnapshot.tsx`, `summary.ts`
- **Bolo**: `loadCustomerWorkbench` nečítal `payment_records` / `cost_records` / `payout_records`.
- **Teraz**: Hub načítava finance sekcie, truth-level badge, `computeCustomerFinanceSummary`, platobná história 12 mes., timeline payment events.

### 2. Customer Hub nemá históriu platieb — ✅ RESOLVED (Fáza 2, 2026-06-14)
- **Lokalizácia**: `CustomerFinancePanel.tsx`, `timeline.ts`
- **Bolo**: Bez payment dát v hub loaderi.
- **Teraz**: Tabuľka `payment_records` (12 mes.) + timeline udalosti `payment`/`payout`/`rental_payment`.

### 3. AdminFinance.tsx — nekonzistentné error handling — ✅ RESOLVED (Fáza 1, 2026-06-14)
- **Lokalizácia**: `src/pages/AdminFinance.tsx`, funkcia `load()`
- **Bolo**: Väčšina paralelných queries ticho degradovala na `[]`.
- **Teraz**: Per-table `errors[]` + destructive toast + persistent banner pri čiastočnom zlyhaní.

## 🟡 DÔLEŽITÉ

### 4. Truth-level badge sa nezobrazuje v "daily" Finance view
- **Lokalizácia**: `src/pages/AdminFinance.tsx` (`DailyFinanceView`), `src/components/admin/finance/FinanceRecordsCrud.tsx`
- **Problém**: `truthBadge()` a `FINANCE_TRUTH_DISCLAIMER` existujú iba v "Advanced" záložke (`?advanced=1`,
  navyše gated `canAccessFinanceAdvanced` = len admin). Default/daily view (KPI karty, "Provízie podľa realizátora")
  truth level vôbec nezobrazuje.
- **Business dopad**: Porušuje vlastné pravidlo CLAUDE.md "VŽDY zobrazuj truth level badge pri každom finančnom
  zázname" — pre bežný denný pohľad (a pre `role="user"`, ktorý sa do Advanced nedostane) nie je vidno,
  či je číslo potvrdené (`fact`) alebo legacy/odhad.
- **Presná mapa gapov (audit Fáza 1, bod 3 — `// AUDIT (Fáza 1, bod 3): ...` komentáre priamo v `DailyFinanceView`)**:
  - **KPI "Zaplatené faktúry" / "Nezaplatené / fakturované"** — počítané z raw `rental_payments`
    (`dailyKpis.paidInvoices`/`unpaidInvoices`), tabuľka nemá `truth_level` field vôbec. V `buildFinanceSnapshot`
    zodpovedajúci ledger riadok ("rental_receivable") má `truthLevel: "workflow_only"`.
  - **KPI "Prijaté platby" (`dailyKpis.receivedSum`)** — súčet `paymentsConfirmed` (truth_level=`payment_fact`)
    + `paymentsLegacyImport` (truth_level=`legacy_import`) zlúčený do JEDNÉHO zeleného čísla, bez rozlíšenia
    dvoch odlišných truth-levelov.
  - **KPI "Čakajúce platby" (`dailyKpis.pendingSum`)** — `rentalMarkedUnpaid + rentalMarkedInvoiced`, oboje
    z `rental_payments` → `truthLevel: "workflow_only"` v `buildFinanceSnapshot`, ale zobrazené ako bežné číslo
    bez badge.
  - **Tabuľka "Provízie podľa realizátora" / "Vaše provízie"** — riadky z `commissions`, v `buildFinanceSnapshot`
    hardcoded `truthLevel: "workflow_only"`, žiadny badge/indikátor v dennom view.
  - → Fáza 3 (3.1/3.4): rozdeliť súčty podľa truth-levelu a/alebo doplniť badge s farbami z CLAUDE.md
    (zelená=fact, žltá/oranžová=legacy_import, sivá=workflow_only). Fáza 1 = len audit-markery v kóde,
    bez vizuálnej zmeny (item 4 zadania: "Nevylepšuj ešte dizajn").

- **✅ RESOLVED (Fáza 3, 2026-06-14)**: `DailyFinanceView` teraz zobrazuje `FINANCE_TRUTH_DISCLAIMER` aj
  mimo "Pokročilé". KPI "Prijaté platby" má rozpis `payment_fact` / `legacy_import` (`TruthLevelBadge` + suma
  pri každom). KPI "Zaplatené faktúry" / "Nezaplatené / fakturované" / "Čakajúce platby" majú badge
  `workflow_only`. Tabuľka "Provízie podľa realizátora" / "Vaše provízie" má nový stĺpec "Truth"
  (`workflow_only`, zdroj `commissions`) + pätičku vysvetľujúcu vzťah k auditovaným `payout_records`.
  Viď `src/components/admin/finance/TruthLevelBadge.tsx` a `ROADMAP.md` Fáza 3.

### 5. KPI karty v daily Finance view — ⚠️ ČIASTOČNE OTVORENÉ (ROADMAP 3.2)
- **Lokalizácia**: `src/pages/AdminFinance.tsx`
- **Stav**: Owner aj **administrator** vidia daily finance (`canAccessOperationalCrm`). Org KPI karty sú dostupné obom rolám s operational prístupom.
- **Otvorené**: Scoped KPI pre administratora (vlastné provízie/výplaty above the fold) — ROADMAP 3.2.

### 6. Inline Supabase queries — "spaghetti" v najväčších stránkach
- **Lokalizácia**: `AdminRentals.tsx` (19×), `Admin.tsx` (18×), `AdminFinance.tsx` (13×), `AdminCommissions.tsx` (12×)
  — všetko `supabase.from(...)` priamo v page komponentoch, nie v `lib/`/hooks.
- **Problém**: Dátová logika je zamiešaná s UI logikou, ťažko testovateľná (porovnaj s `loadCustomerWorkbench.ts`,
  ktorý má vlastné testy v `src/test/`). Zmena schémy (napr. pridanie `rental_website_id` do query) vyžaduje
  úpravu na viacerých miestach naraz.
- **Business dopad**: Vyššie riziko regresií pri budúcich zmenách.
- **Poznámka:** Customer Hub finance už v `lib/` — zvyšok stránok backlog (ROADMAP / data-loader konsolidácia).

### 7. CLAUDE.md customer identity — ✅ RESOLVED (Fáza 1.2)
- **Skutočnosť**: `customers` tabuľka + `customer_id` FK + `rental_websites.customer_email` — popísané v `CLAUDE.md`.
- **Backlog:** postupný backfill zostávajúcich záznamov bez `customer_id` (heuristika stále fallback).

### 8. "Čistý zisk" komponent existuje, ale nie je univerzálny
- **Lokalizácia**: `src/lib/profit/profitCalculator.ts`, `src/lib/profit/profitContext.ts`,
  `src/components/admin/EntityProfitBanner.tsx`, použité v `AdminHostingDetail.tsx` a `AdminProjectDetail.tsx`
  (cez `EntityCommissionsPanel`).
- **Problém**: `EntityProfitBanner` chýba v `AdminRentals.tsx` (hlavný MRR stream).
- **Customer Hub:** ✅ `EntityProfitBanner` / `computeCustomerFinanceSummary` s `entityKind: "customer"` (Fáza 2).
- **✅ ČIASTOČNE RESOLVED (Fáza 5 "Commission Clarity", 2026-06-14)** — pre províziovú časť tohto nálezu:
  `/admin/commissions` a `EntityCommissionsPanel` (hosting/project) teraz jasne rozlišujú workflow flag
  (`commissions.payment_status`) od auditovanej výplaty (`payout_records`, nový stĺpec "Výplata" + 3-bucket
  totals breakdown). Nový shared modul `src/lib/finance/commissionPayoutStatus.ts`. `EntityProfitBanner` pre
  `AdminRentals.tsx`/rentals (zvyšok nálezu #8, ROADMAP 5.1/5.2) ostáva otvorené ako follow-up.

## 🟢 VYLEPŠENIA

### 9. Mixed shadcn `<Select>` vs raw `<select>`
- **Lokalizácia**: raw `<select>` v `AdminFinance.tsx` (rok), `AdminRentals.tsx`, `FinanceCommissionRulesPanel.tsx`,
  `FinanceReconciliation.tsx` (dismiss-type dropdown), `FinanceSettlementDrafts.tsx`, `PayrollExportPanel.tsx`,
  `ImplementerCommissionDetailDialog.tsx` — vs. 16 súborov so shadcn `<Select>`.
- **Business dopad**: Nízky — len vizuálna/UX nekonzistencia (focus states, keyboard nav sa líšia).

### 10. `detectRentalDualModelWarning` je "schovaný"
- **Lokalizácia**: `src/lib/finance/commissionConsistency.ts`, použitý iba v
  `src/components/admin/rentals/ImplementerCommissionDetailDialog.tsx`
- **Pozorovanie**: Funkcia, ktorá varuje pred dvojitým počítaním provízií (rental JSON % podiel vs normalizovaná
  provízia), existuje a má test (`rc65CommissionConsistency.test.ts`), ale je viditeľná iba pri kliknutí na
  detail konkrétneho realizátora v Rentals — nie v Finance reconciliation/governance, kde by patrila ako
  systémový issue.
- **Business dopad**: Nízky/stredný — mechanizmus na ochranu hard constraintu "NIKDY nemeň commission split v
  implementers JSON bez migrácie" existuje, ale nie je súčasťou centrálneho reconciliation flow.

### 11. `TRUTH_LEVEL_LABELS` nemapuje na farebnú konvenciu z CLAUDE.md
- **Lokalizácia**: `src/lib/finance/labels.ts`, `FinanceRecordsCrud.tsx` (`truthBadge()`)
- **Pozorovanie**: Badge používa `variant="default"|"secondary"` (theme farby), nie explicitné
  zelená/oranžová/červená/sivá z CLAUDE.md UI/UX pravidiel.
- **Business dopad**: Nízky — funguje, ale pri rozšírení truth badges do daily view (nález #4) bude treba
  zjednotiť farebnú mapu.
- **✅ RESOLVED (Fáza 3, 2026-06-14)**: nový shared `src/components/admin/finance/TruthLevelBadge.tsx`
  mapuje `*_fact` → zelená (#22c55e), `legacy_import` → oranžová (#f97316), `workflow_only`/`derived` → sivá
  (#6b7280) — presne CLAUDE.md konvencia. `truthBadge()` v `FinanceRecordsCrud.tsx` aj
  `CustomerFinancePanel.tsx` (Fáza 2) ho teraz používajú namiesto lokálnych `variant`-based badge.

## ✅ ČO FUNGUJE DOBRE

### 12. Golden Path je na DB úrovni reálne prepojený
- **Lokalizácia**: `payment_records.rental_website_id` a `cost_records.rental_website_id` sú FK →
  `rental_websites(id)` (migrácie `20260609120000`, `20260609130000`).
- **Prečo je to dobre**: DB schéma podporuje rental → payment/cost; UI doplnené vo Fáze 2 (Customer Hub).

### 13. `customers` FK rollout (F1 + RC5) — ✅ AKTÍVNE
- **Lokalizácia**: `20260611100000_customers_foundation.sql`, `20260611100100_customers_email_backfill.sql`,
  `20260614000000_rc5_rental_customer_identity.sql`
- **Prečo je to dobre**: `customer_id` FK na 5 tabuľkách + email backfill + index na `lower(display_name)` —
  solídny základ pre kanonickú identitu. Identity bridge (heuristika) ostáva ako fallback pre staré záznamy,
  čo je správny postupný prístup (žiadna retroaktívna deštruktívna migrácia).

### 14. Profit-display logika je navrhnutá defenzívne
- **Lokalizácia**: `src/lib/profit/profitContext.ts`
- **Prečo je to dobre**: `resolveProfitDisplayContext()` explicitne rozlišuje "no_revenue_yet", "zero_revenue",
  "cost_without_revenue" a `canShowProfit: false` v neistých prípadoch — presne v duchu "nikdy nenaznačiť zisk,
  ak nie je revenue základ známy". Použité v Customer Hub, hosting/project detail.

### 15. Legacy_import záznamy sú chránené pred zmazaním/úpravou
- **Lokalizácia**: `src/components/admin/finance/FinanceRecordsCrud.tsx`, `isLegacy(truthLevel)`
- **Prečo je to dobre**: UI vynucuje hard constraint "NIKDY nemaž legacy_import záznamy" — read-only s Lock
  ikonou, bez delete tlačidla. Nové záznamy hardcode-ujú `*_fact` truth level pri insert.

### 16. Cross-module linky v Customer Hub sú bohaté
- **Lokalizácia**: `CustomerWorkbench.tsx`
- **Prečo je to dobre**: 8 záložiek + priame linky na `/admin/rollout-health`, `/admin/communication-ops`,
  `/admin/signatures`, `/admin/designs`, `/admin/rentals`, `/admin/hosting`, `/admin/projects`, `/admin/tasks`,
  `/admin?lead=`. Finančný blok (#1, #2) doručený vo Fáze 2.

### 17. RBAC scoping — ✅ AKTÍVNE (`owner` / `administrator`)
- **Lokalizácia**: `src/lib/rbac/permissions.ts`
- **Prečo je to dobre**: `filterCommissionsForUser`, `commissionVisibleToUser` (case-insensitive),
  `resolveScopedCommissionEmpty` (3 rozlíšené dôvody prázdneho stavu s user-friendly textom) — pripravené pre
  `resolveScopedCommissionEmpty` — pripravené pre Commission Clarity (Fáza 5, hotová časť).
  Legacy DB enum `admin`/`user` sa normalizuje na `owner`/`administrator` v `useAdminAccess`.

### 18. Destructive delete (customer / hosting / rental / lead) — ✅ RESOLVED (Fáza 2c + L1/L2)
- **Lokalizácia**: `useDestructiveAction.ts`, destructive RPC migrácie, `ConfirmDestructiveActionModal`, `src/lib/leads/destructive.ts`, `bulkLeadDelete.ts`
- **Stav**: Precheck + execute RPC pre customer/hosting/rental/lead. Lead: hard delete + detach tasks/notes; bulk skipne `is_risky` leady. Wired v Admin.tsx (single + bulk).
