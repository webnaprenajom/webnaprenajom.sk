-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Add CRM fields to leads
ALTER TABLE public.leads
  ADD COLUMN status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN notes TEXT,
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- 6. Trigger for updated_at on leads
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Drop old permissive select policy and replace with admin-only
DROP POLICY IF EXISTS "Allow edge functions to select leads" ON public.leads;

CREATE POLICY "Admins can view all leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leads"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete leads"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 8. Index for performance
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);