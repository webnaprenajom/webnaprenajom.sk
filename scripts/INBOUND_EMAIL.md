# Inbound email ingestion (Batch G / G.5)

## Overview

Inbound customer replies are captured via **Resend** `email.received` webhooks and stored as `communication_events` with `kind=email_in`.

Endpoint (after deploy):

```
POST https://<project-ref>.supabase.co/functions/v1/inbound-email-webhook
```

`verify_jwt = false` — authentication is **Svix signature verification** only.

## Required secrets (Supabase Edge Function secrets)

| Secret | Purpose |
|--------|---------|
| `RESEND_WEBHOOK_SECRET` | Svix signing secret from Resend webhook (`whsec_…`) |
| `RESEND_API_KEY` | Fetch email body via Receiving API (webhook is metadata-only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Insert into `communication_events` (server-only) |

Never expose `RESEND_WEBHOOK_SECRET` or service role key in the browser or client logs.

## Resend setup

1. Enable **Receiving** on your domain in Resend dashboard.
2. Add webhook:
   - URL: `https://<project-ref>.supabase.co/functions/v1/inbound-email-webhook`
   - Event: `email.received`
3. Copy **signing secret** → `RESEND_WEBHOOK_SECRET` in Supabase secrets.
4. Deploy function: `supabase functions deploy inbound-email-webhook`

## Webhook behavior

1. Read **raw** request body (`req.text()`).
2. Verify `svix-id`, `svix-timestamp`, `svix-signature` with `RESEND_WEBHOOK_SECRET`.
3. Ignore non-`email.received` events (200 OK).
4. `GET /emails/receiving/{email_id}` for text/html preview (not stored in full).
5. Resolve customer by **sender_email** → `customers.email`, fallback `customer_email = sender`.
6. Optional link: newest matching `leads` row → `source_table=leads`.
7. Derive `thread_id` (see **Thread resolution order** below).
8. Insert `kind=email_in` with threading columns + sanitized preview.

## Idempotency & replay

Unique index on `metadata.provider_email_id` when `kind=email_in`.

| Scenario | Behavior |
|----------|----------|
| Resend retries same `email_id` | Duplicate suppressed (`23505`); incident `deduped_inbound` logged |
| Invalid signature replay | **401**, incident `verify_failed`, no DB row |
| Receiving API down | **200** + error JSON, incident `fetch_failed` — avoids infinite retry loop |
| Manual replay from Resend dashboard | Safe: same `email_id` dedupes |

Event IDs are never reused or overwritten on replay.

## Thread resolution order (G.5)

Exact matching order in `resolveThreadIdFromExisting()` (`supabase/functions/_shared/inboundEmail.ts`):

1. **In-Reply-To** → lookup `communication_events.message_id` → inherit `thread_id`
2. **References** header ids (each id, in order) → same lookup
3. Candidate ids → outbound `thread_id = resend:{id}` or `metadata.resend_id` on `email_out`
4. **Normalized subject + sender_email** → recent `email_out`/`email_in` to same address (`metadata.normalized_subject`)
5. **New root**: inbound `message_id`, else `subject:{normalized}:{email}` key

Outbound emails (edge functions via `_shared/communicationEvents.ts`) set:

- `thread_id`: `resend:{resend_id}` when available, else subject key
- `metadata.normalized_subject` for subject fallback linkage
- `sender_email` / `recipient_email` for address-based matching

Resend sent API does **not** expose RFC Message-ID — outbound linkage relies on `resend_id` + normalized subject.

## Operational monitoring (G.5)

### Database

Table `communication_webhook_incidents` — safe summaries only (no raw payloads):

| `incident_type` | Meaning |
|-----------------|---------|
| `verify_failed` | Svix signature rejected |
| `fetch_failed` | Resend Receiving API error |
| `malformed` | Missing required webhook fields |
| `insert_failed` | `communication_events` insert error |
| `deduped_inbound` | Duplicate provider_email_id suppressed |

### Admin UI

`/admin/communication-ops` — counts, incident feed, unlinked inbound list, manual reconcile.

### Logs (Edge Function)

Structured `console.info` / `console.warn` / `console.error` with:

- `email_id`, `sender`, `customer_id`, `thread_match`, `deduped`

Never logged: raw body, `RESEND_API_KEY`, webhook secret, full HTML/text body.

## Customer resolution fallback

If no `customers` row: event stored with `customer_email = sender_email`, `customer_id = null`.

Visible on legacy `/admin/customer/:email` route via `sender_email` OR `customer_email` query.

## Reconciliation workflow (G.5)

When a sender is later matched to a canonical customer:

1. Open **Komunikácia** ops (`/admin/communication-ops`).
2. Select unlinked inbound events (or use “Všetky pre email”).
3. Pick customer via ClientPicker → **Prepojiť vybrané**.
4. Updates only `customer_id` + `customer_email` — **event UUID preserved**.

Programmatic helpers: `src/lib/communication/reconcile.ts`.

## Admin timeline filters (G.5)

Customer 360° timeline supports filters: všetko, prichádzajúce, odchádzajúce, neprepojené, vo vlákne.

Badges: inbound/outbound kind, “Neprepojené”, “Vlákno”.

## Security notes

- Invalid signature → **401** (no processing).
- Malformed payload → **400** with minimal log (no body content).
- Failed Receiving API fetch → **200** with error JSON (avoid infinite retries).
- RLS: admin-only read/write for incidents and communication events.

## Limitations before mailbox sync

- No IMAP/mailbox sync or bidirectional folder state
- No full message body storage (preview only, max ~240 chars)
- Threading depends on headers Resend exposes + outbound `resend_id`
- Subject-only threads can false-positive on generic subjects
- Unmatched senders require manual reconcile until customer exists
- Provider lock-in: Resend Receiving API + Svix verification
- Fetch failures return 200 — event may be missing until manual replay

## QA smoke test

1. Send outbound reminder to test lead email.
2. Reply from that inbox to your receiving address.
3. Confirm row in `communication_events` (`kind=email_in`, `thread_match` populated).
4. Open customer 360° — inbound badge, subject, Od/Komu, preview, thread label.
5. Replay webhook in Resend — no duplicate row; incident `deduped_inbound` if ops page open.
6. Open `/admin/communication-ops` — stats and zero unlinked if customer matched.
