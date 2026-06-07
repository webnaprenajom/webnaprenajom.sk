ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);

-- Log amount changes too
CREATE OR REPLACE FUNCTION public.log_lead_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'amount', OLD.amount::text, NEW.amount::text, actor_email, actor_id);
    END IF;
    IF NEW.consultation_date IS DISTINCT FROM OLD.consultation_date THEN
      INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, field, old_value, new_value, changed_by_email, changed_by_id)
      VALUES (NEW.id, NEW.name, NEW.email, 'updated', 'consultation_date', OLD.consultation_date::text, NEW.consultation_date::text, actor_email, actor_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.lead_logs (lead_id, lead_name, lead_email, action, changed_by_email, changed_by_id)
    VALUES (OLD.id, OLD.name, OLD.email, 'deleted', actor_email, actor_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;