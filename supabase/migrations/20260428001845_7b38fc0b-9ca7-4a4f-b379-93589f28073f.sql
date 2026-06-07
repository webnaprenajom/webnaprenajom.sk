-- Wheel of Fortune spins table
CREATE TABLE public.wheel_spins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  prize_label TEXT NOT NULL,
  prize_value INTEGER NOT NULL DEFAULT 0,
  coupon_code TEXT,
  language TEXT NOT NULL DEFAULT 'sk',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wheel_spins_email ON public.wheel_spins (lower(email), created_at DESC);
CREATE INDEX idx_wheel_spins_coupon ON public.wheel_spins (coupon_code);

ALTER TABLE public.wheel_spins ENABLE ROW LEVEL SECURITY;

-- Only admins can read all spins
CREATE POLICY "Admins can view all spins"
ON public.wheel_spins FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update / delete; inserts happen via Edge Function with service role (bypasses RLS)
CREATE POLICY "Admins can update spins"
ON public.wheel_spins FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete spins"
ON public.wheel_spins FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));