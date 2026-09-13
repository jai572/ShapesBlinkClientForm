# Shape Blink & Brow — Consultation Portal

Next.js port of the original single-file Google Apps Script consultation app. Two surfaces:

- `/intake` — public client consultation form (personal details, medical history, treatment setup, signature, consent)
- `/console` — admin records vault, gated by Supabase Auth (login required)

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase: Postgres (`consultations` table) + Storage (`signatures` bucket) + Auth (admin login)
- Deploy target: Vercel

## One-time setup

1. **Supabase project**
   - Create a new project at supabase.com.
   - In the SQL editor, run `supabase/migrations/0001_init.sql` (creates the table, RLS policies, and the private `signatures` storage bucket).
   - Under Authentication → Users, manually create the admin account(s) that should be able to log into `/console`. Leave public sign-ups disabled — this app has no sign-up page by design; the console is admin-only.
   - Copy the Project URL and `anon` public key from Project Settings → API.

2. **Environment variables** — copy `.env.example` to `.env.local` for local dev, and set the same two keys in Vercel (Project Settings → Environment Variables):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

3. **Deploy to Vercel**
   - Import this GitHub repo in the Vercel dashboard (New Project → import `jai572/ShapesBlinkClientForm`).
   - Framework preset: Next.js (auto-detected), no build config needed.
   - Add the environment variables above, then deploy.

## Local development

```
npm install
npm run dev
```

## Notes on what changed from the original

- The client-side hardcoded admin PIN (`VAULT_PASSWORD`) has been replaced with real Supabase Auth — the PIN was visible in browser devtools/view-source and provided no actual access control.
- Signature images are uploaded to a private Supabase Storage bucket instead of being embedded as base64 blobs in the database row.
- PDF export is unchanged in spirit (client-side `jspdf` + `jspdf-autotable`), now pulling data from Supabase instead of Google Sheets.
