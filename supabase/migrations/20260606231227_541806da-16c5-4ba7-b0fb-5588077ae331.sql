
CREATE TABLE public.order_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  company TEXT,
  ico TEXT,
  dic TEXT,
  address TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'rental',
  package_name TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  contract_months INTEGER NOT NULL DEFAULT 12,
  signature_name TEXT NOT NULL,
  agreed_terms BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'signed',
  notes TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_signatures TO authenticated;
GRANT ALL ON public.order_signatures TO service_role;
ALTER TABLE public.order_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view signatures" ON public.order_signatures FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert signatures" ON public.order_signatures FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update signatures" ON public.order_signatures FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete signatures" ON public.order_signatures FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_order_signatures_updated_at BEFORE UPDATE ON public.order_signatures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.design_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  email TEXT,
  design_url TEXT,
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'sent',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_proposals TO authenticated;
GRANT ALL ON public.design_proposals TO service_role;
ALTER TABLE public.design_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view designs" ON public.design_proposals FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert designs" ON public.design_proposals FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update designs" ON public.design_proposals FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete designs" ON public.design_proposals FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_design_proposals_updated_at BEFORE UPDATE ON public.design_proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify on new signature
CREATE OR REPLACE FUNCTION public.notify_new_signature()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (type, title, message, link, metadata)
  VALUES (
    'signature',
    'Nový podpis objednávky: ' || COALESCE(NEW.client_name, 'neznámy'),
    COALESCE(NEW.email, '') || ' · ' || COALESCE(NEW.package_name, '') || ' · ' || NEW.price::text || ' €',
    '/admin/signatures',
    jsonb_build_object('signature_id', NEW.id, 'email', NEW.email, 'name', NEW.client_name)
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_signature AFTER INSERT ON public.order_signatures FOR EACH ROW EXECUTE FUNCTION public.notify_new_signature();
