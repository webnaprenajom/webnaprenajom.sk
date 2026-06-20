
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  metadata JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications(read) WHERE read = false;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Trigger: new lead -> notification
CREATE OR REPLACE FUNCTION public.notify_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (type, title, message, link, metadata)
  VALUES (
    'lead',
    'Nový lead: ' || COALESCE(NEW.name, 'neznámy'),
    COALESCE(NEW.email, '') || COALESCE(' · ' || NEW.source, ''),
    '/admin',
    jsonb_build_object(
      'lead_id', NEW.id,
      'email', NEW.email,
      'name', NEW.name,
      'source', NEW.source,
      'type', NEW.type
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_lead_created_notify
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_lead();

-- Allow service role / edge functions to insert wheel spins (already used via SERVICE_ROLE so RLS is bypassed,
-- but add an explicit anon-block-insert policy for completeness — service role bypasses RLS regardless)
-- No anon insert policy on wheel_spins; edge function uses service role and bypasses RLS.
