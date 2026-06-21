-- Allow multiple payout_records per commission (partial payouts over time).
-- ponytail: drops 1:1 source unique index; lookup index replaces it for joins.

DROP INDEX IF EXISTS public.payout_records_source_uidx;

CREATE INDEX IF NOT EXISTS payout_records_source_lookup_idx
  ON public.payout_records (source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;
