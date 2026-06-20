# Supabase migration cleanup — baseline plán

> **Stav:** návrh na schválenie · **žiadna exekúcia** (súbory sa nemenili)  
> **Dátum:** 2026-06-20  
> **Repo:** web-rent-wizard-759d8d0e

---

## 1. Prehľad aktuálneho stavu

| Metrika | Hodnota |
|---------|---------|
| Počet súborov v `supabase/migrations/` | **90** |
| Časový rozsah | `20260310010549` → `20260625200000` |
| Local vs Remote | Zosúladené (`migration list` sedí) — predpoklad pre tento plán |
| Aktívny legacy ref | `kusluytpsgdrbhvaxoho` |
| Cieľový team ref | `qosxlmrrkyvobjigsynt` |
| Dokumentovaný deploy | `supabase/DEPLOY.md`, `docs/supabase-migration.md` |

### Ako vznikla história

Migrácie pochádzajú z troch zdrojov:

1. **Inkrementálne batch súbory** — pomenované podľa fáz (`20260609120000_finance_*`, `20260611100000_customers_*`, …).
2. **Lovable / `db pull` UUID snapshoty** — veľké konsolidované súbory s komentármi `-- 20260609120000_...` vnútri.
3. **Ops / seed migrácie** — dáta alebo auth zásahy viazané na konkrétny projekt.

Na **existujúcom** remote projekte všetkých 90 migrácií prebehlo (alebo bolo označených ako applied).  
Na **novom** projekte `db push` postupne padá na **duplicitných `CREATE TABLE` / `CREATE POLICY`** — snapshoty opakujú už aplikované inkrementálne migrácie.

---

## 2. Kategórie migrácií

### 2.1 Snapshot / overlap migrácie (kritické)

Tieto súbory **re-exportujú celé bloky** skorších inkrementálnych migrácií. Obsahujú komentáre s pôvodnými timestampami.

| Súbor | Veľkosť | Vnútorný rozsah (komentáre v súbore) | Problém |
|-------|---------|--------------------------------------|---------|
| `20260612135956_a2c221a1-3cae-4d24-a289-ddc205fd3937.sql` | ~33 KB | `09120000` → `12000000` (15 batchov) | `CREATE TABLE` bez `IF NOT EXISTS` — duplicita voči inkrementálom |
| `20260615001857_5ea1ae50-db85-4bc6-a556-09bc961f3bae.sql` | ~33 KB | Rovnaký blok `09120000` → `12000000` | Takmer identická kópia `12135956` |
| `20260615002114_47b4062c-096c-4932-a11e-c07a7ed4c26f.sql` | ~14 KB | `13000000`, `13124214`, `13125139`, `14000000`, `14142818`–`14143607` | Duplicita voči RC4/RC5/RC6 batchom |
| `20260615002310_1b99a54b-1e04-4519-93d2-4842fa1341ba.sql` | ~25 KB | `18000000` + `19000000` destructive RPCs | Duplicita voči `legacy_import_staging` + `destructive_delete_rpcs` |

**Dôsledok na fresh DB:** po úspešnom behu napr. `20260609120000_finance_payment_payout_records.sql` nasledujúci `20260612135956_*` spadne na `relation "payment_records" already exists`.

### 2.2 Inkrementálne migrácie duplikované snapshotmi (ponechať v baseline logike)

Ak sa snapshoty archivujú, tieto súbory **sú autoritatívne** pre daný rozsah:

```
20260609120000_finance_payment_payout_records.sql
20260609130000_finance_cost_records.sql
20260609140000_finance_issue_dismissals.sql
20260609150000_finance_rules_hosting_governance.sql
20260609160000_finance_review_cadence.sql
20260610120000_commissions_payment_form.sql
20260610130000_entity_linking_batch_e.sql
20260611100000_customers_foundation.sql
20260611100100_customers_email_backfill.sql
20260611120000_communication_events_f2.sql
20260611140000_communication_events_f25_hardening.sql
20260611150000_inbound_email_batch_g.sql
20260611160000_communication_ops_g5.sql
20260611170000_tasks_customer_id_batch_i.sql
20260612000000_rc2_project_ai_type.sql
20260613000000_rc4_project_credentials.sql
20260613124214_26a66378-dac2-404a-a45c-c3237bff4198.sql
20260613125139_4e900c71-4f33-49f7-9665-e0417650dc4a.sql
20260614000000_rc5_rental_customer_identity.sql
20260614142818_14433de5-40dd-4ef6-a33d-fd46d1830152.sql
20260614142901_370bc286-f1fc-4cff-8e6d-1d7b9158c88e.sql
20260614143607_6f62785a-041f-4a70-8c00-66eefc9abe41.sql
20260618000000_legacy_import_staging.sql
20260619000000_destructive_delete_rpcs.sql
```

### 2.3 Redundantné overlap páry (idempotentné, ale zbytočné na fresh)

| Staršia | Novšia (autoritatívna) | Čo sa prekrýva |
|---------|------------------------|----------------|
| `20260618550000_app_role_owner_enum.sql` | `20260619000001_rbac_owner_administrator.sql` | `ADD VALUE owner/administrator` |
| `20260617000000_admin_auth_user_directory_rpc.sql` | `20260623100000_owner_user_management_gates.sql` | `admin_list_auth_users()` — stará verzia gate `has_role(admin)`, nová `is_crm_owner()` |
| `20260610130000_entity_linking_batch_e.sql` | `20260624100000_commissions_source_marketing_task.sql` | `commissions.source_type` CHECK — starší užší, novší rozšírený |
| `20260613124214_*` | `20260615000000_rc6_team_profit_communication.sql` | `team_profiles` + súvisiace — `13124214` používa `IF NOT EXISTS` / `DROP POLICY IF EXISTS`, `15000000` je kratší variant |

Na existujúcom remote obe prešli; v baseline stačí **finálny stav** (jedna definícia).

### 2.4 Seed / ops migrácie (mimo baseline)

| Súbor | Typ | Riziko na fresh DB |
|-------|-----|-------------------|
| `20260610031204_313a5175-0c8f-4754-9740-663acef2e9ba.sql` | **Ops seed** | Hardcoded UUID `c4d428dd-...`, email `maros@salelogics.sk`, reset hesla — FK na neexistujúceho `auth.users` |
| `20260611100100_customers_email_backfill.sql` | Data backfill | `INSERT INTO customers` z existujúcich leads — OK na prázdnom DB, zbytočné |
| `20260624120000_crm_implementer_registry.sql` | Seed + schema | `INSERT INTO crm_implementers` s konkrétnymi menami |
| INSERT bloky v `12135956` / `15001857` | Legacy finance import | Backfill `payment_records` / `cost_records` z `rental_payments` |

**Odporúčanie:** v baseline **nie sú** — presunúť do `supabase/seeds/` alebo `docs/` runbook (manuálne / repair skip).

### 2.5 Historické / podozrivé (ponechať v archíve, nie v baseline)

| Súbor | Poznámka |
|-------|----------|
| `20260427131405_b721ba79-cef0-4d44-be92-33982f3903fe.sql` | Hromadný `UPDATE auth.users` na NULL tokeny — jednorazový auth fix |
| `20260525162327_ee83faaa-d3af-4773-b089-3c719d32815a.sql` | Veľká konsolidácia RLS → `private.has_role` (prepis starých policies) |
| `20260606231227_541806da-16c5-4ba7-b0fb-5588077ae331.sql` + `20260606231237_*` | Pár revoke grantov na trigger funkciách |
| `20260622100000_restore_private_has_role_rls_grant.sql` | Oprava po RBAC migrácii — nutná pre správne RLS |
| `20260615002327_4c4d7185-318e-4777-8785-cd47933ddb41.sql` | Doplnkový hardening destructive RPC — **nie** duplicita, ponechať v logike baseline |

### 2.6 Základ CRM schémy (pred finance vlnou)

33 súborov `20260310010549` → `20260606231237` — počiatočné tabuľky (`leads`, `rental_websites`, `commissions`, …), RLS evolúcia, `private` schema.  
V baseline sa zlúčia do jedného dumpu; jednotlivo zostanú v archíve.

---

## 3. Odporúčaná baseline stratégia

### Princíp: dva režimy, jeden repo

| Režim | Kedy | Čo beží |
|-------|------|---------|
| **Legacy track** | Existujúce remote projekty (personal, team po cutoveri) | História v `schema_migrations` sa **nemení**, SQL sa **znova nespúšťa** |
| **Baseline track** | Nové Supabase projekty od cutoveru | Jeden súbor `20260701000000_baseline_schema.sql` + budúce inkrementálne migrácie |

**Nekombinovať** v `supabase/migrations/` súčasne 90 historických súborov + baseline — nové projekty by opakovali duplicity.

### Názov baseline súboru (návrh)

```
supabase/migrations/20260701000000_baseline_schema.sql
```

### Obsah baseline

Vygenerovať zo **zosúladeného** remote projektu (schema-only dump):

```powershell
cd d:\web-rent-wizard-759d8d0e
npx supabase link --project-ref <SYNCED_PROJECT_REF>

# Návrh — overiť presné flagy podľa `npx supabase db dump --help`
npx supabase db dump --linked `
  -f supabase/migrations_archive/drafts/20260701000000_baseline_schema.sql `
  --schema public,private
```

**Baseline musí obsahovať:**

- Všetky `public.*` tabuľky, typy, funkcie, RLS policies v **finálnom** stave (po `20260625200000`)
- Schema `private` (`has_role`, destructive helpers, …)
- Extensions používané v migráciách (`pgcrypto`, …)

**Baseline nemá obsahovať:**

- `INSERT` seed dáta (implementers, customer backfill, finance legacy import)
- Ops seed `20260610031204`
- `auth.users` manipulácie

**Po validácii** presunúť draft do `supabase/migrations/` pri cutoveri.

### Voliteľné seeds (mimo migrations)

```
supabase/seeds/
  README.md
  001_crm_implementers.sql          # obsah z 24120000 INSERT časti
  ops/
    SKIP_ON_FRESH.md                # dokumentácia k 10031204
```

---

## 4. Čo ponechať / čo archivovať

### Fáza 0 — iba kópia do archívu (bez zmeny `migrations/`)

Skopírovať **všetkých 90** súborov do:

```
supabase/migrations_archive/pre_baseline_20260701/
  MANIFEST.md          # zoznam + dátum + git SHA
  migrations/          # 1:1 kópie
```

`supabase/migrations/` **zostáva nezmenené** — remote `migration list` sa nerozbije.

### Fáza 1 — archive candidates (priorita pri cutoveri)

**Tier 1 — snapshot duplicity (prvé na vyradenie z active path):**

```
supabase/migrations/20260612135956_a2c221a1-3cae-4d24-a289-ddc205fd3937.sql
supabase/migrations/20260615001857_5ea1ae50-db85-4bc6-a556-09bc961f3bae.sql
supabase/migrations/20260615002114_47b4062c-096c-4932-a11e-c07a7ed4c26f.sql
supabase/migrations/20260615002310_1b99a54b-1e04-4519-93d2-4842fa1341ba.sql
```

**Tier 2 — redundantné páry (zlúčiť do baseline, nechať v archíve):**

```
supabase/migrations/20260618550000_app_role_owner_enum.sql
supabase/migrations/20260617000000_admin_auth_user_directory_rpc.sql
```

**Tier 3 — vyradiť z baseline track (seeds / ops):**

```
supabase/migrations/20260610031204_313a5175-0c8f-4754-9740-663acef2e9ba.sql
```

**Tier 4 — pri full baseline cutover archivovať zvyšných 83 súborov**

Kompletný zoznam zostávajúcich po Tier 1–3: všetky ostatné súbory v `supabase/migrations/` (pozri `MANIFEST.md` po Fáze 0).

### Po cutoveri — aktívny `supabase/migrations/`

```
supabase/migrations/
  20260701000000_baseline_schema.sql    # jediný historický súbor
  YYYYMMDDHHMMSS_*.sql                  # budúce zmeny
```

---

## 5. Presné kroky cutoveru (bez rozbitia histórie)

> **Spúšťať až po schválení Fázy 0–1 a úspešnom teste baseline na throwaway projekte.**

### Krok A — Príprava (bez zásahu do remote)

```powershell
cd d:\web-rent-wizard-759d8d0e

# 1. Záloha archívu
New-Item -ItemType Directory -Force -Path supabase/migrations_archive/pre_baseline_20260701/migrations
Copy-Item supabase/migrations/*.sql supabase/migrations_archive/pre_baseline_20260701/migrations/

# 2. Git tag pred cutoverom
git tag pre-baseline-migration-cleanup-$(Get-Date -Format yyyyMMdd)

# 3. Vygenerovať baseline DRAFT (necommitovať hneď)
New-Item -ItemType Directory -Force -Path supabase/migrations_archive/drafts
npx supabase link --project-ref <SYNCED_REF>
npx supabase db dump --linked -f supabase/migrations_archive/drafts/20260701000000_baseline_schema.sql --schema public,private
```

### Krok B — Validácia baseline (throwaway projekt)

```powershell
# Nový prázdny Supabase projekt (test only)
npx supabase link --project-ref <THROWAWAY_REF>

# Dočasne: iba baseline v migrations/
# (na test branchi — nie na main bez review)
npx supabase db push
npm test
npm run build

# Manuálny smoke: /auth, /admin, finance tabuľky existujú
```

Ak `db push` padá — baseline draft opraviť, **nie** repair na produkcii.

### Krok C — Repo cutover (git)

```powershell
# Na schválenej branchi:
git mv supabase/migrations/*.sql supabase/migrations_archive/pre_baseline_20260701/migrations/
git mv supabase/migrations_archive/drafts/20260701000000_baseline_schema.sql supabase/migrations/

git add supabase/migrations/ supabase/migrations_archive/ docs/
git commit -m "chore: squash migrations to 20260701000000 baseline"
```

### Krok D — Zosúladenie existujúcich remote projektov (bez spúšťania baseline SQL)

Pre každý **existujúci** projekt, kde už bežalo všetkých 90 migrácií:

```powershell
npx supabase link --project-ref <EXISTING_REF>

# 1. Označiť staré migrácie ako reverted (iba v schema_migrations, SQL sa nespúšťa)
#    Vygeneruj zoznam z archívu:
Get-ChildItem supabase/migrations_archive/pre_baseline_20260701/migrations/*.sql |
  ForEach-Object { $_.BaseName.Substring(0,14) } |
  Sort-Object -Unique |
  ForEach-Object { Write-Host "npx supabase migration repair --status reverted $_" }

# 2. Označiť baseline ako applied (bez spustenia SQL)
npx supabase migration repair --status applied 20260701000000

# 3. Overenie
npx supabase migration list
# Očakávanie: 20260701000000 Applied local + remote, žiadne Local-only
```

**Dôležité:**

- `repair --status reverted` na produkcii **ničí len záznam v `supabase_migrations.schema_migrations`**, nie tabuľky.
- Baseline SQL sa na existujúcom remote **nespúšťa** — schéma už zodpovedá finálnemu stavu.
- Robiť **po jednom** projekte; najprv team/test, potom personal/produkcia.

### Krok E — Nové projekty po cutoveri

```powershell
npx supabase link --project-ref <NEW_REF>
npx supabase db push
# → aplikuje iba baseline + novšie migrácie
# → žiadny repair na 10031204
# → auth user + grant_crm_owner_by_email() manuálne (RELEASE.md)
```

---

## 6. Riziká

| Riziko | Dôsledok | Mitigácia |
|--------|----------|-----------|
| Odstránenie snapshotov bez `repair` na remote | `migration list` mismatch, nepredvídateľný `db push` | Fáza 0 = kópia; cutover až s repair skriptom |
| Spustenie baseline SQL na existujúcom remote | `already exists` errors, čiastočný deploy | Na existujúcom remote **iba** `repair --status applied`, nie `db push` baseline |
| Baseline dump neúplný (chýba `private`, extension) | Fresh projekt bez RLS funkcií | Validácia na throwaway + `npm test` + smoke test |
| Strata seed dát v migráciách | Prázdne referenčné tabuľky na fresh | Presunúť do `supabase/seeds/` s dokumentáciou |
| Úprava obsahu už applied migrácie | drift medzi remote a git | **Nikdy** needitovať súbory v archíve; baseline je nový súbor |
| `repair --status reverted` na zlom projekte | CLI história nezhodná so skutočnosťou | Vždy `migration list` pred/po; git tag rollback |

---

## 7. Rollback plán

### Rollback repo (okamžitý)

```powershell
git checkout pre-baseline-migration-cleanup-YYYYMMDD
# alebo
git revert <cutover-commit-sha>
```

Obnoví pôvodných 90 súborov v `supabase/migrations/`.

### Rollback remote histórie (ak cutover D zlyhal)

```powershell
# Vrátiť záznamy starých migrácií ako applied:
Get-ChildItem supabase/migrations_archive/pre_baseline_20260701/migrations/*.sql |
  ForEach-Object { npx supabase migration repair --status applied $_.BaseName.Substring(0,14) }

# Odstrániť baseline záznam:
npx supabase migration repair --status reverted 20260701000000

npx supabase migration list
```

Schéma DB sa rollbackom **nemení** — opravuje sa len migračná história v CLI.

### Rollback schémy (extrémny)

Iba z Supabase dashboard backup / PITR — mimo rozsahu tohto plánu.

---

## 8. Rozhodnutia na schválenie pred exekúciou

- [ ] **Fáza 0** — vytvoriť `migrations_archive/pre_baseline_20260701/` (kópia, bez zmeny active)
- [ ] **Baseline zdroj** — dump z ktorého ref? (`kusluytpsgdrbhvaxoho` vs `qosxlmrrkyvobjigsynt`)
- [ ] **Throwaway test** — vytvoriť dočasný Supabase projekt na validáciu baseline
- [ ] **Cutover D** — poradie: najprv team, potom personal/produkcia
- [ ] **Seeds** — či presunúť `24120000` implementer INSERT do `supabase/seeds/`

---

## 9. Súvisiace dokumenty

- `supabase/DEPLOY.md` — aktuálny deploy runbook (overlap sekcia)
- `docs/supabase-migration.md` — personal → team migrácia
- `RELEASE.md` — `20260610031204` repair postup pre fresh DB
- `CLAUDE.md` — hard constraint: needitovať deployed migrácie (cutover = nový baseline, nie rewrite)

---

## Príloha A — Kompletný zoznam 90 migrácií (zoradené)

<details>
<summary>Klikni pre celý zoznam</summary>

```
20260310010549_19e4a209-54f4-4720-a1b9-abcfc018728d.sql
20260310010706_2dc4dea4-4356-45a6-b06b-ab6eccc43808.sql
20260426194526_75191a86-c750-4a4b-b7c0-a19f30e10c0a.sql
20260426194544_ebc85625-ca52-4961-ba94-56b1b7e84d8a.sql
20260426211546_d69ed2cd-b271-47e7-bfab-d80e21049c32.sql
20260426222830_85a48c90-288d-4f26-ae5f-eb1b0447cab3.sql
20260427124717_de1207fc-5330-452a-8de7-6fea51e2c49e.sql
20260427124731_ada6b3cf-6eee-4764-9d1e-f18e56c86a8d.sql
20260427131405_b721ba79-cef0-4d44-be92-33982f3903fe.sql
20260427135007_c7d71c9e-db52-4596-972c-ba74bde30360.sql
20260427135143_54d60acc-9779-4792-bfb2-a86ea006c99d.sql
20260427221807_2912be85-bd76-43a1-be8c-604616384b69.sql
20260428001845_7b38fc0b-9ca7-4a4f-b379-93589f28073f.sql
20260428002602_7d08964e-1d24-45ed-bec8-1d0af967040d.sql
20260429220152_b7d8ca33-f5ac-4a4e-9960-f9b02007f305.sql
20260429220211_e47d9eed-8018-4862-a7c0-7104327bc88f.sql
20260429222511_f5f51de1-f53f-485c-b676-824e78689a38.sql
20260430000946_6a65de61-7ce6-4c19-8324-b7cd6b63515e.sql
20260430001826_bfcf34db-78b0-4515-859d-a39cd788f921.sql
20260430003559_f3ca19f7-d1af-4b7c-9a05-1b0d4f5988ec.sql
20260503221713_ac1eb148-872a-4dbb-96c4-3325a34883ad.sql
20260503224049_285e2739-ca7c-4caf-a3e1-02795280d230.sql
20260504113104_4a902300-0c04-4fc4-99ec-ba33091f7540.sql
20260506165412_2c32d082-0cba-44a2-a4a4-18d068c245f6.sql
20260506211239_781312f7-b80c-4263-b4f7-ed566a5707ed.sql
20260506220201_8c79b259-011e-4228-9949-200bd8e23dae.sql
20260507192330_3c65a421-bc7b-46f6-9272-4fc547b3cc33.sql
20260514184806_046d6726-5b7b-4e4c-853b-f297b133120f.sql
20260516132931_ee396c32-9e9f-4604-ab1d-f81faeffd83a.sql
20260524223241_1924209a-677e-485e-b54b-fd79fe76f7de.sql
20260525161251_ffd934db-d378-4ab1-99a1-9345ab49f345.sql
20260525162327_ee83faaa-d3af-4773-b089-3c719d32815a.sql
20260525173148_a8b2130b-f56b-4577-a7b1-60198b8ef4a7.sql
20260606231227_541806da-16c5-4ba7-b0fb-5588077ae331.sql
20260606231237_00f08f07-6507-47dd-9723-3381101cb1af.sql
20260609120000_finance_payment_payout_records.sql
20260609130000_finance_cost_records.sql
20260609140000_finance_issue_dismissals.sql
20260609150000_finance_rules_hosting_governance.sql
20260609160000_finance_review_cadence.sql
20260610031204_313a5175-0c8f-4754-9740-663acef2e9ba.sql          [SEED — Tier 3]
20260610120000_commissions_payment_form.sql
20260610130000_entity_linking_batch_e.sql
20260611100000_customers_foundation.sql
20260611100100_customers_email_backfill.sql                       [DATA]
20260611120000_communication_events_f2.sql
20260611140000_communication_events_f25_hardening.sql
20260611150000_inbound_email_batch_g.sql
20260611160000_communication_ops_g5.sql
20260611170000_tasks_customer_id_batch_i.sql
20260612000000_rc2_project_ai_type.sql
20260612135956_a2c221a1-3cae-4d24-a289-ddc205fd3937.sql          [SNAPSHOT — Tier 1]
20260613000000_rc4_project_credentials.sql
20260613124214_26a66378-dac2-404a-a45c-c3237bff4198.sql
20260613125139_4e900c71-4f33-49f7-9665-e0417650dc4a.sql
20260614000000_rc5_rental_customer_identity.sql
20260614142818_14433de5-40dd-4ef6-a33d-fd46d1830152.sql
20260614142901_370bc286-f1fc-4cff-8e6d-1d7b9158c88e.sql
20260614143607_6f62785a-041f-4a70-8c00-66eefc9abe41.sql
20260615000000_rc6_team_profit_communication.sql
20260615000001_rc6_summary_upsert_policy.sql
20260615001857_5ea1ae50-db85-4bc6-a556-09bc961f3bae.sql          [SNAPSHOT — Tier 1]
20260615002114_47b4062c-096c-4932-a11e-c07a7ed4c26f.sql          [SNAPSHOT — Tier 1]
20260615002310_1b99a54b-1e04-4519-93d2-4842fa1341ba.sql          [SNAPSHOT — Tier 1]
20260615002327_4c4d7185-318e-4777-8785-cd47933ddb41.sql
20260615083003_faac7fd9-9d49-4b46-9f9b-f7d54258304a.sql
20260616000000_rc66_audit_trail_governance.sql
20260617000000_admin_auth_user_directory_rpc.sql                  [OVERLAP — Tier 2]
20260618000000_legacy_import_staging.sql
20260618550000_app_role_owner_enum.sql                            [OVERLAP — Tier 2]
20260619000000_destructive_delete_rpcs.sql
20260619000001_rbac_owner_administrator.sql
20260619050000_marketing_records.sql
20260619100000_rls_owner_administrator.sql
20260620000000_customers_active_flag.sql
20260620100000_lead_destructive_precheck_l1.sql
20260620110000_lead_destructive_execute_l2.sql
20260621100000_crm_owner_bootstrap_helper.sql
20260622100000_restore_private_has_role_rls_grant.sql
20260623100000_owner_user_management_gates.sql
20260624100000_commissions_source_marketing_task.sql
20260624120000_crm_implementer_registry.sql                       [SEED]
20260624200000_entity_agreed_fee.sql
20260625100000_tasks_parent_model.sql
20260625200000_lead_logs_scoped_read.sql
```

</details>
