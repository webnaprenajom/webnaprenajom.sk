DELETE FROM public.lead_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE source = 'Google ');
DELETE FROM public.leads WHERE source = 'Google ';