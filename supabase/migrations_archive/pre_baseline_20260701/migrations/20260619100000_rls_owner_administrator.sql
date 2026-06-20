-- Phase 4d: RLS owner / administrator scoping (additive policies — Batch 4a bridge unchanged)
-- Owner: full access via is_crm_owner() (includes legacy admin bridge).
-- Administrator: scoped SELECT/WRITE via team_profiles.implementer_name lookup.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_implementer_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tp.implementer_name
  FROM public.team_profiles tp
  WHERE tp.user_id = auth.uid()
    AND tp.active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_crm_owner(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, 'owner'::public.app_role)
      OR private.has_role(_user_id, 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_crm_administrator(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, 'administrator'::public.app_role)
      OR private.has_role(_user_id, 'user'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.rbac_name_matches(_value text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.get_my_implementer_name() IS NOT NULL
     AND _value IS NOT NULL
     AND _value ILIKE public.get_my_implementer_name();
$$;

CREATE OR REPLACE FUNCTION public.rental_implementers_contains_me(_implementers jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.get_my_implementer_name() IS NOT NULL
     AND COALESCE(_implementers, '[]'::jsonb) @> jsonb_build_array(
       jsonb_build_object('name', public.get_my_implementer_name())
     );
$$;

CREATE OR REPLACE FUNCTION public.finance_record_visible_to_administrator(_rental_website_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT _rental_website_id IS NOT NULL
     AND _rental_website_id IN (
       SELECT rw.id
       FROM public.rental_websites rw
       WHERE public.rental_implementers_contains_me(COALESCE(rw.implementers::jsonb, '[]'::jsonb))
     );
$$;

CREATE OR REPLACE FUNCTION public.customer_visible_to_administrator(_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT _customer_id IS NOT NULL
     AND (
       _customer_id IN (
         SELECT l.customer_id
         FROM public.leads l
         WHERE l.customer_id IS NOT NULL
           AND public.rbac_name_matches(l.assigned_to)
       )
       OR _customer_id IN (
         SELECT rw.customer_id
         FROM public.rental_websites rw
         WHERE rw.customer_id IS NOT NULL
           AND public.rental_implementers_contains_me(COALESCE(rw.implementers::jsonb, '[]'::jsonb))
       )
     );
$$;

REVOKE ALL ON FUNCTION public.get_my_implementer_name() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_crm_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_crm_administrator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rbac_name_matches(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rental_implementers_contains_me(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_record_visible_to_administrator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_visible_to_administrator(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_implementer_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_crm_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_crm_administrator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_name_matches(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rental_implementers_contains_me(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_record_visible_to_administrator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_visible_to_administrator(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_leads" ON public.leads;
CREATE POLICY "administrator_select_own_leads"
  ON public.leads FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(assigned_to))
  );

DROP POLICY IF EXISTS "administrator_write_own_leads" ON public.leads;
CREATE POLICY "administrator_write_own_leads"
  ON public.leads FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(assigned_to))
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(assigned_to))
  );

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_tasks" ON public.tasks;
CREATE POLICY "administrator_select_own_tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(assignee))
  );

DROP POLICY IF EXISTS "administrator_write_own_tasks" ON public.tasks;
CREATE POLICY "administrator_write_own_tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(assignee))
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(assignee))
  );

-- ---------------------------------------------------------------------------
-- rental_websites
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_rental_websites" ON public.rental_websites;
CREATE POLICY "administrator_select_own_rental_websites"
  ON public.rental_websites FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.rental_implementers_contains_me(COALESCE(implementers::jsonb, '[]'::jsonb))
    )
  );

DROP POLICY IF EXISTS "administrator_write_own_rental_websites" ON public.rental_websites;
CREATE POLICY "administrator_write_own_rental_websites"
  ON public.rental_websites FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.rental_implementers_contains_me(COALESCE(implementers::jsonb, '[]'::jsonb))
    )
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.rental_implementers_contains_me(COALESCE(implementers::jsonb, '[]'::jsonb))
    )
  );

-- ---------------------------------------------------------------------------
-- hosting_records
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_hosting_records" ON public.hosting_records;
CREATE POLICY "administrator_select_own_hosting_records"
  ON public.hosting_records FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(acquired_by))
  );

DROP POLICY IF EXISTS "administrator_write_own_hosting_records" ON public.hosting_records;
CREATE POLICY "administrator_write_own_hosting_records"
  ON public.hosting_records FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(acquired_by))
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(acquired_by))
  );

-- ---------------------------------------------------------------------------
-- commissions (additive — complements "CRM users read own commissions")
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_commissions" ON public.commissions;
CREATE POLICY "administrator_select_own_commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(implementer))
  );

DROP POLICY IF EXISTS "administrator_write_own_commissions" ON public.commissions;
CREATE POLICY "administrator_write_own_commissions"
  ON public.commissions FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(implementer))
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(implementer))
  );

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_customers" ON public.customers;
CREATE POLICY "administrator_select_own_customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.customer_visible_to_administrator(id))
  );

DROP POLICY IF EXISTS "administrator_write_own_customers" ON public.customers;
CREATE POLICY "administrator_write_own_customers"
  ON public.customers FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.customer_visible_to_administrator(id))
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.customer_visible_to_administrator(id))
  );

-- ---------------------------------------------------------------------------
-- project_notes — Option B: administrator sees all (TODO: assigned_to post-release)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_project_notes" ON public.project_notes;
CREATE POLICY "administrator_select_own_project_notes"
  ON public.project_notes FOR SELECT TO authenticated
  USING (public.is_crm_owner() OR public.is_crm_administrator());

-- ---------------------------------------------------------------------------
-- marketing_records — Option B
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_marketing_records" ON public.marketing_records;
CREATE POLICY "administrator_select_own_marketing_records"
  ON public.marketing_records FOR SELECT TO authenticated
  USING (public.is_crm_owner() OR public.is_crm_administrator());

-- ---------------------------------------------------------------------------
-- design_proposals — Option B
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_design_proposals" ON public.design_proposals;
CREATE POLICY "administrator_select_own_design_proposals"
  ON public.design_proposals FOR SELECT TO authenticated
  USING (public.is_crm_owner() OR public.is_crm_administrator());

-- ---------------------------------------------------------------------------
-- payment_records / cost_records / payout_records
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_payment_records" ON public.payment_records;
CREATE POLICY "administrator_select_own_payment_records"
  ON public.payment_records FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.finance_record_visible_to_administrator(rental_website_id)
    )
  );

DROP POLICY IF EXISTS "administrator_write_own_payment_records" ON public.payment_records;
CREATE POLICY "administrator_write_own_payment_records"
  ON public.payment_records FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.finance_record_visible_to_administrator(rental_website_id)
    )
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.finance_record_visible_to_administrator(rental_website_id)
    )
  );

DROP POLICY IF EXISTS "administrator_select_own_cost_records" ON public.cost_records;
CREATE POLICY "administrator_select_own_cost_records"
  ON public.cost_records FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.finance_record_visible_to_administrator(rental_website_id)
    )
  );

DROP POLICY IF EXISTS "administrator_write_own_cost_records" ON public.cost_records;
CREATE POLICY "administrator_write_own_cost_records"
  ON public.cost_records FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.finance_record_visible_to_administrator(rental_website_id)
    )
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (
      public.is_crm_administrator()
      AND public.finance_record_visible_to_administrator(rental_website_id)
    )
  );

DROP POLICY IF EXISTS "administrator_select_own_payout_records" ON public.payout_records;
CREATE POLICY "administrator_select_own_payout_records"
  ON public.payout_records FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(implementer))
  );

DROP POLICY IF EXISTS "administrator_write_own_payout_records" ON public.payout_records;
CREATE POLICY "administrator_write_own_payout_records"
  ON public.payout_records FOR ALL TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(implementer))
  )
  WITH CHECK (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND public.rbac_name_matches(implementer))
  );

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "administrator_select_own_user_roles" ON public.user_roles;
CREATE POLICY "administrator_select_own_user_roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    public.is_crm_owner()
    OR (public.is_crm_administrator() AND user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
