# Release notes — Batch RC2

Operačná súdržnosť CRM: opravené flow, skrytá interná navigácia, komunikácia v kontexte leadu/klienta, lifecycle lead → klient.

**Migrácia:** `20260612000000_rc2_project_ai_type.sql`

---

## Opravené flow

### Klienti (`/admin/clients`)
- Vyhľadávanie cez kombinovaný lookup (klienti + leady)
- Bezpečné PostgREST filtre (čiarky, wildcards)
- Loading / error / empty stavy

### Hosting (`/admin/hosting`)
- Validácia klienta pred uložením
- Validácia e-mailu
- Propagácia `lead_id` z ClientPicker
- Prepojenie lead → klient po vytvorení dodávky

### Projekty (`/admin/projects`)
- Validácia e-mailu pred uložením (oprava email-related chyby)
- `createIfMissing` len pri platnom e-maili
- Nový typ platformy **AI**
- Prepojenie lead po vytvorení projektu

---

## Navigácia

**Skryté z produkčného sidebaru** (`devOnly: true`, trasy fungujú):
- `/admin/rollout-health` — Stav CRM
- `/admin/communication-ops` — Komunikácia ops

**Zostáva v sidebari:** Dnes, Leady, Klienti, Úlohy, Projekty, Prenájmy, Hosting, Financie, Podpisy, Dizajny, Koleso, História, Heslá, Nastavenia

---

## Lead vs klient — pravidlá

| Pojem | Význam |
|-------|--------|
| **Lead** | Predajný kontakt pred potvrdeným vzťahom |
| **Klient** | Potvrdený obchodný vzťah (customer záznam) |

**Automatické prepojenie lead → klient** keď:
- Status leadu je `won` alebo `order`
- E-mail je platný (silná identita)
- Vytvorí/nájde kanonického klienta a nastaví `leads.customer_id`

**Po vytvorení dodávky** (projekt, hosting): ak je `lead_id` a vznikne `customer_id`, lead sa doplní.

**Nikdy:** hromadné vytváranie klientov z nejednoznačného mena bez e-mailu.

---

## Komunikácia

- **Lead detail:** panel Komunikácia (interné poznámky, inbound/outbound, posledná aktivita)
- **Klient 360°:** záložka Komunikácia zostáva primárny povrch
- Top-level Komunikácia ops skrytá z navigácie

---

## QA checklist

- [ ] Klienti — vyhľadaj meno s čiarkou (napr. „ACME, s.r.o.“)
- [ ] Klienti — error stav pri výpadku DB nezrúti stránku
- [ ] Hosting — vytvor záznam s klientom z lookup
- [ ] Hosting — chyba pri neplatnom e-maili je zrozumiteľná
- [ ] Projekt — vytvor s typom AI
- [ ] Projekt — uloženie bez platného e-mailu nepadá na DB constraint
- [ ] Lead → status Zrealizovaný — badge + customer_id
- [ ] Sidebar — Stav CRM a Komunikácia nie sú viditeľné
- [ ] `/admin/rollout-health` stále funguje pri priamom URL
- [ ] Lead detail — komunikačný panel + odkaz Klient 360°

---

## Známe edge cases (backlog)

- Leady bez e-mailu pri won — manuálne prepojenie cez dodávku
- Bulk status change stále nevolá lifecycle (zámerne)
- Meno-only klienti bez e-mailu — bez auto-create
- Server-side backfill existujúcich won leadov — mimo RC2
