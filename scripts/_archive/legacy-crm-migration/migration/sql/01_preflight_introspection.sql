-- =============================================================================
-- Preflight introspection — TEAM Supabase (qosxlmrrkyvobjigsynt)
-- Read-only. Run in SQL Editor before any migration promote.
-- =============================================================================

-- 1) Migration infrastructure present
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'legacy_import_batches',
    'legacy_import_rows',
    'legacy_id_map',
    'migration_review_queue',
    'legacy_finance_staging'
  )
ORDER BY 1;

-- 2) Row counts — canonical CRM tables (empty = greenfield promote)
SELECT 'customers' AS tbl, count(*)::bigint AS rows FROM public.customers
UNION ALL SELECT 'leads', count(*) FROM public.leads
UNION ALL SELECT 'rental_websites', count(*) FROM public.rental_websites
UNION ALL SELECT 'hosting_records', count(*) FROM public.hosting_records
UNION ALL SELECT 'rental_payments', count(*) FROM public.rental_payments
UNION ALL SELECT 'commissions', count(*) FROM public.commissions
UNION ALL SELECT 'payment_records', count(*) FROM public.payment_records
UNION ALL SELECT 'cost_records', count(*) FROM public.cost_records
UNION ALL SELECT 'payout_records', count(*) FROM public.payout_records
UNION ALL SELECT 'expenses', count(*) FROM public.expenses
UNION ALL SELECT 'tasks', count(*) FROM public.tasks
UNION ALL SELECT 'project_notes', count(*) FROM public.project_notes
UNION ALL SELECT 'lead_logs', count(*) FROM public.lead_logs
UNION ALL SELECT 'notifications', count(*) FROM public.notifications
UNION ALL SELECT 'communication_events', count(*) FROM public.communication_events
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
ORDER BY tbl;

-- 3) Auth users vs user_roles (manual migration gate)
SELECT u.id, u.email, u.created_at, array_agg(ur.role::text) AS roles
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
GROUP BY u.id, u.email, u.created_at
ORDER BY u.created_at;

-- 4) Customer email uniqueness on team DB
SELECT lower(trim(email)) AS email, count(*) AS cnt, array_agg(id) AS customer_ids
FROM public.customers
WHERE email IS NOT NULL AND trim(email) <> ''
GROUP BY lower(trim(email))
HAVING count(*) > 1;

-- 5) FACT truth_level distribution
SELECT 'payment_records' AS tbl, truth_level, count(*) FROM public.payment_records GROUP BY 1, 2
UNION ALL
SELECT 'cost_records', truth_level, count(*) FROM public.cost_records GROUP BY 1, 2
UNION ALL
SELECT 'payout_records', truth_level, count(*) FROM public.payout_records GROUP BY 1, 2
ORDER BY tbl, truth_level;

-- 6) Staging batches (if Phase 2 already ran)
SELECT id, batch_key, status, started_at, finished_at
FROM public.legacy_import_batches
ORDER BY started_at DESC
LIMIT 10;

-- 7) New-schema tables without legacy export (informational)
SELECT 'marketing_records' AS tbl, count(*)::bigint FROM public.marketing_records
UNION ALL SELECT 'crm_implementers', count(*) FROM public.crm_implementers;
