-- Batch: lead_logs read access for owner + scoped administrator (Phase 4d parity).
-- Write path unchanged: log_lead_changes / log_notification_insert are SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.lead_log_visible_to_administrator(
  _lead_id uuid,
  _lead_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_implementer_name() IS NOT NULL
     AND (
       (
         _lead_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM public.leads l
           WHERE l.id = _lead_id
             AND public.rbac_name_matches(l.assigned_to)
         )
       )
       OR (
         _lead_email IS NOT NULL
         AND TRIM(_lead_email) <> ''
         AND EXISTS (
           SELECT 1
           FROM public.leads l
           WHERE lower(trim(l.email)) = lower(trim(_lead_email))
             AND public.rbac_name_matches(l.assigned_to)
         )
       )
     );
$$;

REVOKE ALL ON FUNCTION public.lead_log_visible_to_administrator(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_log_visible_to_administrator(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.lead_log_visible_to_administrator IS
  'Administrator sees lead_logs only for leads assigned to their team_profiles.implementer_name.';

DROP POLICY IF EXISTS "Admins can view all lead logs" ON public.lead_logs;
DROP POLICY IF EXISTS "Admins can insert lead logs" ON public.lead_logs;
DROP POLICY IF EXISTS "owner_select_lead_logs" ON public.lead_logs;
DROP POLICY IF EXISTS "administrator_select_scoped_lead_logs" ON public.lead_logs;
DROP POLICY IF EXISTS "crm_select_lead_logs" ON public.lead_logs;

CREATE POLICY "crm_select_lead_logs"
  ON public.lead_logs FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR public.lead_log_visible_to_administrator(lead_id, lead_email)
  );

CREATE POLICY "owner_insert_lead_logs"
  ON public.lead_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_crm_owner());
