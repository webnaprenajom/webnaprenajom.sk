CREATE POLICY "Allow edge functions to insert leads" ON public.leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow edge functions to select leads" ON public.leads
  FOR SELECT
  TO authenticated
  USING (true);