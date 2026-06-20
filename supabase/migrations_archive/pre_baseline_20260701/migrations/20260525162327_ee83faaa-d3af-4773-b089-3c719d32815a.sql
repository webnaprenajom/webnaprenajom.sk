CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO postgres, service_role;

-- public tables
DROP POLICY IF EXISTS "Admins can view commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins can insert commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins can update commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins can delete commissions" ON public.commissions;
CREATE POLICY "Admins can view commissions" ON public.commissions FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert commissions" ON public.commissions FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update commissions" ON public.commissions FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete commissions" ON public.commissions FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins delete expenses" ON public.expenses;
CREATE POLICY "Admins view expenses" ON public.expenses FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update expenses" ON public.expenses FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete expenses" ON public.expenses FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all lead logs" ON public.lead_logs;
DROP POLICY IF EXISTS "Admins can insert lead logs" ON public.lead_logs;
CREATE POLICY "Admins can view all lead logs" ON public.lead_logs FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert lead logs" ON public.lead_logs FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can insert leads" ON public.leads;
CREATE POLICY "Admins can view all leads" ON public.leads FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update leads" ON public.leads FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can view notifications" ON public.notifications FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update notifications" ON public.notifications FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete notifications" ON public.notifications FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view project_notes" ON public.project_notes;
DROP POLICY IF EXISTS "Admins insert project_notes" ON public.project_notes;
DROP POLICY IF EXISTS "Admins update project_notes" ON public.project_notes;
DROP POLICY IF EXISTS "Admins delete project_notes" ON public.project_notes;
CREATE POLICY "Admins view project_notes" ON public.project_notes FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert project_notes" ON public.project_notes FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update project_notes" ON public.project_notes FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete project_notes" ON public.project_notes FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view rental_payments" ON public.rental_payments;
DROP POLICY IF EXISTS "Admins insert rental_payments" ON public.rental_payments;
DROP POLICY IF EXISTS "Admins update rental_payments" ON public.rental_payments;
DROP POLICY IF EXISTS "Admins delete rental_payments" ON public.rental_payments;
CREATE POLICY "Admins view rental_payments" ON public.rental_payments FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert rental_payments" ON public.rental_payments FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update rental_payments" ON public.rental_payments FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete rental_payments" ON public.rental_payments FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view rental_websites" ON public.rental_websites;
DROP POLICY IF EXISTS "Admins insert rental_websites" ON public.rental_websites;
DROP POLICY IF EXISTS "Admins update rental_websites" ON public.rental_websites;
DROP POLICY IF EXISTS "Admins delete rental_websites" ON public.rental_websites;
CREATE POLICY "Admins view rental_websites" ON public.rental_websites FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert rental_websites" ON public.rental_websites FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update rental_websites" ON public.rental_websites FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete rental_websites" ON public.rental_websites FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins delete tasks" ON public.tasks;
CREATE POLICY "Admins view tasks" ON public.tasks FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update tasks" ON public.tasks FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete tasks" ON public.tasks FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can view all spins" ON public.wheel_spins;
DROP POLICY IF EXISTS "Admins can update spins" ON public.wheel_spins;
DROP POLICY IF EXISTS "Admins can delete spins" ON public.wheel_spins;
DROP POLICY IF EXISTS "Admins can insert spins" ON public.wheel_spins;
CREATE POLICY "Admins can view all spins" ON public.wheel_spins FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update spins" ON public.wheel_spins FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete spins" ON public.wheel_spins FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert spins" ON public.wheel_spins FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- storage.objects (contracts bucket)
DROP POLICY IF EXISTS "Admins can read contracts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can insert contracts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update contracts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete contracts" ON storage.objects;
CREATE POLICY "Admins can read contracts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contracts' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert contracts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contracts' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update contracts" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contracts' AND private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (bucket_id = 'contracts' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete contracts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contracts' AND private.has_role(auth.uid(), 'admin'::public.app_role));

-- realtime.messages
DROP POLICY IF EXISTS "Admins receive realtime messages" ON realtime.messages;
CREATE POLICY "Admins receive realtime messages" ON realtime.messages FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop the publicly-exposed function
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);