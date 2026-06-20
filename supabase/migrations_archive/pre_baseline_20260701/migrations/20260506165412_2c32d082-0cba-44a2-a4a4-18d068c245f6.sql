
-- Extend wheel_spins
ALTER TABLE public.wheel_spins
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redeemed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;

-- Trigger: when a notification is created, log it into lead_logs
CREATE OR REPLACE FUNCTION public.log_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email TEXT;
  actor_id UUID;
  lead_email_val TEXT;
  lead_name_val TEXT;
  lead_id_val UUID;
BEGIN
  actor_id := auth.uid();
  BEGIN
    SELECT email INTO actor_email FROM auth.users WHERE id = actor_id;
  EXCEPTION WHEN OTHERS THEN
    actor_email := NULL;
  END;

  lead_email_val := COALESCE(NEW.metadata->>'email', NULL);
  lead_name_val  := COALESCE(NEW.metadata->>'name', NULL);
  BEGIN
    lead_id_val := NULLIF(NEW.metadata->>'lead_id','')::UUID;
  EXCEPTION WHEN OTHERS THEN
    lead_id_val := NULL;
  END;

  INSERT INTO public.lead_logs (
    lead_id, lead_name, lead_email, action, field, new_value, changed_by_email, changed_by_id
  ) VALUES (
    lead_id_val,
    lead_name_val,
    lead_email_val,
    'notification',
    NEW.type,
    NEW.title || COALESCE(' · ' || NEW.message, ''),
    actor_email,
    actor_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_notification_insert ON public.notifications;
CREATE TRIGGER trg_log_notification_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.log_notification_insert();

-- Allow admins to insert wheel spin records (edit/manage from CRM)
DROP POLICY IF EXISTS "Admins can insert spins" ON public.wheel_spins;
CREATE POLICY "Admins can insert spins"
ON public.wheel_spins FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
