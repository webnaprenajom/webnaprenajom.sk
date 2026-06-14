# ROADMAP.md — webnaprenajom.sk CRM

> Vychádza z AUDIT_FINDINGS.md. Po dokončení fázy: aktualizovať tento súbor (✅ DONE pri úlohách) + CLAUDE.md.

---

## Fáza 1 — Stabilizácia
**Cieľ**: opraviť kritické a dôležité nálezy z auditu, bez nových features. Odstrániť riziko skrytých chýb vo finančných číslach.

**Odhad**: 1–1.5 dňa

| # | Úloha | Súvisí s nálezom | Súbory | Stav |
|---|---|---|---|---|
| 1.1 | Doplniť per-query error handling (vlastný `errors[]` + toast + banner) pre všetkých 13 queries v `AdminFinance.tsx` (nielen commissions/expenses) | 🔴 #3 | `src/pages/AdminFinance.tsx` | ✅ DONE |
| 1.2 | Opraviť CLAUDE.md sekciu "Customer identity" — `customers` tabuľka s FK existuje (F1/RC5), presunúť z POST-RELEASE BACKLOG do aktuálneho stavu | 🟡 #7 | `CLAUDE.md` | ✅ DONE |
| 1.5 | Audit: presne zmapovať truth-level gaps v `DailyFinanceView` (KPI karty + tabuľka provízií) — inline `// AUDIT (Fáza 1, bod 3)` komentáre + rozšírenie AUDIT_FINDINGS.md #4 o presnú mapu | 🟡 #4 | `src/pages/AdminFinance.tsx`, `AUDIT_FINDINGS.md` | ✅ DONE (len audit, žiadna vizuálna zmena) |

> 1.3 a 1.4 (pôvodne plánované tu) sú **dizajnové zmeny** (farby/komponenty) — presunuté do Fázy 3 ako 3.5/3.6,
> pretože Fáza 1 sa explicitne obmedzuje na stabilitu dát a presnosť zobrazenia, bez vylepšovania dizajnu.

---

## Fáza 2 — Customer Hub Enhancement
**Cieľ**: `/admin/customer/:key` zobrazuje kompletný finančný obraz klienta — príjem, náklady, čistý zisk, provízie, história platieb.

**Odhad**: 2–3 dni

| # | Úloha | Súvisí s nálezom | Súbory |
|---|---|---|---|
| 2.1 | Doplniť `payment_records`, `cost_records`, `payout_records` queries do `loadCustomerWorkbench.ts` (filter cez `rental_website_id` IN customer's rentals, + `customer_id`/`customer_email` priamo) | 🔴 #1, #2 | `src/lib/customerWorkbench/loadCustomerWorkbench.ts`, `types.ts` |
| 2.2 | Rozšíriť `CustomerWorkbenchData` o `paymentRecords`, `costRecords`, `payoutRecords` | 🔴 #1 | `src/lib/customerWorkbench/types.ts` |
| 2.3 | Vypočítať per-customer finančný súhrn (príjem, náklady, profit) — znovupoužiť `computeProfit`/`resolveProfitDisplayContext` pattern z `profitContext.ts` | 🔴 #1, 🟡 #8 | `src/lib/customerWorkbench/summary.ts` |
| 2.4 | V tabe "financie" zobraziť: finančný súhrn (truth-level badge pri každom čísle), `<EntityProfitBanner>`-style komponent, zoznam `payment_records`/`cost_records` | 🔴 #1, 🟡 #4, #8 | `CustomerWorkbench.tsx` |
| 2.5 | Pridať platobnú históriu — graf (recharts, mesačné príjmy vs. náklady) + tabuľka `payment_records` zoradená podľa dátumu | 🔴 #2 | `CustomerWorkbench.tsx` (nový podkomponent `CustomerPaymentHistory.tsx`) |
| 2.6 | `npm run build` po každom komponente, commit `feat(customer-hub): ...` | — | — |

> Plan Mode povinný (≥3 súbory). Business logika profitu sa **neprepočítava retroaktívne** — len zobrazuje
> existujúce `payment_records`/`cost_records` (hard constraint "NIKDY retroaktívne prepočítavaj payouty").

---

## Fáza 3 — Finance Coherence
**Cieľ**: truth-level badge pri každom finančnom čísle (aj v daily view), KPI above the fold pre všetky role, reconciliation flow plne funkčný a viditeľný.

**Odhad**: 1.5–2 dni

| # | Úloha | Súvisí s nálezom | Súbory |
|---|---|---|---|
| 3.1 | Pridať truth-level badge do `DailyFinanceView` (KPI karty + tabuľka provízií) — presná mapa gapov je zdokumentovaná v `AUDIT_FINDINGS.md` #4 a v `// AUDIT (Fáza 1, bod 3)` komentároch v kóde | 🟡 #4 | `src/pages/AdminFinance.tsx` |
| 3.2 | Scoped KPI karty pre `role="user"` (vlastné provízie/výplaty) v daily view, above the fold | 🟡 #5 | `src/pages/AdminFinance.tsx` |
| 3.3 | Presunúť `detectRentalDualModelWarning` do Finance reconciliation/governance ako systémový issue (nie len v dialógu jedného realizátora) | 🟢 #10 | `src/components/admin/finance/FinanceReconciliation.tsx`, `src/lib/finance/commissionConsistency.ts`, `buildReviewQueue.ts` |
| 3.4 | Overiť a doplniť `FINANCE_TRUTH_DISCLAIMER` aj mimo "advanced" view | 🟡 #4 | `src/pages/AdminFinance.tsx` |
| 3.5 | (presunuté z 1.3) Zjednotiť raw `<select>` → shadcn `<Select>` (7 súborov) | 🟢 #9 | `AdminFinance.tsx`, `AdminRentals.tsx`, `FinanceCommissionRulesPanel.tsx`, `FinanceReconciliation.tsx`, `FinanceSettlementDrafts.tsx`, `PayrollExportPanel.tsx`, `ImplementerCommissionDetailDialog.tsx` |
| 3.6 | (presunuté z 1.4) Zjednotiť `TRUTH_LEVEL_LABELS`/`truthBadge` na farebnú konvenciu z CLAUDE.md (#22c55e/#f97316/#ef4444/#6b7280) | 🟢 #11 | `src/lib/finance/labels.ts`, `FinanceRecordsCrud.tsx` |

> Pozn.: 3.5 zasahuje 7 súborov → **Plan Mode povinný** (hard constraint).

---

## Fáza 4 — Pipeline & Leads UX
**Cieľ**: `/admin` (Leads pipeline) ukazuje "dní bez kontaktu" indikátor pre rýchlu prioritizáciu.

**Odhad**: 0.5–1 deň

| # | Úloha | Súbory |
|---|---|---|
| 4.1 | Vypočítať "dní od posledného kontaktu" z `lead_logs`/`communication_events` per lead | `src/pages/Admin.tsx` alebo nový `src/lib/leads/lastContact.ts` |
| 4.2 | Zobraziť indikátor (farba podľa CLAUDE.md: zelená <3 dni, oranžová 3-7, červená >7) v pipeline tabuľke/kartách | `src/pages/Admin.tsx` |
| 4.3 | Zoradiť/filtrovať podľa "dní bez kontaktu" | `src/pages/Admin.tsx` |

> Vzhľadom na 18 inline supabase queries v `Admin.tsx` (🟡 #6) — zvážiť extrakciu lead-loading logiky do
> `src/lib/leads/loadLeadsPipeline.ts` ako súčasť tejto fázy (znižuje riziko pri ďalších zmenách).

---

## Fáza 5 — Commission Clarity
**Cieľ**: jedno miesto, kde je vidno kto/čo/koľko/kedy pre provízie — cez všetky zdroje (normalized, legacy, rental_json).

**Odhad**: 1.5–2 dni

| # | Úloha | Súvisí s nálezom | Súbory |
|---|---|---|---|
| 5.1 | Zjednotiť `EntityCommissionsPanel` pattern pre rentals (momentálne len hosting/project) | 🟡 #8 | `src/components/admin/EntityCommissionsPanel.tsx`, `AdminRentals.tsx` |
| 5.2 | Pridať `<EntityProfitBanner>` do `AdminRentals.tsx` detailu prenájmu | 🟡 #8 | `AdminRentals.tsx` |
| 5.3 | Využiť `classifyCommissionSource`/`countBySourceKind` na agregovaný pohľad "kto/čo/koľko/kedy" v `/admin/commissions` | — | `src/pages/AdminCommissions.tsx`, `src/lib/finance/commissionConsistency.ts` |
| 5.4 | Prepojiť s RBAC scoping (`filterCommissionsForUser`, `resolveScopedCommissionEmpty`) — overiť, že nový pohľad rešpektuje role | 🟢 #17 (✅ funguje, len treba znovupoužiť) | `src/lib/rbac/permissions.ts` |

---

## Záver
Fázy sú navrhnuté tak, aby každá bola samostatne commitovateľná a buildovateľná (`npm run build` po komponente).
Fáza 2 je z biznis pohľadu najvyššia priorita (priamo rieši hlavnú deklarovanú potrebu z CLAUDE.md), ale Fáza 1
by mala ísť prvá, pretože opravuje riziko nesprávnych finančných čísel (#3) ešte predtým, než na ne Fáza 2
nadviaže.
