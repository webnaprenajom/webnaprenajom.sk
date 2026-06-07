-- Remove overly permissive insert policy
-- Edge function uses service_role key which bypasses RLS, so no policy needed for inserts
DROP POLICY IF EXISTS "Allow edge functions to insert leads" ON public.leads;