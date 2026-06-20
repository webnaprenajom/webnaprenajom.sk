# Lokálny prepínač na TEAM Supabase

> Safety-first: mení len gitignored env súbory na tvojom PC. Produkcia / Lovable / remote Supabase sa týmto krokom nemení.

## Framework

**Vite + React** (`npm run dev` → `vite`, port **8080**)

Klient: `src/integrations/supabase/client.ts`  
Env loader: `vite.config.ts` (`loadEnv` + `import.meta.env`)

## Upravené súbory (lokálne)

| Súbor | Zmena |
|-------|-------|
| `.env` | Aktívny dev → **team** projekt `qosxlmrrkyvobjigsynt` |
| `.env.team` | Sync s team URL + anon JWT |
| `.env.local` | Komentáre (prázdny override) |
| `.env.personal` | **Bez zmeny** — záloha osobného projektu |

**Nemenené (už správne):**

- `src/integrations/supabase/client.ts` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `vite.config.ts` — akceptuje aj `VITE_SUPABASE_ANON_KEY` ako alias
- `package.json` — `dev:personal` / `dev:team` skripty

## Env premenné — čo doplniť

### Browser (povinné pre `npm run dev`)

| Premenná | Team hodnota | Kde |
|----------|--------------|-----|
| `VITE_SUPABASE_URL` | `https://qosxlmrrkyvobjigsynt.supabase.co` | `.env` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon JWT z dashboardu (Settings → API → anon public) | `.env` |

Alias: `VITE_SUPABASE_ANON_KEY` — `vite.config.ts` ho berie namiesto publishable key, ak je nastavený.

### Server-side / CLI (voliteľné lokálne)

| Premenná | Kedy | Poznámka |
|----------|------|----------|
| `SUPABASE_URL` | `scripts/migration/*`, Supabase CLI | Rovnaká URL ako vyššie |
| `SUPABASE_SERVICE_ROLE_KEY` | migration import, nie frontend | Dashboard → API → service_role — **nikdy do browsera** |

Edge Functions používajú secrets v Supabase dashboarde, nie `.env` v prehliadači.

## Spustenie lokálneho dev (team)

```powershell
cd d:\web-rent-wizard-759d8d0e
npm run dev
```

Alternatíva (explicitný team mode — načíta `.env.team`):

```powershell
npm run dev:team
```

App: http://localhost:8080

## Návrat na starý osobný projekt

**Možnosť A — npm script (bez úpravy `.env`):**

```powershell
npm run dev:personal
```

Načíta `.env.personal` (`kusluytpsgdrbhvaxoho`).

**Možnosť B — prepísať `.env`:**

Skopíruj obsah z `.env.personal` do `.env`, alebo odkomentuj personal blok v `.env`.

**Možnosť C — `.env.local` override:**

Nastav personal `VITE_SUPABASE_*` v `.env.local` (má prioritu nad `.env`).

## Overenie, že bežíš na team projekte

1. DevTools → Application → localStorage — po prihlásení session patrí team Auth.
2. `/admin` — dáta z team DB (nie starý personal sandbox).
3. V `.env` over `VITE_SUPABASE_URL` obsahuje `qosxlmrrkyvobjigsynt`.

## Čo sa necommituje

`.env`, `.env.local`, `.env.personal`, `.env.team` — všetko je v `.gitignore`.

Šablóna bez tajomstiev: `.env.example`

## Súvisiace docs

- `docs/supabase-migration.md` — migrácia personal → team
- `RELEASE.md` — produkčné env (Lovable)
