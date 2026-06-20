CREATE TABLE public.project_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  client_name TEXT,
  url TEXT,
  username TEXT,
  password TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view project_notes" ON public.project_notes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert project_notes" ON public.project_notes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update project_notes" ON public.project_notes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete project_notes" ON public.project_notes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_project_notes_updated_at BEFORE UPDATE ON public.project_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();