# CLAUDE.md — webnaprenajom.sk CRM

> Vlastník: Maros Seman | Role pre Claude: Enterprise Architect + Senior Dev

## PROJEKT

webnaprenajom.sk prenajíma weby malým firmám.
Klient platí mesačný poplatok → odtiaľ sa odrátajú náklady → zo zisku sa počítajú provízie.
Maroš potrebuje vidieť: kto platí, koľko, čistý zisk, komu ide provízia.

## TECH STACK

React + Vite + TypeScript | shadcn-ui + Tailwind CSS | Supabase (PostgreSQL + RLS + Auth) | Resend (Edge Functions) | Deploy: Lovable

## PRÍKAZY

npm run dev → http://localhost:5173
npm run build → dist/
npm run lint → ESLint (legacy any warnings sú OK)
npm test → Vitest

supabase db push → deploy migrácií

## ADMIN ROUTES

/admin → Leads pipeline
/admin/customer/:key → Customer detail hub
/admin/finance → Finance (overview, records, reconciliation, governance)
/admin/rentals → Rental websites & payments
/admin/commissions → Commissions & expenses
/admin/tasks → Tasks
/admin/wheel-leads → Wheel leads
/admin/debug → ⚠️ len dev, nepoužívať v produkcii

## DATABÁZA – KĽÚČOVÉ TABUĽKY

CRM: leads, rental_websites, commissions, rental_payments, expenses
Finance (po migrácii): payment_records, payout_records, cost_records, finance_issue_dismissals, finance_rules, finance_hosting_records, finance_review_items, finance_review_cadence
Customer identity: tabuľka `customers` EXISTUJE a je aktívna (migrácie 20260611100000_customers_foundation, 20260611100100_customers_email_backfill, 20260614000000_rc5_rental_customer_identity). customer_id FK je na leads, project_notes, rental_websites, hosting_records, commissions + rental_websites.customer_email backfill. Identity bridge cez email/name ostáva ako fallback pre záznamy bez customer_id (src/lib/customerWorkbench/loadCustomerWorkbench.ts).

## FINANCE TRUTH LEVELS (NIKDY neignorovať)

fact = potvrdená platba (záväzné číslo, zobraz zeleno)
legacy_import = historický import (nie 100% overený, zobraz žlto)
workflow_only = pracovný záznam, nepotvrdený (zobraz šedo)

VŽDY zobrazuj truth level badge pri každom finančnom zázname.

## GOLDEN PATH (klientský journey)

Lead → Klient (customer/:key) → Rental website → payment_records → cost_records → commissions → payout_records

## UI/UX PRAVIDLÁ (vždy dodržiavať)

- KPI karty vždy above the fold
- Farby: zelená=#22c55e (potvrdené), oranžová=#f97316 (čakajúce), červená=#ef4444 (problém), sivá=#6b7280 (neaktívne)
- Max 2-3 kliky na akúkoľvek akciu
- Každá tabuľka: search + filter + sort + pagination
- Customer hub = jedna stránka, kompletný obraz klienta

## HARD CONSTRAINTS (nikdy neporušiť)

- NIKDY neupravuj deploynuté migrácie
- NIKDY necommituj .env (git rm --cached .env ak je trackovaný)
- NIKDY retroaktívne prepočítavaj payouty bez súhlasu
- NIKDY nemaž legacy_import záznamy
- NIKDY nemeň commission split v implementers JSON bez migrácie
- VŽDY Plan Mode pred zmenou v 3+ súboroch

## POST-RELEASE BACKLOG (neriešiť teraz)

- Customer identity: doplniť customer_id FK pre zostávajúce heuristicky-mapované záznamy (full FK rollout existuje, postupný backfill pokračuje)
- Commission rules enforcement
- ESLint cleanup
- GitHub Actions CI
- Remove /admin/debug v produkcii
- Hosting billing automation

## SESSION WORKFLOW

Začiatok: "Prečítaj CLAUDE.md. Stav + čo ďalej?"
Po zmene: npm run build → npm run lint → git commit
Koniec: aktualizuj CLAUDE.md ak sa niečo zmenilo
