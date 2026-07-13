# Farrar Apps

Business workspace for Farrar Apps — customers, projects, invoices, and more.

## Stack

Next.js 15 · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase URL + anon key.
2. In the [Supabase Auth URL config](https://supabase.com/dashboard/project/rfzkzwrmvpdnbrvlhdmb/auth/url-configuration):
   - **Site URL:** `http://localhost:3000` (or `http://localhost:3001` if 3000 is taken)
   - **Redirect URLs:** `http://localhost:3000/auth/callback` and `http://localhost:3001/auth/callback`
3. Email confirmation is disabled for local use (`supabase/config.toml` has `enable_confirmations = false`). If new signups still ask to confirm, turn **Confirm email** off in [Auth → Providers → Email](https://supabase.com/dashboard/project/rfzkzwrmvpdnbrvlhdmb/auth/providers).
4. Run:

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually [http://localhost:3000](http://localhost:3000)). The first account created becomes **owner**.

## Logo

Place the brand mark at `public/farrar_apps_logo.png` (copied from repo root `Logo.png`).
