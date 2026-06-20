-- Phase 1: Legacy CRM CSV staging (additive, non-destructive)

CREATE TABLE IF NOT EXISTS public.legacy_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_key TEXT NOT NULL UNIQUE,
  source_env TEXT,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'dry_run')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.legacy_import_batches IS
  'Tracks legacy CSV import batches (Phase 1 staging only).';

CREATE TABLE IF NOT EXISTS public.legacy_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.legacy_import_batches(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  row_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_file, legacy_id)
);

CREATE INDEX IF NOT EXISTS legacy_import_rows_batch_idx
  ON public.legacy_import_rows (batch_id);

CREATE INDEX IF NOT EXISTS legacy_import_rows_source_idx
  ON public.legacy_import_rows (source_file);

COMMENT ON TABLE public.legacy_import_rows IS
  'Idempotent staging store for legacy CSV rows (payload + hash).';

CREATE TABLE IF NOT EXISTS public.legacy_id_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.legacy_import_batches(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  canonical_id UUID,
  match_method TEXT,
  confidence TEXT
    CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, legacy_id)
);

CREATE INDEX IF NOT EXISTS legacy_id_map_canonical_idx
  ON public.legacy_id_map (entity_type, canonical_id)
  WHERE canonical_id IS NOT NULL;

COMMENT ON TABLE public.legacy_id_map IS
  'Legacy ID to canonical ID map (populated in promote phase; schema ready in Phase 1).';

CREATE TABLE IF NOT EXISTS public.migration_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.legacy_import_batches(id) ON DELETE SET NULL,
  source_file TEXT,
  entity_type TEXT NOT NULL,
  legacy_id TEXT,
  reason TEXT NOT NULL,
  detail TEXT,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS migration_review_queue_status_idx
  ON public.migration_review_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS migration_review_queue_batch_idx
  ON public.migration_review_queue (batch_id);

COMMENT ON TABLE public.migration_review_queue IS
  'Manual review queue for ambiguous/conflicting legacy import rows.';

CREATE TABLE IF NOT EXISTS public.legacy_finance_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.legacy_import_batches(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  row_hash TEXT NOT NULL,
  linked_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  linked_rental_id UUID,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'matched', 'ignored', 'manual')),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_file, legacy_id)
);

CREATE INDEX IF NOT EXISTS legacy_finance_staging_batch_idx
  ON public.legacy_finance_staging (batch_id);

COMMENT ON TABLE public.legacy_finance_staging IS
  'Legacy finance CSV rows — not canonical payment/payout truth (Phase 1 staging only).';

CREATE TRIGGER trg_legacy_import_rows_updated
  BEFORE UPDATE ON public.legacy_import_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_legacy_id_map_updated
  BEFORE UPDATE ON public.legacy_id_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_legacy_finance_staging_updated
  BEFORE UPDATE ON public.legacy_finance_staging
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.legacy_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_finance_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage legacy_import_batches"
  ON public.legacy_import_batches FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage legacy_import_rows"
  ON public.legacy_import_rows FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage legacy_id_map"
  ON public.legacy_id_map FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage migration_review_queue"
  ON public.migration_review_queue FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage legacy_finance_staging"
  ON public.legacy_finance_staging FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
