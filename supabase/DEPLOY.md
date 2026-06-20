# Supabase deploy runbook — webnaprenajom.sk CRM

Source of truth: `supabase/migrations/` (~90 files, timestamps through `20260625200000`).

**Team migration:** see [docs/supabase-migration.md](../docs/supabase-migration.md).

| Project | Ref | Env file |
|---------|-----|----------|
| Personal (legacy) | `kusluytpsgdrbhvaxoho` | `.env.personal` |
| Team (target) | `qosxlmrrkyvobjigsynt` | `.env.team` |

## Quick deploy (linked project)

```powershell
cd d:\web-rent-wizard-759d8d0e
npx supabase link --project-ref <PROJECT_REF>   # once per machine
npx supabase migration list
npx supabase db push
npm run build
npm test
```

When `migration list` shows empty Local-only rows, `db push` applies them.

## Fresh Supabase project

1. `npx supabase db push` until failure at **`20260610031204`** (hardcoded auth user seed — expected on empty DB).
2. `npx supabase migration repair --status applied 20260610031204`
3. `npx supabase db push` (runs through `20260624200000`).
4. Auth → create user.
5. SQL Editor: `SELECT public.grant_crm_owner_by_email('you@example.com');`

Do **not** run repair on `20260610031204` if it is already applied on production.

## Known safe patterns (already used in this repo)

| Pattern | Example | Why |
|---------|---------|-----|
| Rename duplicate timestamp | `20260619000000_rbac_*` → `20260619000001_rbac_*` | Two files shared `19000000`; destructive RPC keeps `19000000`, RBAC renamed |
| `migration repair --status applied` | `20260610031204` | Skip non-schema ops seed on fresh DB |
| Additive enum | `18550000` + `19000001` both add `owner`/`administrator` | `IF NOT EXISTS` / DO blocks — idempotent |
| Additive RLS fix | `20260622100000_restore_private_has_role_rls_grant.sql` | Restores `authenticated` EXECUTE on `private.has_role` after RBAC migration revoked it |

## Overlaps (safe on replay — do not re-edit)

- **`app_role` owner/administrator:** `20260618550000` + `20260619000001` (both additive).
- **`admin_list_auth_users`:** `20260617000000` then replaced by `20260623100000` (`is_crm_owner` gate).
- **`commissions.source_type` CHECK:** column CHECK from `20260610130000` widened by `20260624100000` (DROP + ADD named constraint).

## Do not touch

- `20260610031204_*` — deployed ops seed; use repair on fresh only.
- Any migration already on remote per `migration list` — no content rewrites.

## Manual bootstrap (not in migrations)

```sql
-- Owner (after auth user exists + migrations through 21100000)
SELECT public.grant_crm_owner_by_email('owner@example.com');

-- Administrator (optional)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'administrator'::public.app_role FROM auth.users
WHERE lower(email) = lower('team@example.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- team_profiles row for commission scoping
```

## Verify after deploy

```sql
-- Marketing commission CHECK includes marketing/task
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.commissions'::regclass AND conname = 'commissions_source_type_check';

-- agreed_fee columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('project_notes','marketing_records')
  AND column_name = 'agreed_fee';

-- Owner RPC
SELECT public.is_crm_owner();  -- true when logged in as owner
```

## Regenerate types (optional, after schema change)

```powershell
npm run gen:types:personal   # legacy project
npm run gen:types:team       # team project
```

Generated types in repo may lag (`agreed_fee` not in types until regen) — app uses casts where needed; not a deploy blocker.
