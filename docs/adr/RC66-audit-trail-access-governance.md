# ADR: Admin audit trail and route-level access (RC6.6)

## Status
Accepted — Batch RC6.6

## Context
RC6 introduced admin/user roles and scoped commission reads. RC6.5 added partial route guards and empty-state UX. Gaps remained:
- Not all `/admin/*` routes used a single guard (deep-link bypass risk)
- Privileged changes (roles, team profiles, commission status) had no append-only audit trail
- Write actions relied primarily on UI hiding; DB already blocked commission writes for non-admins

## Decision

### Route protection
- All CRM routes nest under `<ProtectedAdminOutlet />` in `App.tsx`
- Access rules centralized in `src/lib/rbac/routeAccess.ts` via `canAccessRoute(pathname, role)`
- role=user may access only `/admin/finance` (plus auth shell)

### Audit trail
- New table `admin_audit_log` (append-only, admin read, admin insert own actor)
- Client helper `logAdminAuditEvent()` — best-effort, never blocks primary action
- Tracked actions: role assign/remove, team profile assign/update, commission payment_status changes

### Write permissions
- UI helpers in `src/lib/rbac/writePermissions.ts` mirror DB intent
- Commission INSERT/UPDATE/DELETE remains **admin-only** at RLS (unchanged)
- role=user: SELECT own commissions only (RC6 RLS)

### Governance UI
- Settings → Kontrola prístupov (`AccessReviewPanel`)
- Settings → Auditný denník (`AuditLogPanel`)
- Confirm dialogs for role/profile changes (`ConfirmSensitiveActionDialog`)

## Consequences
- Deep links to admin modules redirect role=user to Finance
- Audit depends on client-side logging until server triggers exist (RC7 candidate)
- Some entity writes (rentals JSON, hosting records) still admin-only via RLS but not every action audited yet

## Frontend-only protection (explicit flags)
These remain UI-gated; RLS is source of truth where policies exist:
- Rental website implementer JSON edits (admin operational pages)
- Hosting/project record edits outside commission table
- Email account settings (own user row — intentional)
