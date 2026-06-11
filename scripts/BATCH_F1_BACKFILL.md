# Batch F1 — customer backfill (name review)

Email-first backfill runs automatically in migration `20260611100100_customers_email_backfill.sql`.

## Name-based rental linking (manual / review)

Records without email (e.g. `rental_websites` with only `client_name`) are **not** auto-linked in SQL to avoid ambiguous merges.

Use planning helpers in `src/lib/crmLookup/customerBackfill.ts`.

### Rules (high confidence only)

1. Exactly **one** lead matches `client_name` (case/whitespace normalized)
2. That lead already has `customer_id` from email backfill
3. Never merge when multiple leads share the same name

### Operator workflow

1. Deploy migrations `20260611100000` + `20260611100100`
2. Inspect unmatched rentals in Supabase
3. Link manually only when single-lead name match is confirmed
4. Track `review_needed` rows until Batch F2 merge UI

## Summary categories

| Outcome | Meaning |
|---------|---------|
| auto_linked | Safe email or unique name + customer_id match |
| review_needed | Missing customer seed, ambiguous name, or lead without customer_id |
| unmatched | No email and no high-confidence name path |
