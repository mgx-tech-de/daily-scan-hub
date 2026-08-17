# Fix: QR never loads on the deployed app + confirmation email points to localhost:3000

## What is actually wrong

**1. The QR code spins forever**
The daily QR code is generated on the server, and that server code needs three
environment variables from your new database project:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, needed to read/create the daily QR token)

On Hostinger only the URL and the public key are set, so the QR request fails
every time. The home page has no error state, so it just keeps showing the
loading placeholder instead of telling you what failed.

**2. Confirmation email redirects to localhost:3000**
That URL comes from the new database project's Auth settings (Site URL /
Redirect URLs), which still hold the default local value. The app already asks
for a redirect back to its own origin, but the Auth config overrides/limits it.

## What you need to do (outside the code)

1. In Hostinger's environment settings for the app, add:
   - `SUPABASE_URL=https://qckyymgcttoalzzwlzeq.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY=<your anon key>`
   - `SUPABASE_SERVICE_ROLE_KEY=<service role key from the new project's API settings>`
   Then restart/redeploy the app. Never expose the service role key to the browser
   or commit it.
2. In the new database project's Auth URL configuration:
   - Site URL: your live Hostinger domain (e.g. `https://your-domain.com`)
   - Redirect URLs: add `https://your-domain.com/**` (and the preview domain if used)
   Remove `http://localhost:3000`.

## What I will change in the code

- **Home page QR**: replace the endless loading placeholder with real states —
  loading, and a clear error card ("Today's code could not be generated — the
  server is missing its database configuration") with a Retry button, so a
  misconfiguration is visible instead of an infinite spinner.
- **Server QR function**: return a clean, explicit error when the server
  environment variables are missing, instead of an opaque crash.
- **Auth confirmation**: make the signup/confirmation redirect always use the
  live app origin (`window.location.origin`) plus a `/auth` return path, so once
  the Auth URL config is corrected the link lands back in the app.
- **DEPLOYMENT.md**: document the exact Hostinger env vars and the Auth
  Site URL / Redirect URL steps above.

## Technical notes

- `getPublicKiosk`, `getOrgName`, `adminExists` all use the service-role client
  (`src/integrations/supabase/client.server.ts`), which throws when
  `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is absent — this is the single
  root cause of the stuck QR, and no code change alone can fix it without the key.
- The Lovable preview keeps using the built-in backend; these changes only
  affect your self-hosted deployment.
