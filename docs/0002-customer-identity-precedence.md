# ADR 0002: Customer Identity Precedence

## Status
Accepted

## Context
CRM potrebuje jednotnú logiku identity klienta naprieč leadmi, projektmi, hostingom, prenájmami, províziami a komunikáciou.

## Decision
Priorita identity klienta je:
1. `customer_id`
2. normalizovaný email
3. explicitný manuálny link
4. limitovaná heuristika podľa mena

## Consequences
- Nové linking flowy musia rešpektovať túto prioritu.
- Heuristika podľa mena nesmie mať vyššiu dôveru ako email alebo `customer_id`.
- Duplicate prevention a merge readiness majú stavať na tejto priorite.
