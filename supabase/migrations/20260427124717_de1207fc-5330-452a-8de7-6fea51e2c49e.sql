-- Add assigned_to column to leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Create lead_logs table for change history
CREATE TABLE IF NOT EXISTS public.lead_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID,
  lead_name TEXT,
  lead_email TEXT,
  action TEXT NOT NULL, -- 'created' | 'updated' | 'deleted'
  field TEXT,           -- which field changed (for 'updated')
  old_value TEXT,
  new_value TEXT,
  changed_by_email TEXT,
  changed_by_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all lead logs"
  ON public.lead_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert lead logs"
  ON public.lead_logs FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_lead_logs_created_at ON public.lead_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_logs_lead_id ON public.lead_logs (lead_id);

-- Trigger function: log changes on leads
CREATE OR REPLACE FUNCTION public.log_lead_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email TEXT;
  actor_id UUID;
BEGIN
  actor_id := auth.uid();
  BEGIN
    SELECT email INTO actor_email FROM auth.users WHERE id = actor_id;
  EXCEPTION WHEN OTHERS THEN
    actor_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, changed_by_email, changed_by_id)
    VALUES (NEW.id, NEW.name, NEW.email, 'created', actor_email, actor_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'status', OLD.status, NEW.status, actor_email, actor_id);
    END IF;
    IF NEW.type IS DISTINCT FROM OLD.type THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'type', OLD.type, NEW.type, actor_email, actor_id);
    END IF;
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'assigned_to', OLD.assigned_to, NEW.assigned_to, actor_email, actor_id);
    END IF;
    IF NEW.temperature IS DISTINCT FROM OLD.temperature THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'temperature', OLD.temperature, NEW.temperature, actor_email, actor_id);
    END IF;
    IF NEW.source IS DISTINCT FROM OLD.source THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'source', OLD.source, NEW.source, actor_email, actor_id);
    END IF;
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'name', OLD.name, NEW.name, actor_email, actor_id);
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'email', OLD.email, NEW.email, actor_email, actor_id);
    END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'phone', OLD.phone, NEW.phone, actor_email, actor_id);
    END IF;
    IF COALESCE(NEW.notes,'') IS DISTINCT FROM COALESCE(OLD.notes,'') THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'notes', OLD.notes, NEW.notes, actor_email, actor_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, changed_by_email, changed_by_id)
    VALUES (OLD.id, OLD.name, OLD.email, 'deleted', actor_email, actor_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_changes ON public.leads;
CREATE TRIGGER trg_log_lead_changes
AFTER INSERT OR UPDATE OR DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_changes();