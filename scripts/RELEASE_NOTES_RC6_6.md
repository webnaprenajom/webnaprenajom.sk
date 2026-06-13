# Release Notes — Batch RC6.6

Security completion: centralized route guards, audit trail, write permission helpers, access review.

## Migration

- `20260616000000_rc66_audit_trail_governance.sql` — `admin_audit_log` table + RLS

## Routes hardened

- **All** `/admin/*` routes nest under `ProtectedAdminOutlet` in `App.tsx`
- Single check: `canAccessRoute(pathname, role)` from `routeAccess.ts`
- Removed redundant per-page `AdminOnlyGate` wrappers (Today, CommunicationOps, RolloutHealth, Debug)
- Added `/admin/commissions`, `/admin/settings` to admin-only prefix list

## Write permissions

- `src/lib/rbac/writePermissions.ts` — centralized mutation checks
- `EntityCommissionsPanel` — hide create/edit for non-admin; filter rows by scope
- `OperatingCostField` — read-only for non-admin
- `ImplementerCommissionDetailDialog` — payment toggle admin-only + audit
- **DB:** commission writes remain admin-only RLS (no change — users cannot bypass via API)

## Audit trail

- Table: `admin_audit_log`
- Helper: `logAdminAuditEvent()`
- Logged: role assign/remove, team profile assign/update, commission status changes, operating cost changes
- UI: Settings → Auditný denník (admin only)

## Access review

- Settings → Kontrola prístupov — users, roles, profile status, risk flags, last audit
- Confirm dialogs for role/profile changes with downstream effect copy

## Tests

- `rc66RouteGuards.test.ts`
- `rc66WritePermissions.test.ts`
- `rc66FinanceScope.test.ts`
- `crmUserDirectory.test.ts`

## User management UX (post-RC6.6)

- Migration `20260617000000_admin_auth_user_directory_rpc.sql` — admin-only `admin_list_auth_users()` RPC
- Human-readable user list (name + email); UUID hidden in collapsible technical row
- Search/filter in User Management + Access Review panels
- Add-user flow: select auth account from searchable list (no manual UUID paste)

## QA checklist

- [ ] Apply RC6.6 migration
- [ ] role=user deep-link to `/admin/rentals` → redirect Finance
- [ ] role=user deep-link to `/admin/settings` → redirect Finance
- [ ] Admin role change → audit log entry
- [ ] Team profile assign → audit log entry
- [ ] Commission paid toggle → audit log entry
- [ ] role=user cannot see commission edit buttons
- [ ] Access review shows missing profile warnings
- [ ] No regression: scoped finance KPIs hidden for user

## Unresolved risks (RC7)

- Server-side audit triggers (not only client insert)
- Commission write policy for limited user self-service (if ever required)
- Full audit coverage for rental JSON / hosting mutations
- Automated access review scheduling
