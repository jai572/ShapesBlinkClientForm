# Shape Blink & Brow — Consultation Portal

Next.js port of the original single-file Google Apps Script consultation app. Two surfaces:

- `/intake` — public client consultation form (personal details, medical history, treatment setup, signature, consent)
- `/console` — admin records vault, gated by a PIN that signs into a real Supabase Auth session server-side (see "Admin login" below)

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase: Postgres (`consultations` table) + Storage (`signatures` bucket) + Auth (admin login)
- Deploy target: Vercel

## One-time setup

1. **Supabase project**
   - Create a new project at supabase.com.
   - In the SQL editor, run the migrations in `supabase/migrations/` in order (creates the table, RLS policies, and the private `signatures` storage bucket).
   - Under Authentication → Users, manually create one admin account (email + password) — this is the real account the PIN signs into. Leave public sign-ups disabled; there is no sign-up page by design.
   - Copy the Project URL and `anon` public key from Project Settings → API.

2. **Environment variables** — copy `.env.example` to `.env.local` for local dev, and set the same keys in Vercel (Project Settings → Environment Variables):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ADMIN_PIN=
   ADMIN_EMAIL=
   ADMIN_PASSWORD=
   ```
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` must match the admin account created above exactly — the PIN is just a faster front door onto that same real login.

3. **Deploy to Vercel**
   - Import this GitHub repo in the Vercel dashboard (New Project → import `jai572/ShapesBlinkClientForm`).
   - Framework preset: Next.js (auto-detected), no build config needed.
   - Add the environment variables above, then deploy.

## Local development

```
npm install
npm run dev
```

## Admin login

`/console/login` takes a single PIN (`ADMIN_PIN`). A server action checks it, and only if correct, signs into the real Supabase Auth account via `ADMIN_EMAIL`/`ADMIN_PASSWORD` (both server-only env vars, never sent to the browser). RLS still enforces authorization off that real session — the PIN never bypasses it directly.

This trades some security for speed of entry: a 6-digit PIN is a much smaller keyspace than a real password, so it's more exposed to repeated guessing. The login has a basic 800ms server-side delay per attempt as a minimal throttle, but that's best-effort on Vercel's serverless functions, not a real lockout. Treat this as a temporary/convenience setup, not the intended long-term posture — change `ADMIN_PIN` in Vercel's env vars (no code change needed) whenever it needs rotating.

## Notes on what changed from the original

- The client-side hardcoded admin PIN (`VAULT_PASSWORD`) from the original Kaaya app has been replaced with a server-verified PIN backed by real Supabase Auth — the original was visible in browser devtools/view-source and provided no actual access control.
- Signature images are uploaded to a private Supabase Storage bucket instead of being embedded as base64 blobs in the database row.
- PDF export is unchanged in spirit (client-side `jspdf` + `jspdf-autotable`), now pulling data from Supabase instead of Google Sheets.
