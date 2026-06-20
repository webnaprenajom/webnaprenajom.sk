
-- Staging tables mirror real columns (no defaults / no FK enforcement)
CREATE TABLE public._imp_leads (LIKE public.leads INCLUDING DEFAULTS);
CREATE TABLE public._imp_lead_logs (LIKE public.lead_logs INCLUDING DEFAULTS);
CREATE TABLE public._imp_notifications (LIKE public.notifications INCLUDING DEFAULTS);
CREATE TABLE public._imp_rental_websites (LIKE public.rental_websites INCLUDING DEFAULTS);
CREATE TABLE public._imp_rental_payments (LIKE public.rental_payments INCLUDING DEFAULTS);
CREATE TABLE public._imp_expenses (LIKE public.expenses INCLUDING DEFAULTS);
CREATE TABLE public._imp_tasks (LIKE public.tasks INCLUDING DEFAULTS);
CREATE TABLE public._imp_project_notes (LIKE public.project_notes INCLUDING DEFAULTS);
CREATE TABLE public._imp_wheel_spins (LIKE public.wheel_spins INCLUDING DEFAULTS);
CREATE TABLE public._imp_commissions (LIKE public.commissions INCLUDING DEFAULTS);
CREATE TABLE public._imp_design_proposals (LIKE public.design_proposals INCLUDING DEFAULTS);

-- Allow sandbox_exec / authenticated to push CSV rows via \copy
GRANT INSERT, SELECT, TRUNCATE ON
  public._imp_leads, public._imp_lead_logs, public._imp_notifications,
  public._imp_rental_websites, public._imp_rental_payments, public._imp_expenses,
  public._imp_tasks, public._imp_project_notes, public._imp_wheel_spins,
  public._imp_commissions, public._imp_design_proposals
TO PUBLIC;

CREATE OR REPLACE FUNCTION public._imp_apply_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb := '{}'::jsonb;
  c int;
BEGIN
  -- Silence audit + notification triggers so imported history isn't duplicated
  ALTER TABLE public.leads DISABLE TRIGGER on_lead_created_notify;
  ALTER TABLE public.leads DISABLE TRIGGER trg_log_lead_changes;
  ALTER TABLE public.notifications DISABLE TRIGGER trg_log_notification_insert;

  INSERT INTO public.leads SELECT * FROM public._imp_leads
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('leads', c);

  INSERT INTO public.lead_logs SELECT * FROM public._imp_lead_logs
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('lead_logs', c);

  INSERT INTO public.notifications SELECT * FROM public._imp_notifications
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('notifications', c);

  INSERT INTO public.rental_websites SELECT * FROM public._imp_rental_websites
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('rental_websites', c);

  INSERT INTO public.rental_payments SELECT * FROM public._imp_rental_payments
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('rental_payments', c);

  INSERT INTO public.expenses SELECT * FROM public._imp_expenses
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('expenses', c);

  INSERT INTO public.tasks SELECT * FROM public._imp_tasks
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('tasks', c);

  INSERT INTO public.project_notes SELECT * FROM public._imp_project_notes
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('project_notes', c);

  INSERT INTO public.wheel_spins SELECT * FROM public._imp_wheel_spins
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('wheel_spins', c);

  INSERT INTO public.commissions SELECT * FROM public._imp_commissions
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('commissions', c);

  INSERT INTO public.design_proposals SELECT * FROM public._imp_design_proposals
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; r := r || jsonb_build_object('design_proposals', c);

  ALTER TABLE public.leads ENABLE TRIGGER on_lead_created_notify;
  ALTER TABLE public.leads ENABLE TRIGGER trg_log_lead_changes;
  ALTER TABLE public.notifications ENABLE TRIGGER trg_log_notification_insert;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public._imp_apply_all() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._imp_apply_all() TO authenticated, anon, service_role;
