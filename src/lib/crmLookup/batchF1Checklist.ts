/**
 * Batch F1 manual verification checklist (run after migrations):
 *
 * [ ] customers table exists with RLS for admins
 * [ ] customer_id nullable on leads, project_notes, rental_websites, hosting_records, commissions
 * [ ] Email backfill migration created customers from leads/signatures/etc.
 * [ ] leads.customer_id populated where email matches
 * [ ] ClientPicker shows customers before leads; Kanónický zákazník badge on select
 * [ ] New project saves customer_id + customer_email
 * [ ] New commission saves customer_id when email/customer selected
 * [ ] /admin/customers/:uuid loads Klient 360° with CanonicalCustomerBadge
 * [ ] /admin/customer/:email still works with HeuristicDataBadge
 * [ ] rental_websites without email remain customer_id NULL until manual review
 */

export {};
