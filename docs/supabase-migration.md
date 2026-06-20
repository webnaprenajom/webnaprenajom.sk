# Supabase migration — personal → team project

Bezpečný postup presunu zo starého osobného projektu na nový teamový.
**Žiadny krok nižšie nemaže dáta** na starom projekte, pokiaľ ho výslovne nespustíš.

## Projekty

| | Personal (legacy) | Team (cieľ) |
|---|-------------------|-------------|
| **Project ref** | `kusluytpsgdrbhvaxoho` | `qosxlmrrkyvobjigsynt` |
| **Env súbor** | `.env.personal` | `.env.team` |
| **npm dev** | `npm run dev:personal` | `npm run dev:team` |
| **CLI link** | `npx supabase link --project-ref kusluytpsgdrbhvaxoho` | `npx supabase link --project-ref qosxlmrrkyvobjigsynt` |

## Čo projekt už používa

| Služba | Stav | Poznámka |
|--------|------|----------|
| **PostgreSQL + RLS** | Áno | ~90 migrácií v `supabase/migrations/` |
| **Auth** | Áno | `/auth`, `user_roles`, RBAC owner/administrator |
| **Storage** | Áno | bucket `contracts` (edge function `send-order-email`) |
| **Edge Functions** | Áno | 13 funkcií (email, wheel, AI, inbound webhook) |

Frontend klient: `src/integrations/supabase/client.ts` — číta `VITE_SUPABASE_*` z env.
Edge funkcie: secrets v Supabase dashboarde (`SUPABASE_*`, `RESEND_*`, `LOVABLE_API_KEY`).

---

## Fáza 0 — Príprava (hotové v repozitári)

- [x] `supabase/` priečinok s migráciami existuje
- [x] `.env.personal` — záloha starého projektu (gitignored)
- [x] `.env.team` — env pre nový team projekt (gitignored)
- [x] `.env.example` — šablóna bez tajomstiev (commitovaná)

### Supabase CLI (Windows PowerShell)

Globálna inštalácia **nie je** nutná — repo používa `npx supabase`.

Voliteľná globálna inštalácia:

```powershell
# Scoop (odporúčané)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Alebo npm global
npm install -g supabase
```

Overenie:

```powershell
npx supabase --version
```

---

## Fáza 1 — Export / sync schémy zo starého projektu

**Cieľ:** mať v `supabase/migrations/` 100 % schémy zo starého DB.

Repozitár už obsahuje migrácie. Pred ďalším krokom over, či remote sedí s lokálom.

```powershell
cd d:\web-rent-wizard-759d8d0e

# 1. Prihlásenie (otvorí browser)
npx supabase login

# 2. Link na STARÝ projekt
npx supabase link --project-ref kusluytpsgdrbhvaxoho

# 3. Porovnaj stav migrácií
npx supabase migration list
```

### Ak `migration list` ukazuje drift (remote má iné migrácie ako lokál)

```powershell
# Vygeneruje novú migráciu z rozdielu remote vs lokálny shadow DB
npx supabase db pull
```

Skontroluj nový súbor v `supabase/migrations/`, spusti `npm test` a `npm run build`.

### Ak `migration list` sedí (všetky migrácie applied na oboch stranách)

`db pull` **nie je potrebný** — schéma je už v Gite.

---

## Fáza 2 — Commit migrácií do GitHub

```powershell
git status
git add supabase/migrations/   # len ak pribudli nové súbory z db pull
git add .env.example docs/supabase-migration.md package.json supabase/DEPLOY.md
git commit -m "docs: supabase team migration env and runbook"
git push
```

**Nekomituj:** `.env`, `.env.personal`, `.env.team`, `.env.local`, service role keys.

---

## Fáza 3 — Prelinkovanie na nový team projekt

```powershell
npx supabase link --project-ref qosxlmrrkyvobjigsynt
```

Toto aktualizuje `supabase/config.toml` (`project_id`) a `supabase/.temp/` (gitignored).

Over prázdny stav:

```powershell
npx supabase migration list
# Očakávanie: všetky lokálne migrácie = not applied na novom projekte
```

---

## Fáza 4 — `db push` na nový projekt

**Spusti až po schválení.** Toto mení len **nový** team projekt.

```powershell
npx supabase db push
```

### Známy bod zlyhania na čistom projekte

Migrácia `20260610031204_*` je **ops seed** s hardcoded `auth.users` UUID.
Na prázdnom projekte zlyhá (očakávané). Postup z `supabase/DEPLOY.md`:

```powershell
npx supabase db push
# → zlyhá na 20260610031204

npx supabase migration repair --status applied 20260610031204

npx supabase db push
# → dobehne zvyšok migrácií
```

**Na produkčnom starom projekte repair nikdy nespúšťaj** — tam je migrácia už applied.

### Po úspešnom push

```powershell
npm run build
npm test
npx supabase gen types typescript --project-id qosxlmrrkyvobjigsynt > src/integrations/supabase/types.ts
```

---

## Fáza 5 — Ručná migrácia (mimo SQL migrácií)

### 5.1 Auth users (POVINNÉ)

Aplikácia používa Supabase Auth + tabuľky `user_roles`, `team_profiles`.

1. V **novom** projekte: Authentication → Users → vytvor owner účet (alebo invite).
2. SQL Editor na novom projekte:

```sql
SELECT public.grant_crm_owner_by_email('owner@example.com');
```

3. Voliteľne administrator + team profile (pozri `supabase/DEPLOY.md`).

**Auth users sa automaticky nemigrujú** cez `db push`. Možnosti:

| Metóda | Kedy |
|--------|------|
| Ručné vytvorenie + `grant_crm_owner_by_email` | Malý tím (odporúčané) |
| Supabase Auth export/import | Viac účtov, zachovať heslá (komplexné) |
| `auth.users` pg_dump | Len ak vieš čo robíš; UUID sa zmenia → treba mapovať FK |

Migrácia `20260610031204` na starom projekte obsahuje legacy seed — na novom projekte ju **preskoč** (repair), nie importuj.

### 5.2 Business data (CRM + finance)

`db push` vytvorí **prázdne tabuľky**. Dáta treba migrovať samostatne:

| Dáta | Nástroj v repozitári |
|------|----------------------|
| Legacy CSV import | `npm run migrate:legacy:staging` (staging tabuľky) |
| Produkčné dáta | `pg_dump` / `pg_restore` selektívne, alebo Supabase dashboard export |

Odporúčaný postup pre produkciu:

1. `pg_dump --data-only` zo starého projektu (public schema, bez `auth.*` ak vytváraš users nanovo).
2. Import do nového po `db push`.
3. Re-map `user_id` FK ak sa auth UUID líšia.

### 5.3 Storage

Bucket `contracts` + súbor `zmluva-original-2026.pdf` (používa `send-order-email`).

1. Dashboard → Storage → vytvor bucket `contracts` (rovnaké policies ako na starom).
2. Nahraj PDF manuálne alebo cez CLI:

```powershell
npx supabase storage cp ./zmluva-original-2026.pdf ss:///contracts/zmluva-original-2026.pdf
```

### 5.4 Edge Functions + secrets

```powershell
npx supabase functions deploy
```

V dashboarde nového projektu nastav secrets (skopíruj zo starého):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
- `LOVABLE_API_KEY`

Aktualizuj Resend webhook URL na nový project ref:
`https://qosxlmrrkyvobjigsynt.supabase.co/functions/v1/inbound-email-webhook`

### 5.5 Frontend deploy (Lovable / hosting)

Nastav env na nový projekt:

- `VITE_SUPABASE_URL=https://qosxlmrrkyvobjigsynt.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<team publishable key>`

---

## Prepínanie projektu na inom PC

```powershell
git clone <repo>
cd web-rent-wizard-759d8d0e
npm ci
cp .env.example .env.team
# vyplň SUPABASE_SERVICE_ROLE_KEY z dashboardu
npx supabase login
npx supabase link --project-ref qosxlmrrkyvobjigsynt
npm run dev:team
```

---

## Checklist pred cutover

- [ ] `migration list` na team projekte — všetko applied
- [ ] Owner login + `is_crm_owner()` = true
- [ ] Edge functions deployed + secrets
- [ ] Storage bucket `contracts`
- [ ] Business data importované (ak potrebné)
- [ ] Resend webhook URL aktualizovaný
- [ ] Lovable env prepnuté na team
- [ ] Smoke test z `RELEASE.md`

---

## Čo NIKDY nerobiť bez explicitného súhlasu

- `supabase db reset` na akomkoľvek projekte
- `db push` na starý produkčný projekt s neoverenými migráciami
- Mazanie `auth.users` alebo `legacy_import` záznamov
- Commit service role key do Gita
