# Communication events — logging contract (Batch F2 / F2.5)

## Purpose

`communication_events` is the persistent customer-history layer. Writes are **best-effort**: primary business actions (email send, CRM save) must never fail because logging failed.

## Who writes

| Writer | Auth | Notes |
|--------|------|-------|
| Edge functions (`send-*-email`) | **Service role** (server-only) | After successful Resend response |
| CRM app (`insertCommunicationEvent`) | Admin JWT via RLS | Notes, entity saves |

Service role keys must **never** ship to the browser. Edge functions create their own service-role client inside Deno only.

## Idempotency

### Outbound email (`kind = email_out`)

- Unique partial index on `metadata->>'resend_id'` when present.
- **Retry behavior:** If the same Resend message id is logged again, Postgres returns `23505`; helpers return `{ ok: true, deduped: true }` and log `[communication_events] deduped resend_id`.
- **Safe retry:** Re-invoking an edge function after a successful send but failed HTTP response to the client may produce a *new* Resend id → second row (acceptable; rare).

### Entity actions (project, commission, rental, hosting)

- Unique partial index on `metadata->>'idempotency_key'` when present.
- Key format: `{source_table}:{source_id}:{action}` e.g. `project_notes:uuid:created`, `commissions:uuid:paid`.
- **Retry behavior:** Duplicate save/toggle with same key → silent dedupe (`console.info` in app, `console.warn` on unexpected failures only).

### Coverage (F2.5)

| Flow | kind | idempotency_key |
|------|------|-----------------|
| Project create | project_event | `project_notes:{id}:created` |
| Project status change | project_event | `project_notes:{id}:status:{status}` |
| Commission create | commission | `commissions:{id}:created` |
| Commission mark paid | payment | `commissions:{id}:paid` |
| Rental create | rental_event | `rental_websites:{id}:created` |
| Hosting create | hosting_event | `hosting_records:{id}:created` |

### Inbound email (`kind = email_in`) — Batch G

- Unique partial index on `metadata->>'provider_email_id'` (Resend received `email_id`).
- See `scripts/INBOUND_EMAIL.md` for webhook setup.

| Writer | Auth |
|--------|------|
| `inbound-email-webhook` edge function | Svix signature + service role |

### Manual notes (`kind = note`)

- No idempotency key — each note is intentional.

## Edge functions audited (F2.5)

| Function | `resend_id` | `lead_id` source | Dedupe |
|----------|-------------|------------------|--------|
| send-reminder-email | yes | optional body | yes |
| send-instructions-email | yes | optional body | yes |
| send-order-email | yes | optional body | yes |
| send-offer-email | yes per recipient | no (bulk) | yes |
| send-wheel-reminder | yes | n/a | yes |

Not logged: `send-lead-email` (internal inbox only).

## Timeline dedupe (client)

1. **Source overlap:** `communication_events` with `source_table+source_id` hides matching legacy project/rental/commission rows.
2. **Email + status:** When `email_out` exists for `leads:{id}`, hide lead_log status change to an email-triggering status (`send_offer`, `reminder`, `send_instructions`, `order`) for that lead — the email row is the canonical comm record; status change remains in lead detail/logs module.

## Remaining limitations

- No historical backfill of pre-F2 sends or pre-G inbound mail
- Bulk offer emails lack `lead_id` linkage unless payload extended
- Inbound/outbound thread linking depends on RFC Message-ID headers (outbound rows do not yet store sent Message-ID)
