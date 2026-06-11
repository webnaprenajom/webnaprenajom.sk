-- Batch F2.5: communication_events idempotency for entity-scoped events

CREATE UNIQUE INDEX communication_events_idempotency_key_unique
  ON public.communication_events ((metadata->>'idempotency_key'))
  WHERE (metadata->>'idempotency_key') IS NOT NULL;

COMMENT ON INDEX public.communication_events_idempotency_key_unique IS
  'Prevents duplicate entity action logs on save retries (F2.5)';
