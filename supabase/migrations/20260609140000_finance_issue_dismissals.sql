-- Phase 2E: reconciliation issue dismissals (metadata only, no source mutation)

CREATE TABLE public.finance_issue_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_key TEXT NOT NULL UNIQUE,
  issue_type TEXT NOT NULL,
  dismissal_type TEXT NOT NULL DEFAULT 'dismissed'
    CHECK (dismissal_type IN ('dismissed', 'false_positive')),
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX finance_issue_dismissals_type_idx ON public.finance_issue_dismissals (issue_type);
CREATE INDEX finance_issue_dismissals_created_at_idx ON public.finance_issue_dismissals (created_at DESC);

ALTER TABLE public.finance_issue_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view finance_issue_dismissals" ON public.finance_issue_dismissals
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert finance_issue_dismissals" ON public.finance_issue_dismissals
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete finance_issue_dismissals" ON public.finance_issue_dismissals
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
