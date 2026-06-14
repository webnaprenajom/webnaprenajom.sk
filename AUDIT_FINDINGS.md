# AUDIT_FINDINGS.md — webnaprenajom.sk CRM

> Audit KROK 3 (READ ONLY). Zoradené podľa závažnosti. Každý nález má lokalizáciu v kóde a business dopad.

## 🔴 KRITICKÉ

### 1. Customer Hub nemá kompletný finančný obraz klienta
- **Lokalizácia**: `src/lib/customerWorkbench/loadCustomerWorkbench.ts` (411 riadkov), `src/lib/customerWorkbench/types.ts`,
  `src/components/admin/customerWorkbench/CustomerWorkbench.tsx` (tab "financie", ~1012 riadkov)
- **Problém**: `loadCustomerWorkbench` nikde nevolá `payment_records`, `payout_records` ani `cost_records`.
  `CustomerWorkbenchData` tieto pola vôbec nemá. Tab "financie" zobrazuje len `paidCommissions`/`unpaidCommissions`
  (zo `commissions` tabuľky) — žiadny príjem, žiadne náklady, žiadny "čistý zisk".
- **Business dopad**: Maroš nevidí na jednej stránke "kto platí, koľko, čistý zisk" pre konkrétneho klienta —
  presne to, čo CLAUDE.md definuje ako primárnu potrebu. Musí prepínať medzi Customer Hub a Finance/Rentals
  a ručne si dávať čísla do súvisu. Toto je hlavný gap medzi "Golden Path" (DB úroveň funguje, FK existujú) a
  prezentačnou vrstvou.

### 2. Customer Hub nemá históriu platieb (graf ani tabuľku)
- **Lokalizácia**: rovnaké súbory ako #1
- **Problém**: Bez `payment_records`/`rental_payments` dát v `CustomerWorkbenchData` nie je možné zobraziť
  timeline platieb. `CustomerTimeline` komponent existuje, ale pracuje len s `lead_logs`/`communication_events`,
  nie s platbami.
- **Business dopad**: Pri riešení sporu o platbu ("zaplatil/nezaplatil minulý mesiac?") musí Maroš ísť do
  `/admin/rentals` alebo `/admin/finance` a filtrovať manuálne.

### 3. AdminFinance.tsx — nekonzistentné error handling pri 13 paralelných queries
- **Lokalizácia**: `src/pages/AdminFinance.tsx`, funkcia `load()` (13× `supabase.from(...)` v `Promise.all`)
- **Problém**: Iba chyby pri `commissions`/`expenses` vyvolajú `toast()` (1 toast call v celom súbore).
  Chyby pri `payment_records`, `payout_records`, `cost_records`, `commission_rules`, `commission_rule_overrides`,
  `hosting_records`, `finance_policy_settings` sa ticho premenia na `[]` (`pr.error ? [] : pr.data || []`).
- **Business dopad**: Ak zlyhá query na `payment_records` (napr. RLS problém po zmene rolí), Finance stránka
  vyzerá normálne, ale všetky súčty sú nesprávne — bez akéhokoľvek upozornenia. Vysoké riziko pri finančných číslach.

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

### 5. KPI karty v daily Finance view sú len pre admina
- **Lokalizácia**: `src/pages/AdminFinance.tsx`, `showOrgKpis = canAccessOperationalCrm(access.role)`
- **Problém**: KPI karty ("Zaplatené faktúry", "Prijaté platby" atď.) sú v kóde *above the fold* — to je v poriadku —
  ale celá sekcia je podmienená `role === "admin"`. `role="user"` (realizátor) nevidí žiadne KPI, iba tabuľku provízií.
- **Business dopad**: CLAUDE.md pravidlo "KPI karty vždy above the fold" platí len pre admina. Pre implementerov
  by aspoň scoped KPI (vlastné provízie/výplaty) zlepšili prehľad bez nutnosti scrollovať do tabuľky.

### 6. Inline Supabase queries — "spaghetti" v najväčších stránkach
- **Lokalizácia**: `AdminRentals.tsx` (19×), `Admin.tsx` (18×), `AdminFinance.tsx` (13×), `AdminCommissions.tsx` (12×)
  — všetko `supabase.from(...)` priamo v page komponentoch, nie v `lib/`/hooks.
- **Problém**: Dátová logika je zamiešaná s UI logikou, ťažko testovateľná (porovnaj s `loadCustomerWorkbench.ts`,
  ktorý má vlastné testy v `src/test/`). Zmena schémy (napr. pridanie `rental_website_id` do query) vyžaduje
  úpravu na viacerých miestach naraz.
- **Business dopad**: Vyššie riziko regresií pri budúcich zmenách (napr. Fáza 2 nižšie, kde treba pridať finance
  queries do Customer Hub aj Rentals).

### 7. CLAUDE.md je už zastaraný v sekcii "Customer identity"
- **Lokalizácia**: `CLAUDE.md` (práve vytvorený), sekcia "DATABÁZA – KĽÚČOVÉ TABUĽKY" hovorí
  "Customer identity: identity bridge cez email/name – **NIE full customers tabuľka**" a v POST-RELEASE BACKLOG
  je "Full customers tabuľka s FK".
- **Skutočnosť**: Migrácie `20260611100000_customers_foundation.sql` (F1) a `20260614000000_rc5_rental_customer_identity.sql`
  (RC5) **už vytvorili** `customers` tabuľku + `customer_id` FK na `leads`, `project_notes`, `rental_websites`,
  `hosting_records`, `commissions`, + `rental_websites.customer_email` backfill. `loadCustomerWorkbench.ts` to
  aktívne používa (`findCustomerById`, `CanonicalCustomerBadge` vs `HeuristicDataBadge`).
- **Business dopad**: CLAUDE.md (zdroj pravdy pre Claude session) je v rozpore s realitou — riziko, že budúce
  session budú plánovať prácu na "Full customers tabuľka s FK", ktorá je z veľkej časti hotová. Treba
  CLAUDE.md opraviť (presunúť z backlogu, popísať reálny stav: FK existujú, ale identity bridge cez email/name
  je stále potrebná pre záznamy bez `customer_id`).

### 8. "Čistý zisk" komponent existuje, ale nie je univerzálny
- **Lokalizácia**: `src/lib/profit/profitCalculator.ts`, `src/lib/profit/profitContext.ts`,
  `src/components/admin/EntityProfitBanner.tsx`, použité v `AdminHostingDetail.tsx` a `AdminProjectDetail.tsx`
  (cez `EntityCommissionsPanel`).
- **Problém**: Logika `profit = max(0, revenue - operatingCost)` s bezpečnými fallbackmi je dobre navrhnutá,
  ale je vykreslená iba pre `entityKind: "hosting" | "project"`. `AdminRentals.tsx` (kde je hlavný revenue stream —
  mesačné prenájmy) a Customer Hub ju nemajú.
- **Business dopad**: Najdôležitejšie číslo ("čistý zisk", ktoré priamo definuje CLAUDE.md ako kľúčovú potrebu)
  chýba presne tam, kde je revenue najväčší (rentals) a kde ho Maroš najčastejšie potrebuje (Customer Hub).

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

## ✅ ČO FUNGUJE DOBRE

### 12. Golden Path je na DB úrovni reálne prepojený
- **Lokalizácia**: `payment_records.rental_website_id` a `cost_records.rental_website_id` sú FK →
  `rental_websites(id)` (migrácie `20260609120000`, `20260609130000`).
- **Prečo je to dobre**: Fáza 2 (Customer Hub finance) je teda "len" o doplnení queries a UI — DB schéma už
  podporuje presné prepojenie rental → payment/cost bez ďalšej migrácie.

### 13. `customers` FK rollout (F1 + RC5) je ďalej, než CLAUDE.md predpokladá
- **Lokalizácia**: `20260611100000_customers_foundation.sql`, `20260611100100_customers_email_backfill.sql`,
  `20260614000000_rc5_rental_customer_identity.sql`
- **Prečo je to dobre**: `customer_id` FK na 5 tabuľkách + email backfill + index na `lower(display_name)` —
  solídny základ pre kanonickú identitu. Identity bridge (heuristika) ostáva ako fallback pre staré záznamy,
  čo je správny postupný prístup (žiadna retroaktívna deštruktívna migrácia).

### 14. Profit-display logika je navrhnutá defenzívne
- **Lokalizácia**: `src/lib/profit/profitContext.ts`
- **Prečo je to dobre**: `resolveProfitDisplayContext()` explicitne rozlišuje "no_revenue_yet", "zero_revenue",
  "cost_without_revenue" a `canShowProfit: false` v neistých prípadoch — presne v duchu "nikdy nenaznačiť zisk,
  ak nie je revenue základ známy". Toto je vzor, ktorý treba znovu použiť vo Fáze 2 pre Customer Hub aj Rentals.

### 15. Legacy_import záznamy sú chránené pred zmazaním/úpravou
- **Lokalizácia**: `src/components/admin/finance/FinanceRecordsCrud.tsx`, `isLegacy(truthLevel)`
- **Prečo je to dobre**: UI vynucuje hard constraint "NIKDY nemaž legacy_import záznamy" — read-only s Lock
  ikonou, bez delete tlačidla. Nové záznamy hardcode-ujú `*_fact` truth level pri insert.

### 16. Cross-module linky v Customer Hub sú bohaté
- **Lokalizácia**: `CustomerWorkbench.tsx`
- **Prečo je to dobre**: 8 záložiek + priame linky na `/admin/rollout-health`, `/admin/communication-ops`,
  `/admin/signatures`, `/admin/designs`, `/admin/rentals`, `/admin/hosting`, `/admin/projects`, `/admin/tasks`,
  `/admin?lead=`. Audit item A (cross-module links) je splnený — chýba len finančný blok (#1, #2).

### 17. RBAC scoping pre provízie je dobre premyslený
- **Lokalizácia**: `src/lib/rbac/permissions.ts`
- **Prečo je to dobre**: `filterCommissionsForUser`, `commissionVisibleToUser` (case-insensitive),
  `resolveScopedCommissionEmpty` (3 rozlíšené dôvody prázdneho stavu s user-friendly textom) — pripravené pre
  Fázu 5 (Commission Clarity) bez väčších zmien v RBAC vrstve.
