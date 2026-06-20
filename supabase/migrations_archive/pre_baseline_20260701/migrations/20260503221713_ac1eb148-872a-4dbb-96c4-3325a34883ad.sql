
CREATE TABLE public.rental_websites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  client_name TEXT,
  monthly_price NUMERIC NOT NULL DEFAULT 35,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.rental_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES public.rental_websites(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(website_id, year, month)
);

ALTER TABLE public.rental_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view rental_websites" ON public.rental_websites FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert rental_websites" ON public.rental_websites FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update rental_websites" ON public.rental_websites FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete rental_websites" ON public.rental_websites FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE POLICY "Admins view rental_payments" ON public.rental_payments FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert rental_payments" ON public.rental_payments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update rental_payments" ON public.rental_payments FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete rental_payments" ON public.rental_payments FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_rental_websites_updated BEFORE UPDATE ON public.rental_websites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rental_payments_updated BEFORE UPDATE ON public.rental_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
