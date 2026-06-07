DELETE FROM public.lead_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE source IN ('Google hak', 'Google'));
DELETE FROM public.leads WHERE source IN ('Google hak', 'Google');