# ChronoDesk — deploying with your own Supabase project

Target project: `qckyymgcttoalzzwlzeq` (`https://qckyymgcttoalzzwlzeq.supabase.co`)

## 1. Push the code to GitHub
In the Lovable editor: **+ menu → GitHub → Connect project → Create repository**.
Sync is two-way, so later changes on either side stay in sync.

## 2. Apply the database schema
All schema, RLS policies, grants and functions live in `supabase/migrations/`.
Against the new project:

```bash
npm i -g supabase
supabase link --project-ref qckyymgcttoalzzwlzeq
supabase db push
```

(or paste each migration file, in filename order, into the SQL editor).

## 3. Configure environment variables
Copy `.env.example` to `.env` locally, or set the same variables in your host
(Vercel / Netlify / Cloudflare / Docker). The `VITE_*` values are public; the
`SUPABASE_SERVICE_ROLE_KEY` is server-only — store it as a secret, never commit it.

## 4. Auth settings
In the new project's Auth settings, add your deployed origin to
**Site URL** and **Redirect URLs**. Email/password sign-in must be enabled.

## 5. First run
Open the deployed app → **Sign in → First-run setup**, enter the setup password
to create the first administrator, then create employees from the admin panel.

> Note: the Lovable-hosted preview keeps using the built-in Lovable Cloud backend.
> The variables above take effect wherever you host the exported code yourself.
