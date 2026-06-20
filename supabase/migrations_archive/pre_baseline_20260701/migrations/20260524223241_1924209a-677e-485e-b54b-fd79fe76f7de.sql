ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS follow_up_date date;
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON public.leads(follow_up_date) WHERE follow_up_date IS NOT NULL;