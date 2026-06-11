# Release notes — Batch RC1

Produkčné spevnenie CRM po dokončení architektúry, prepojení, komunikácie a zákazníckeho workspace.

**Dátum:** jún 2026  
**Migrácie:** do `20260611170000_tasks_customer_id_batch_i.sql` (vrátane)

---

## Pre adminov — čo sa zmenilo

### Bočná navigácia

- Jednotný sidebar: **Operatíva** (Dnes, Leady, Klienti, Úlohy), **Dodávky** (Projekty, Prenájmy, Hosting), **Financie**, **Nástroje**.
- Stará cesta `/admin/commissions` presmeruje na **Financie → Provízie** (`?advanced=1&legacy=commissions`).

### Financie — zjednodušenie

- Provízie a náklady sú v module **Financie** (pokročilý režim).
- Záložky: Detailný prehľad, Provízie & náklady, Záznamy, **Zladenie**, **Vyúčtovanie**, **Kontrola**.
- Potvrdené fakty sú oddelené od legacy importu a workflow-only záznamov.

### Projekty / prenájmy / hosting

- Tri samostatné moduly namiesto jedného zmiešaného prehľadu.
- Detail entity zobrazuje prepojené provízie a zákazníka.

### Provízie v detailoch entít

- Provízia by mala mať `source_type` + `source_id` (projekt, prenájom, hosting).
- Legacy riadky bez zdroja zostávajú — dopĺňajte pri úpravách.

### Zákaznícky workspace (360°)

- Kanónická cesta: `/admin/customers/:uuid`
- Legacy e-mail: `/admin/customer/:email`
- Záložky: Prehľad, Komunikácia, Projekty, Prenájmy, Hosting, Financie, Úlohy, História
- Rýchle vytvorenie úlohy, projektu, prenájmu, hostingu, provízie
- Deep linky: `?tab=komunikacia&comm=unlinked`

### Komunikačná časová os

- Filtre: prichádzajúce, odchádzajúce, neprepojené, vo vlákne
- Operácie: `/admin/communication-ops`

### Prepojenie úloh (`tasks.customer_id`)

- Ukladá sa pri vytvorení/úprave z pickera alebo workspace
- Bezpečný backfill len cez `lead.customer_id`

---

## Legacy checklist (viditeľnosť)

Admin stránka: **`/admin/rollout-health`** (Stav CRM v sidebari)

| Metrika | Význam | Akcia |
|--------|--------|-------|
| Provízie bez zdroja | `source_type` + `source_id` obe NULL | Financie / provízie |
| Neúplné provízie | len typ alebo len ID | Financie / provízie |
| Leady bez customer_id | e-mail existuje, chýba FK | Klienti / pipeline |
| Inbound bez customer_id | neprepojená komunikácia | Communication ops |
| Otvorené úlohy bez customer_id | aktívne úlohy | Úlohy |
| Úlohy s leadom na backfill | lead má customer_id | Úlohy (manuálne) |

**Žiadne hromadné auto-opravy v RC1** — len report a odkazy.

---

## QA checklist pred nasadením

- [ ] `/admin/customers/:uuid` — všetky záložky workspace
- [ ] `/admin/customer/:email` — legacy režim
- [ ] `?tab=komunikacia&comm=unlinked` — filter sa obnoví
- [ ] `/admin/commissions` → redirect Financie
- [ ] Úloha z workspace — uloží `customer_id`
- [ ] Communication ops — neprepojené inbound
- [ ] Stav CRM — checklist načíta metriky

---

## Známy backlog po RC1

1. Hromadný backfill `tasks.customer_id` (len cez lead, nie client_name)
2. Automatická reconciliácia inbound bez customer_id
3. Server-side agregácia adopcie workspace (dnes localStorage)
4. Doplnenie legacy provízií so source pri editácii
5. Leady → customer_id backfill podľa e-mailu (F1 follow-up)

---

## Deploy

```bash
# Migrácie v poradí až po 20260611170000
npm run build
npm test
```

Edge funkcie inbound: nasadiť ak sa menili od G.5.
