-- Project commission % mode + paid payout detail enforcement (project/hosting/marketing)

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS amount_mode TEXT NOT NULL DEFAULT 'fixed'
    CHECK (amount_mode IN ('fixed', 'percent')),
  ADD COLUMN IF NOT EXISTS rate_percent NUMERIC
    CHECK (rate_percent IS NULL OR (rate_percent >= 0 AND rate_percent <= 100));

ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_amount_mode_rate_check;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_amount_mode_rate_check
  CHECK (
    (amount_mode = 'fixed' AND rate_percent IS NULL)
    OR (
      amount_mode = 'percent'
      AND rate_percent IS NOT NULL
      AND source_type = 'project'
    )
  );

CREATE OR REPLACE FUNCTION public.commissions_enforce_paid_payout_details()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND NEW.source_type IN ('project', 'hosting', 'marketing') THEN
    IF COALESCE(TRIM(NEW.payment_form), '') = '' THEN
      RAISE EXCEPTION 'paid_commission_requires_payment_form'
        USING HINT = 'Pred uložením stavu „vyplatené“ vyplňte formu úhrady.';
    END IF;
    IF COALESCE(TRIM(NEW.note), '') = '' THEN
      RAISE EXCEPTION 'paid_commission_requires_note'
        USING HINT = 'Pred uložením stavu „vyplatené“ vyplňte poznámku k výplate.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commissions_enforce_paid_payout_details ON public.commissions;

CREATE TRIGGER commissions_enforce_paid_payout_details
  BEFORE INSERT OR UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.commissions_enforce_paid_payout_details();
