-- Add source column to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source text;

-- Allow admins to insert leads manually
CREATE POLICY "Admins can insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));