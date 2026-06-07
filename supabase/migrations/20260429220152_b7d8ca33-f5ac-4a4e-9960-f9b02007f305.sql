
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

UPDATE public.leads SET status_changed_at = COALESCE(updated_at, created_at) WHERE status_changed_at IS NULL;

CREATE OR REPLACE FUNCTION public.update_lead_status_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_changed_at := COALESCE(NEW.status_changed_at, now());
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_status_changed_at ON public.leads;
CREATE TRIGGER trg_leads_status_changed_at
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_status_changed_at();
