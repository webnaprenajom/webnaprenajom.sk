-- RC6: allow CRM users to refresh communication summaries (handoff)

DROP POLICY IF EXISTS "CRM users upsert communication summaries" ON public.customer_communication_summaries;

CREATE POLICY "CRM users upsert communication summaries"
  ON public.customer_communication_summaries FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'user'::public.app_role)
  );

CREATE POLICY "CRM users update communication summaries"
  ON public.customer_communication_summaries FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'user'::public.app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'user'::public.app_role)
  );
