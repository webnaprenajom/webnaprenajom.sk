REVOKE EXECUTE ON FUNCTION public.log_lead_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_notification_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_lead_status_changed_at() FROM PUBLIC, anon, authenticated;