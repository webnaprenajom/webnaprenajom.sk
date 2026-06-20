# CRM Export — Data Dictionary

Dátum: 2026-06-20. Žiadne deštruktívne zmeny, len SELECT export cez `COPY`. Súbory sú pomenované presne podľa názvu tabuľky (`<table>.csv`).

## Odporúčané poradie importu/spracovania (rešpektuje FK)

1. `team_profiles`, `user_roles` — interné role/realizátori
2. `customers` — canonical identity klientov
3. `leads` — pipeline, prepojené na `customers` cez `customer_id` (fallback email/name)
4. `rental_websites` — prenajaté weby, FK `customer_id`
5. `hosting_records` — hosting služby, FK `customer_id`
6. `rental_payments` — workflow zápisy mesačných platieb prenájmu (FK `rental_website_id`)
7. `commission_rules`, `commission_rule_overrides` — pravidlá pre provízie
8. `commissions` — provízie realizátorom (FK `customer_id`, `rental_website_id`)
9. **FACT vrstva (audit/finance truth):**
   - `payment_records` — potvrdené príjmy
   - `cost_records` — potvrdené náklady
   - `payout_records` — potvrdené výplaty provízií
10. `expenses` — workflow/legacy náklady (nie všetky sú fact)
11. `project_notes`, `tasks` — operatíva (FK `customer_id`)
12. `lead_logs` — audit log zmien leadov
13. `notifications`, `wheel_spins`, `design_proposals`, `order_signatures` — vedľajšie streamy
14. `communication_events`, `customer_communication_summaries` — komunikačná vrstva

## Identity matching stĺpce

- **customers.id** = canonical UUID; identity bridge: `email` (lowercase), `phone`, `company_name`/`ico`.
- FK `customer_id` existuje na: `leads`, `rental_websites`, `hosting_records`, `commissions`, `project_notes`, `tasks`.
- Pre staršie záznamy bez `customer_id` fallback: match cez email/name (loader `loadCustomerHubAggregate`).
- `rental_websites.customer_email` je backfill stĺpec pre legacy mapping.

## Truth levels (finance)

| Tabuľka | Vrstva | Popis |
|---|---|---|
| `payment_records` | **FACT / audit** | Potvrdená platba od klienta. Záväzné číslo. |
| `cost_records` | **FACT / audit** | Potvrdený náklad. |
| `payout_records` | **FACT / audit** | Potvrdená výplata provízie realizátorovi. |
| `commissions` | workflow | Pracovný výpočet provízie, kým nie je vyplatený do `payout_records`. |
| `rental_payments` | workflow | Mesačný cyklus stavu platby (none/invoice/paid/unpaid/overdue). |
| `expenses` | workflow / legacy | Staršie náklady mimo `cost_records`. |
| `legacy_finance_staging`, `legacy_import_*`, `legacy_id_map` | legacy import | Historický import, neexportované (nepatrí do CRM flow). |

`finance_issue_dismissals`, `finance_policy_settings`, `finance_review_items` = governance UI state, vynechané z exportu.

## Tabuľky a kľúčové stĺpce

### customers (canonical)
PK `id`. Kľúčové: `email`, `phone`, `company_name`, `ico`, `active`. Canonical klientská identita.

### leads
PK `id`, FK `customer_id` → customers. Identity: `email`, `phone`, `name`. Workflow: `status`, `temperature`, `type`, `source`, `assigned_to`, `amount`, `consultation_date`, `status_changed_at`. Pipeline entita.

### rental_websites
PK `id`, FK `customer_id`. Kľúčové: `domain`, `monthly_price`, `annual_price`, `start_date`, `status`, `customer_email` (legacy bridge). Canonical entita prenájmu.

### rental_payments
PK `id`, FK `rental_website_id`. Mesačný stav platby (workflow only). Stĺpce: `period_start`, `period_end`, `status`, `paid_at`, `amount`, `note`.

### hosting_records
PK `id`, FK `customer_id`. Kľúčové: `domain`, `provider`, `annual_price`, `period_start`, `period_end`, `payment_status`, `note`. Canonical hosting.

### commissions
PK `id`, FK `customer_id`, `rental_website_id`. Realizátorské provízie (workflow), splits v `implementers` JSON. Kľúčové: `amount`, `period`, `status`, `paid_at`.

### commission_rules / commission_rule_overrides
Pravidlá výpočtu provízie per realizátor/projekt. Lookup.

### payment_records (FACT)
PK `id`. Kľúčové: `customer_id`, `rental_website_id`, `amount`, `paid_at`, `period`, `source`, `truth_level`. Potvrdený príjem.

### cost_records (FACT)
PK `id`. `customer_id`, `rental_website_id`, `amount`, `incurred_at`, `category`, `truth_level`. Potvrdený náklad.

### payout_records (FACT)
PK `id`. `commission_id`, `recipient_id`/`recipient_email`, `amount`, `paid_at`, `truth_level`. Potvrdená výplata provízie.

### expenses
Workflow/legacy náklady mimo fact vrstvy.

### tasks
PK `id`, FK `customer_id`. `title`, `status`, `due_date`, `assigned_to`, `priority`.

### project_notes
PK `id`, FK `customer_id`. Poznámky a credentials k projektom.

### lead_logs
Audit log zmien `leads` (action, field, old/new, changed_by_email, changed_by_id, lead_id).

### order_signatures
Podpísané objednávky cez `/objednavka` (client_name, email, package_name, price, signature, contract storage path).

### design_proposals
Návrhy dizajnu klientom (URL, status, customer_id).

### notifications
In-app notifikácie (type, title, message, link, metadata jsonb).

### wheel_spins
Záznamy zo zľavového kolesa (email, prize, spun_at).

### customer_communication_summaries / communication_events
Komunikačné agregáty + raw eventy (email/whatsapp). FK `customer_id`.

### team_profiles
Interné profily realizátorov (display name, role, avatar).

### user_roles
RBAC. `user_id`, `role` (app_role enum). NIKDY nepresúvať do profiles.

## Vynechané (nepatria do CRM flow / governance/legacy)

`admin_audit_log`, `finance_issue_dismissals`, `finance_policy_settings`, `finance_review_items`, `legacy_finance_staging`, `legacy_id_map`, `legacy_import_batches`, `legacy_import_rows`, `migration_review_queue`, `communication_webhook_incidents`, `user_email_accounts`.
Ak ich tiež potrebuješ exportovať, daj vedieť.

## Ako re-exportovať z Lovable Cloud UI

Backend → Database → vybrať tabuľku → tlačidlo **Export CSV** (pravý horný roh). Alebo Backend → SQL Editor → `SELECT * FROM public.<table>` → Download CSV.
