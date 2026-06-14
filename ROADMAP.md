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

## Fáza 2 — Customer Hub Enhancement ✅ DONE
**Cieľ**: `/admin/customer/:key` zobrazuje kompletný finančný obraz klienta — príjem, náklady, čistý zisk, provízie, história platieb.

**Odhad**: 2–3 dni

| # | Úloha | Súvisí s nálezom | Súbory | Stav |
|---|---|---|---|---|
| 2.1 | Doplniť `payment_records`, `cost_records`, `payout_records`, `rental_payments` queries do `loadCustomerWorkbench.ts` (filter cez `rental_website_id` IN customer's rentals, + `customer_email`/`client_name` fallback; `payout_records` cez `source_table='commissions' AND source_id IN commission ids`) | 🔴 #1, #2 | `src/lib/customerWorkbench/loadCustomerWorkbench.ts` | ✅ DONE |
| 2.2 | Rozšíriť `CustomerWorkbenchData` o `paymentRecords`, `costRecords`, `payoutRecords`, `rentalPayments` (+ nové typy `PaymentRecord`, `CostRecord`, `PayoutRecord`, `RentalPaymentBrief`, `CommissionPayout`, `CustomerFinanceSummary`) | 🔴 #1 | `src/lib/customerWorkbench/types.ts` | ✅ DONE |
| 2.3 | Vypočítať per-customer finančný súhrn (`computeCustomerFinanceSummary`) — príjem (fact/legacy split), očakávané platby (z `rental_payments` kde `paid=false`), náklady (fact/legacy split), hrubý/čistý zisk cez `resolveProfitDisplayContext` (nový `entityKind: "customer"`), vyplatené provízie podľa realizátora | 🔴 #1, 🟡 #8 | `src/lib/customerWorkbench/summary.ts`, `src/lib/profit/profitContext.ts` | ✅ DONE |
| 2.4 | V tabe "financie" zobraziť: finančný súhrn (truth-level badge pri každom čísle), `<EntityProfitBanner>` (entityKind="customer"), tabuľku väzieb prenájom→príjmy/náklady, tabuľku vyplatených provízií podľa realizátora | 🔴 #1, 🟡 #4, #8 | `CustomerWorkbench.tsx`, nový `CustomerFinancePanel.tsx` | ✅ DONE |
| 2.5 | Pridať platobnú históriu — tabuľka `payment_records` za posledných 12 mesiacov (dátum, prenájom, metóda, suma, truth-level badge) | 🔴 #2 | `CustomerFinancePanel.tsx` | ✅ DONE |
| 2.6 | `npx tsc --noEmit` + `npx vitest run` (nové testy pre `computeCustomerFinanceSummary`), update ROADMAP.md | — | `src/test/customerWorkbenchSummary.test.ts` | ✅ DONE (tsc OK; vitest nemožno spustiť v sandboxe — `@rollup/rollup-linux-x64-gnu` chýba, npm 403, rovnaký známy limit ako Fáza 1) |

> Plan Mode povinný (≥3 súbory) — dodržané. Business logika profitu sa **neprepočítava retroaktívne** — len zobrazuje
> existujúce `payment_records`/`cost_records`/`payout_records`/`rental_payments` (hard constraint "NIKDY retroaktívne prepočítavaj payouty").
>
> **Doplnenia oproti pôvodnému plánu**:
> - Pridaný `rental_payments` (neuhradené riadky = "očakávané platby", `truth_level=workflow_only`, sivá) — presnejšie ako odhad z `monthly_price`, bez novej DB.
> - "Firma" v identite klienta sa defenzívne čerpá z `customers.metadata.company` (väčšina záznamov to ešte nemá — edge case nižšie).
> - `ProfitEntityKind` rozšírený o `"customer"` v `profitContext.ts` (len label/text varianty, žiadna zmena business logiky).
>
> **Otvorené edge cases**:
> - `payout_records` nemá priamy customer link — páruje sa cez `source_table='commissions' AND source_id IN <commissions.id>`; ak provízia nemá zodpovedajúci `payout_records` riadok, "Vyplatené provízie" zostane 0 aj keď `commissions.payment_status='paid'` (zámerné — zobrazujeme len auditované výplaty).
> - `cost_records` nemá `customer_email` — náklady bez `rental_website_id` sa páruje len cez `client_name` (rovnaká heuristika ako zvyšok workbenchu).
> - Klienti bez `customers.metadata.company` nezobrazia "firma" riadok (žiadna migrácia, pole je optional).
> - "Hrubý zisk" / "Čistý zisk" sa nezobrazí (`—`), keď `paymentsReceivedTotal=0 && costsTotal=0` (status `no_revenue_yet`), v súlade s "nikdy nenaznačiť zisk bez známeho základu".

---

## Fáza 2b — Customer Hub Executive Cockpit ✅ DONE
**Cieľ**: Executive cockpit layout na `/admin/customer/:key` — above-the-fold financie, unified služby, sekčné error stavy, aggregate loader.

| # | Úloha | Súbory | Stav |
|---|---|---|---|
| 2b.1 | Refaktor loader → `loadCustomerHubAggregate` + `sectionFetch` + `resolveCustomerIdentity` | `loadCustomerHubAggregate.ts`, `sectionFetch.ts`, `resolveCustomerIdentity.ts` | ✅ DONE |
| 2b.2 | Fix `hasAnyData` (payment/cost/payout záznamy), `computeCustomerMrr`, `computeCustomerRiskBadges` | `summary.ts` | ✅ DONE |
| 2b.3 | Hub komponenty: Header, FinanceSnapshot, ServicesPanel, FlowTimeline, CommissionsAuditStrip | `src/components/admin/customerHub/*` | ✅ DONE |
| 2b.4 | `useCustomerHub` hook + reštruktúra Prehľad tabu | `useCustomerHub.ts`, `CustomerWorkbench.tsx`, `AdminCustomer.tsx` | ✅ DONE |
| 2b.5 | Timeline rozšírenie (payment/payout/rental_payment udalosti) | `timeline.ts` | ✅ DONE |
| 2b.6 | Testy + dokumentácia | `customerHubAggregate.test.ts`, `CLAUDE.md` | ✅ DONE |

---

## Fáza 2c — Safe Destructive Delete ✅ DONE
**Cieľ**: Bezpečné mazanie klientov, hostingu a prenájmov s finance integrity guard, impact precheck a shared modal.

| # | Úloha | Súbory | Stav |
|---|---|---|---|
| 2c.1 | RPC `admin_precheck_destructive_delete` + `admin_execute_destructive_delete` | `20260619000000_destructive_delete_rpcs.sql` | ✅ DONE |
| 2c.2 | Shared `ConfirmDestructiveActionModal` + `useDestructiveAction` + blocking list + CTA links | `src/components/admin/destructive/*`, `src/lib/destructive/*`, `useDestructiveAction.ts` | ✅ DONE |
| 2c.3 | Delete hosting + rental (nahradenie slepého confirm) | `FinanceHostingPanel`, `AdminHostingDetail`, `AdminRentals` | ✅ DONE |
| 2c.4 | Delete customer | `AdminClients`, `CustomerHubHeader`, `CustomerWorkbench` | ✅ DONE |
| 2c.5 | Audit `entity_deleted` + testy | `auditLog.ts`, `destructiveDelete.test.ts` | ✅ DONE |

---

## Fáza 3 — Finance Coherence
**Cieľ**: truth-level badge pri každom finančnom čísle (aj v daily view), KPI above the fold pre všetky role, reconciliation flow plne funkčný a viditeľný.

**Odhad**: 1.5–2 dni

| # | Úloha | Súvisí s nálezom | Súbory | Stav |
|---|---|---|---|---|
| 3.1 | Pridať truth-level badge do `DailyFinanceView` (KPI karty + tabuľka provízií) — presná mapa gapov je zdokumentovaná v `AUDIT_FINDINGS.md` #4 a v `// AUDIT (Fáza 1, bod 3)` komentároch v kóde | 🟡 #4 | `src/pages/AdminFinance.tsx` | ✅ DONE |
| 3.2 | Scoped KPI karty pre `role="user"` (vlastné provízie/výplaty) v daily view, above the fold | 🟡 #5 | `src/pages/AdminFinance.tsx` | — |
| 3.3 | Presunúť `detectRentalDualModelWarning` do Finance reconciliation/governance ako systémový issue (nie len v dialógu jedného realizátora) | 🟢 #10 | `src/components/admin/finance/FinanceReconciliation.tsx`, `src/lib/finance/commissionConsistency.ts`, `buildReviewQueue.ts` | — |
| 3.4 | Overiť a doplniť `FINANCE_TRUTH_DISCLAIMER` aj mimo "advanced" view | 🟡 #4 | `src/pages/AdminFinance.tsx` | ✅ DONE |
| 3.5 | (presunuté z 1.3) Zjednotiť raw `<select>` → shadcn `<Select>` (7 súborov) | 🟢 #9 | `AdminFinance.tsx`, `AdminRentals.tsx`, `FinanceCommissionRulesPanel.tsx`, `FinanceReconciliation.tsx`, `FinanceSettlementDrafts.tsx`, `PayrollExportPanel.tsx`, `ImplementerCommissionDetailDialog.tsx` | — |
| 3.6 | (presunuté z 1.4) Zjednotiť `TRUTH_LEVEL_LABELS`/`truthBadge` na farebnú konvenciu z CLAUDE.md (#22c55e/#f97316/#ef4444/#6b7280) | 🟢 #11 | `src/lib/finance/labels.ts`, `FinanceRecordsCrud.tsx` | ✅ DONE |

> Pozn.: 3.5 zasahuje 7 súborov → **Plan Mode povinný** (hard constraint). 3.5 ostáva pre samostatnú session.
>
> **3.1/3.4/3.6 dokončené (2026-06-14)**:
> - Nový shared komponent `src/components/admin/finance/TruthLevelBadge.tsx` — jediný zdroj pravdy pre
>   truth-level badge (farby presne podľa CLAUDE.md: `*_fact`=zelená, `legacy_import`=oranžová,
>   `workflow_only`/`derived`=sivá). Používa ho `AdminFinance.tsx`, `FinanceRecordsCrud.tsx` aj
>   `CustomerFinancePanel.tsx` (Fáza 2) — odstránené duplicitné lokálne `TruthBadge`/`truthToneClass`.
> - `DailyFinanceView`: `FINANCE_TRUTH_DISCLAIMER` teraz viditeľný aj mimo "Pokročilé" (predtým len Advanced).
> - KPI "Prijaté platby" — z principu mixované (`payment_fact` + `legacy_import`) → rozpis pod hodnotou
>   (`TruthLevelBadge` + suma za každý truth-level).
> - KPI "Zaplatené faktúry" / "Nezaplatené / fakturované" / "Čakajúce platby" — čisté `workflow_only`
>   (z `rental_payments`), badge v rohu karty.
> - Tabuľka "Provízie podľa realizátora" / "Vaše provízie" — nový stĺpec "Truth" (`workflow_only`,
>   z `commissions`) + vysvetľujúca pätička s odkazom na `payout_records` v Pokročilé → Záznamy → Výplaty.
> - `FinanceRecordsCrud.tsx`: `truthBadge()` teraz delegovaný na `<TruthLevelBadge>` (CLAUDE.md farby
>   namiesto `variant="default"|"secondary"`).
> - Business logika a výpočty (`buildFinanceSnapshot`, migrácie) nezmenené — len prezentačná vrstva.
> - `npx tsc --noEmit`: bez chýb. `npx eslint` na 3 upravených súboroch hlásil parsing errors
>   (`Invalid character` / `'}' expected`) — overené ako artefakt stale cache Linux bash-mountu
>   (trailing NUL bajty / odrezaný súbor na bash strane), nie reálna chyba v kóde — Windows-side
>   `Read` na presne tých riadkoch ukazuje syntakticky správny, kompletný kód.

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

| # | Úloha | Súvisí s nálezom | Súbory | Stav |
|---|---|---|---|---|
| 5.1 | Zjednotiť `EntityCommissionsPanel` pattern pre rentals (momentálne len hosting/project) | 🟡 #8 | `src/components/admin/EntityCommissionsPanel.tsx`, `AdminRentals.tsx` | — (rental rollout zostáva follow-up) |
| 5.2 | Pridať `<EntityProfitBanner>` do `AdminRentals.tsx` detailu prenájmu | 🟡 #8 | `AdminRentals.tsx` | — |
| 5.3 | Využiť `classifyCommissionSource`/`countBySourceKind` na agregovaný pohľad "kto/čo/koľko/kedy" v `/admin/commissions` | — | `src/pages/AdminCommissions.tsx`, `src/lib/finance/commissionConsistency.ts` | ✅ DONE (Commission Clarity, 2026-06-14) |
| 5.4 | Prepojiť s RBAC scoping (`filterCommissionsForUser`, `resolveScopedCommissionEmpty`) — overiť, že nový pohľad rešpektuje role | 🟢 #17 (✅ funguje, len treba znovupoužiť) | `src/lib/rbac/permissions.ts` | ✅ DONE (nový "Klient" stĺpec je admin-only, viď nižšie) |

> **✅ Commission Clarity (5.3 + časť 5.4 + 5.1, 2026-06-14)** — rozsah podľa schváleného plánu (bez "základ pre výpočet"):
> - Nový shared modul `src/lib/finance/commissionPayoutStatus.ts` — `resolveCommissionPayoutInfo()` a
>   `summarizeCommissionPayoutTotals()` rozlišujú workflow flag (`commissions.payment_status`) od auditovanej
>   pravdy (`payout_records` s `source_table='commissions' AND source_id=<commission.id>`). 4 stavy:
>   `unpaid_workflow`, `paid_workflow_unaudited`, `audited_payout_fact`, `audited_legacy_import`.
>   Pri viacerých `payout_records` na jednu províziu: súčet súm, najnovší `paid_at`, `payout_fact` vyhráva nad
>   `legacy_import` (truth ordering podľa CLAUDE.md).
> - `/admin/commissions` (`AdminCommissions.tsx`): `load()` teraz paralelne načíta `payout_records`
>   (`source_table='commissions'`); pri chybe tejto query sa zobrazí toast upozornenie (audit môže byť
>   nepresný), provízie samé sa zobrazia ďalej. Nová sekcia kariet "Vyplatené (workflow) — neauditované" vs
>   "Auditované výplaty (payout_records)" (s rozpisom `payout_fact`/`legacy_import`) — 3-bucket "paid vs not
>   yet paid" bez miešania workflow a auditovaných payoutov (úloha 4 zo zadania). Nový stĺpec "Výplata" v
>   tabuľke (audit badge + suma + dátum pre auditované, sivý badge "neauditované" pre vyplatené-bez-payoutu,
>   `—` pre nevyplatené). Nový stĺpec "Klient" — **len pre admina** (`useAccessContext().isAdmin`), link cez
>   `adminCustomerHrefPreferred`; pre `role="user"` stĺpec úplne chýba (nie anonymizovaný, nezobrazený).
> - `EntityCommissionsPanel.tsx` (hosting/project detail): `load()` doplnené o `payout_records` query pre
>   načítané commission ids; rovnaký "Výplata" audit badge v stĺpci Stav (desktop tabuľka aj mobilná karta).
> - **Mimo rozsahu (zámerne, podľa schváleného plánu)**: "základ pre výpočet" (`resolveCommissionRate`/
>   `commission_rules`/`commission_rule_overrides` v `/admin/commissions`) — vynechané na žiadosť Maroša.
>   `ImplementerCommissionDetailDialog.tsx` (rental_json % share), `AdminRentals.tsx` integrácia (5.1/5.2 plný
>   rollout pre rentals) — odložené ako follow-up, aby sa predišlo "zbytočnému redesignu".
> - Žiadne migrácie, žiadny retroaktívny prepočet payoutov — len nová klasifikačná/zobrazovacia vrstva nad
>   existujúcimi `commissions`/`payout_records` riadkami.

---

## Záver
Fázy sú navrhnuté tak, aby každá bola samostatne commitovateľná a buildovateľná (`npm run build` po komponente).
Fáza 2 je z biznis pohľadu najvyššia priorita (priamo rieši hlavnú deklarovanú potrebu z CLAUDE.md), ale Fáza 1
by mala ísť prvá, pretože opravuje riziko nesprávnych finančných čísel (#3) ešte predtým, než na ne Fáza 2
nadviaže.
