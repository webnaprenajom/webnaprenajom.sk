# webnaprenajom.sk — CRM + marketing site

React + Vite + Supabase CRM with finance foundation, admin modules, and public marketing pages.

**Go-live / deploy:** see [RELEASE.md](./RELEASE.md) for migrations, env vars, smoke tests, and GitHub checklist.

## Project info

**Lovable URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## Local setup

```sh
git clone <YOUR_GIT_URL>
cd remix-of-webnaprenajom.sk
npm ci
cp .env.example .env.team   # fill team/personal Supabase keys (see docs/supabase-migration.md)
npm run dev:team            # or: npm run dev / npm run dev:personal
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (default port 5173) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |

### Supabase

1. Link your Supabase project.
2. Apply migrations: `supabase db push` (see [RELEASE.md](./RELEASE.md) for finance migration order).
3. Set Edge Function secrets in Supabase dashboard (`RESEND_API_KEY`, etc.).

### Admin routes

| Route | Module |
|-------|--------|
| `/admin` | Leads pipeline |
| `/admin/customer/:key` | Customer detail |
| `/admin/finance` | Finance overview, records, reconciliation, governance |
| `/admin/rentals` | Rental websites & payments |
| `/admin/commissions` | Commissions & expenses |
| `/admin/tasks` | Tasks |
| `/admin/wheel-leads` | Wheel leads |

Full smoke test checklist: [RELEASE.md § Smoke test](./RELEASE.md#4-smoke-test-checklist).

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
