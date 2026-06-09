# CRM Release — Go-Live Guide

Release stabilization for webnaprenajom.sk CRM (React + Vite + Supabase).  
**Not a feature doc** — use this before GitHub push, Lovable sync, and production use.

---

## Go-live quick checklist

Run as **admin**, after env + migrations are deployed.

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

### What improved

- Unified **AdminShell** across admin pages
- **Customer detail** hub with cross-module links
- **Finance foundation** (Phases 2A–2G):
  - Canonical `payment_records`, `payout_records`, `cost_records`
  - Truth levels: fact vs legacy import vs workflow-only
  - Reconciliation + guided fact confirmation
  - Settlement drafts + batch payouts
  - Commission rules (advisory preview)
  - Hosting records + opt-in payment facts
  - Governance queue with periodic review / due dates
  - Customer identity bridge (compatibility layer, not full entity)
- Honest labels in Rentals/Commissions (workflow vs confirmed)

### Still legacy / manual / foundation-only

- Customer identity fragmented (email/name — no full customers table)
- Commission rules are **preview/advisory** — rental split still in `implementers` JSON
- No automation engine, webhooks rules, or retroactive payout recalc
- Finance tables require migrations on Supabase before full functionality
- `/admin/debug` is dev/diagnostic — not end-user feature

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

- Full customer entity / canonical identity engine
- Commission rules enforcement (beyond preview)
- Implementers JSON ↔ overrides sync workflow
- ESLint cleanup (`no-explicit-any` across legacy pages)
- Code-splitting for bundle size
- GitHub Actions CI (lint + build on PR)
- Remove or gate `/admin/debug` in production
- Hosting billing automation
- Finance snapshot includes hosting payment facts in ledger rollup

---

## 8. Go-live verdict template

After smoke test, mark one:

- **READY** — build OK, migrations applied, smoke tests pass
- **READY WITH KNOWN LIMITATIONS** — usable daily; backlog items documented
- **NOT READY** — migrations missing, auth broken, or finance crashes on load

**Current engineering status:** GO LIVE AFTER 3 STEPS  
(build/tests pass; `.env` still tracked; migrations + smoke test pending operator)
