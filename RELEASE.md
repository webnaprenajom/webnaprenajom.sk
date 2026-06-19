# CRM Release — Go-Live Guide

Release stabilization for webnaprenajom.sk CRM (React + Vite + Supabase).  
**Not a feature doc** — use this before GitHub push, Lovable sync, and production use.

---

## Go-live quick checklist

Run as **owner** (full CRM) or **administrator** (scoped), after env + migrations are deployed.

| Group | Check |
|-------|-------|
| **Auth** | Sign in at `/auth` → reach `/admin` → sign out |
| **CRM core** | Leads, customer detail, tasks, notes, rentals, commissions, wheel-leads load |
| **Finance core** | `/admin/finance` overview + records + reconciliation (no crash) |
| **Governance** | Review queue, rules, hosting tabs open; one opt-in fact dialog tested |
| **Exports** | Finance CSV + payroll CSV download |
| **Sign-out** | Session cleared, `/admin` blocked when logged out |

Optional: batch payout review, hosting → payment fact, rental/commission paid toggles.

---

## Before push (operator)

1. **Untrack `.env`** — it is currently in git index; `.gitignore` alone is not enough:
   ```sh
   git rm --cached .env
   ```
2. Commit `.env.example`, `RELEASE.md`, finance migrations, and CRM changes — **not** `.env`.
3. Confirm no secrets in tracked files (service role, Resend, Lovable keys stay in Supabase/Lovable only).

## Before first production use (operator)

1. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` in Lovable (or local `.env`).
2. Deploy all **5 finance migrations** in order (see §2 below).
3. Set Supabase Edge Function secrets (`RESEND_API_KEY`, etc.) if public forms/email are used.
4. Run the go-live quick checklist above once.
5. Pause feature development — use CRM daily; backlog items are post-release.

---

## Quick start

```sh
npm ci
cp .env.example .env   # fill Supabase values
npm run dev            # http://localhost:5173
npm run build          # production check
```

---

## 1. Environment variables

### Frontend (required — Vite, client-side)

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable / anon key (safe in browser with RLS) |

Set in:
- Local: `.env` (gitignored)
- Lovable: Project → Settings → Environment variables
- GitHub: Repository secrets (only if CI builds the app; no workflow exists today)

### Supabase Edge Functions (server-side — Supabase dashboard / CLI)

| Variable | Used by |
|----------|---------|
| `SUPABASE_URL` | All functions |
| `SUPABASE_ANON_KEY` | Auth-gated functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin writes, wheel, signatures |
| `RESEND_API_KEY` | Email functions (lead, offer, order, reminders) |
| `LOVABLE_API_KEY` | AI calculator, recommend, auth-email-hook |

**Never commit** service role keys, Resend keys, or Lovable API keys.

### Pre-push security check

If `.env` was ever committed to git:

```sh
git rm --cached .env
git commit -m "Stop tracking .env"
```

Then rotate Supabase keys if service role was exposed (publishable key rotation optional).

---

## 2. Database migrations

### Finance Phase 2 migrations (apply in order on target Supabase)

Run **after** all existing CRM migrations are applied. All are **additive** (no destructive drops).

| Order | File | Purpose |
|-------|------|---------|
| 1 | `20260609120000_finance_payment_payout_records.sql` | `payment_records`, `payout_records` + legacy backfill |
| 2 | `20260609130000_finance_cost_records.sql` | `cost_records` + expense backfill |
| 3 | `20260609140000_finance_issue_dismissals.sql` | `finance_issue_dismissals` |
| 4 | `20260609150000_finance_rules_hosting_governance.sql` | Rules, hosting, review items, policy settings |
| 5 | `20260609160000_finance_review_cadence.sql` | Review due dates / snooze columns |

### How to deploy

**Option A — Supabase CLI (recommended)**

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Option B — Supabase Dashboard**

SQL Editor → run each migration file in timestamp order.

### Dependencies

- Finance migrations reference `rental_websites`, `commissions`, `rental_payments`, `expenses` (must exist).
- `20260609160000` alters `finance_review_items` (must exist from step 4).

### Rollback (high level)

- No automated down migrations.
- Rollback = restore DB snapshot taken before deploy, or manually drop new tables if empty.
- **Do not** drop tables if production facts were created — data loss.

### Admin bootstrap (fresh Supabase project)

Migration `20260610031204_*` is a **legacy one-off ops seed** (hardcoded `auth.users` UUID + password reset). It has **no schema changes** but **fails on empty projects** (FK to missing auth user).

**Do not edit that migration file** (CLAUDE.md hard constraint). On a **fresh** Supabase project:

1. Run migrations until it fails (expected at `20260610031204`):

```sh
npx supabase db push
```

2. Mark the legacy ops migration as applied **without re-running** (skip seed on fresh DB):

```sh
npx supabase migration repair --status applied 20260610031204
```

3. Continue remaining migrations:

```sh
npx supabase db push
```

4. **Authentication → Users → Add user** (email + password).

5. **SQL Editor** (after RBAC migrations applied `owner` role exists):

```sql
SELECT public.grant_crm_owner_by_email('your@email.com');
```

Expected: `{"ok": true, "role": "owner", ...}`

6. Sign in at `/auth` → `/admin`.

For **administrator** (scoped team member):

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'administrator'::public.app_role
FROM auth.users WHERE lower(email) = lower('team@example.com')
ON CONFLICT (user_id, role) DO NOTHING;
```

Set `team_profiles.implementer_name` when commissions/rentals scoping is needed.

**Production / already-deployed DB:** if `20260610031204` is already in migration history, **do not** run repair — bootstrap is only for fresh setup.

---

## 3. Build & run

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve built app locally |
| `npm run lint` | ESLint (known legacy `any` warnings — not build-blocking) |
| `npm test` | Vitest (minimal smoke test) |

Lovable deploy: Share → Publish (uses Lovable env vars).

---

## 4. Detailed smoke test (optional)

Use if the quick checklist fails or you need module-by-module verification.

**Auth:** `/auth`, non-admin blocked, `/admin` dashboard, sign-out  
**CRM:** leads, customer detail, tasks, notes, rentals, commissions, wheel-leads, logs, signatures, designs  
**Finance:** all tabs at `/admin/finance`; opt-in facts from Rentals/Commissions/Hosting; batch payout; CSV exports  
**Public:** homepage, lead form (needs Resend)

---

## 5. Release notes (summary)

### What improved (current — beyond initial finance foundation)

- Unified **AdminShell** across admin pages
- **Customer Hub** (`/admin/customer/:key`) — executive cockpit, cross-module links, **full finance snapshot** (payments/costs/payouts, truth badges, profit summary, payment history)
- **Customer identity foundation** — `customers` table, `customer_id` FK on core tables, `rental_websites.customer_email`; identity bridge heuristics for legacy rows
- **Finance foundation** (Phases 2A–2G):
  - Canonical `payment_records`, `payout_records`, `cost_records`
  - Truth levels: fact vs legacy import vs workflow-only (`TruthLevelBadge` in daily + advanced views)
  - Reconciliation + guided fact confirmation
  - Settlement drafts + batch payouts
  - Commission rules (advisory preview)
  - Hosting records + opt-in payment facts
  - Governance queue with periodic review / due dates
- **Destructive delete** (Fáza 2c) — customer, hosting, rental with finance fact hard-block + impact modal
- **RBAC** — `owner` / `administrator` (legacy `admin`/`user` normalized in app)
- Honest labels in Rentals/Commissions (workflow vs confirmed payout)

### Still legacy / manual / backlog

- Commission rules are **preview/advisory** — rental split still in `implementers` JSON
- No automation engine, webhooks rules, or retroactive payout recalc
- `customer_id` backfill incomplete for some heuristic-mapped rows
- `/admin/debug` is dev/diagnostic — not end-user feature
- `EntityProfitBanner` not yet on Rentals list/detail (ROADMAP 5.2)
- Lead delete not yet on destructive-delete RPC path

### Post-deploy manual checks

1. All 5 finance migrations applied successfully
2. Finance tab loads without “migrations not deployed” toast
3. At least one opt-in fact flow tested end-to-end
4. Edge function secrets set in Supabase dashboard

---

## 6. GitHub readiness

- [ ] `.env` **not** tracked (`git rm --cached .env` if needed)
- [ ] `.env.example` committed as template
- [ ] `dist/` and `node_modules/` gitignored
- [ ] Commit includes: finance lib, AdminFinance, migrations, types update
- [ ] No GitHub Actions workflows in repo (no CI secrets risk today)
- [ ] Large assets (hero video) already in repo — expect slow clone

Suggested commit message:

```
feat(crm): finance foundation + admin shell stabilization

- Add canonical finance records, reconciliation, settlement, governance
- Unify admin pages under AdminShell
- Add Supabase migrations 20260609120000–20260609160000
- Release docs and env template
```

---

## 7. Post-release backlog (do not block go-live)

- `customer_id` backfill for remaining heuristic-mapped rows (table + FK exist)
- Commission rules enforcement (beyond preview)
- Implementers JSON ↔ overrides sync workflow
- Shared admin data loaders (reduce inline `supabase.from` in pages)
- ESLint cleanup (`no-explicit-any` across legacy pages)
- Code-splitting for bundle size
- GitHub Actions CI (lint + build on PR)
- Remove or gate `/admin/debug` in production
- Hosting billing automation
- Finance snapshot includes hosting payment facts in ledger rollup
- Lead delete via destructive-delete RPC (optional)
- Scoped KPI for administrator role (ROADMAP 3.2)

---

## 8. Go-live verdict template

After smoke test, mark one:

- **READY** — build OK, migrations applied, smoke tests pass
- **READY WITH KNOWN LIMITATIONS** — usable daily; backlog items documented
- **NOT READY** — migrations missing, auth broken, or finance crashes on load

**Current engineering status:** READY WITH KNOWN LIMITATIONS  
(build/tests pass locally; operator must confirm migrations deployed + smoke test on target Supabase; verify `.env` not tracked)
