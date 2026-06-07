
-- 1) Make contracts bucket private
UPDATE storage.buckets SET public = false WHERE id = 'contracts';

-- Drop any existing permissive policies on storage.objects for contracts bucket
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND (
        pg_get_expr(polqual, polrelid) ILIKE '%contracts%'
        OR pg_get_expr(polwithcheck, polrelid) ILIKE '%contracts%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Admins can read contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update contracts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete contracts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'));

-- 2) Restrict Realtime broadcast subscriptions to admins
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins receive realtime messages" ON realtime.messages;
CREATE POLICY "Admins receive realtime messages"
ON realtime.messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Revoke direct EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
--    has_role is still callable by Postgres internals via RLS evaluation.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_lead_changes() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_notification_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_lead() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_lead_status_changed_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
