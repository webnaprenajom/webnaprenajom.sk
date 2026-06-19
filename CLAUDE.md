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
Customer identity: tabuľka `customers` EXISTUJE a je aktívna (migrácie 20260611100000_customers_foundation, 20260611100100_customers_email_backfill, 20260614000000_rc5_rental_customer_identity). customer_id FK je na leads, project_notes, rental_websites, hosting_records, commissions + rental_websites.customer_email backfill. Identity bridge cez email/name ostáva ako fallback pre záznamy bez customer_id. Loader: `loadCustomerHubAggregate` (Fáza 2b) vracia `CustomerHubAggregate` so sekčnými error stavmi cez `sectionFetch` — nikdy tichý `[]` bez `error`.

Destructive delete (Fáza 2c + L1/L2 lead): Mazania **klientov, hostingu, prenájmov a leadov** idú cez `useDestructiveAction` → RPC precheck → `ConfirmDestructiveActionModal` → RPC execute. **Hard block** ak existujú `payment_fact` / `cost_fact` / `payout_fact` (customer/hosting/rental). Lead delete: hard delete pipeline záznamu; klient a finance fakty zostávajú; bulk skipne leady s `is_risky` (prepojený klient má finance fakty). Canonical client: `src/lib/leads/destructive.ts`. **Nikdy** `supabase.from("leads").delete()` v UI.

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

### Dialógy (AdminDialog)

- Všetky admin modály idú cez `AdminDialog` (`src/components/admin/AdminDialog.tsx`), nikdy raw `Dialog`.
- Size tiers: `sm` (max-w-md) jednoduché quick-create formuláre · `md` (default, max-w-lg) krátke formuláre · `lg` (max-w-2xl) bežné edit formuláre · `xl` (max-w-4xl) detail modály s viac sekciami (napr. lead detail) · `2xl` (max-w-5xl) modály s tabuľkami/prehľadmi (napr. implementer/realizátor provízie).
- Žiadny horizontálny scroll na desktope v primárnych edit/detail modáloch — ak obsah preteká, zväčši size tier, nepridávaj `overflow-x-auto` na celý modál (výnimka: vnútorné tabuľky s veľa kolónami môžu mať vlastný `overflow-x-auto` wrapper).
- Dlhé formuláre používajú `stickyFooter` (akčné tlačidlá vždy viditeľné).

### Unsaved-changes guard

- Každý editovateľný dialóg (formulár so save/cancel) MUSÍ použiť `useUnsavedChangesGuard` (`src/hooks/useUnsavedChangesGuard.ts`).
- Pattern: `const xGuard = useUnsavedChangesGuard({ isOpen, current: form })` → `requestCloseXDialog = () => { if (!xGuard.confirmDiscard()) return; setOpen(false); }` → wire do `onOpenChange` (cancel/ESC/overlay) aj do tlačidla "Zrušiť".
- Save-success cesty zatvárajú dialóg priamo (`setOpen(false)`), bez guardu — guard chráni len cancel/close cesty.
- Read-only dialógy (bez formulárového stavu) guard nepotrebujú.

### Row-list štandard

- Zoznamy entít (projekty, heslá, hosting, klienti...) používajú table/row pattern (`Table`/`TableHeader`/`TableBody`/`TableRow` v `rounded-xl border overflow-x-auto` wrapperi), nie card-grid.
- Akcie (edit/delete/detail linky) v poslednom `TableCell`, badge-y pre stav.

### Cross-module konzistencia

- Pri zmene vzoru (dialóg, tabuľka, guard) aplikuj rovnaký vzor na všetky analogické moduly v jednom changesete — nie postupne medzi sessions.

## HARD CONSTRAINTS (nikdy neporušiť)

- NIKDY neupravuj deploynuté migrácie
- NIKDY necommituj .env (git rm --cached .env ak je trackovaný)
- NIKDY retroaktívne prepočítavaj payouty bez súhlasu
- NIKDY nemaž legacy_import záznamy
- NIKDY nemeň commission split v implementers JSON bez migrácie
- VŽDY Plan Mode pred zmenou v 3+ súboroch
- Governance: pozri **GOVERNANCE.md** (ownership, canonical moduly, inline-query pravidlá)
- Plan Mode session: `VITE_PLAN_MODE=1` v `.env.local`; registry v `src/lib/governance/planMode.ts`
- CRM edit modaly: preferuj **`useAdminCloseGuard`** (wrapuje `useUnsavedChangesGuard` + route blocker + UnsavedChangesAlertDialog)

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
