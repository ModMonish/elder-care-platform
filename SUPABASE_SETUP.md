# Supabase Free setup

This is optional for a synthetic public demo. It is recommended if you want persistent data and real email/password accounts without Google Cloud.

## 1. Create a Supabase project

1. Open https://supabase.com/dashboard and create a Free project.
2. Choose a strong database password and save it securely.
3. Wait for the project to finish provisioning.

## 2. Create the database schema

1. Open **SQL Editor** in the Supabase dashboard.
2. Open `supabase/migrations/001_nalamlink_schema.sql` from this repository.
3. Paste the full SQL into a new query and run it.
4. Confirm that `nl_patients`, `nl_records` and the four `nl_*` RPC functions exist.

The tables have Row Level Security enabled and no direct `anon`/`authenticated` table policies. The Express API uses the server-only secret key after verifying the user's Supabase access token and checking patient membership. Do not add broad public table policies.

## 3. Enable authentication

1. Open **Authentication → Providers → Email**.
2. Enable email/password sign-in.
3. For a controlled hackathon demo, you may disable email confirmation to avoid waiting for confirmation emails. For real deployments, keep confirmation enabled and configure a suitable SMTP provider.
4. Set the site's URL to your Render URL under **Authentication → URL Configuration**.

## 4. Copy API keys

In **Project Settings → API** (or **API Keys**, depending on dashboard version), copy:

- Project URL → `SUPABASE_URL`
- Publishable/anon key → `SUPABASE_ANON_KEY`
- Secret key (or legacy `service_role` key) → `SUPABASE_SECRET_KEY`

The publishable/anon key is safe to expose as browser configuration when RLS is enabled. The secret/service-role key is privileged and must remain server-side.

## 5. Configure Render

In Render → your `nalamlink-ai` service → **Environment**, add:

```text
DEMO_MODE=false
DATA_MODE=supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
TZ=Asia/Kolkata
OCR_ENABLED=true
```

Save changes and trigger a redeploy. Check `https://YOUR_RENDER_URL/api/health` and confirm:

```json
{
  "status": "ok",
  "mode": "production",
  "dataMode": "supabase"
}
```

The health response also reports which optional integrations are configured; it does not guarantee that a third-party provider will accept a request.

## 6. Test account and invitation flow

1. Register a user in the application.
2. Create a patient care profile.
3. Create an invitation for a family member or caregiver.
4. Register/sign in using the invited email address.
5. Accept the six-digit invitation code.
6. Verify that the new member appears in the care circle.
7. Sign out and sign in as the invited member; verify that only the authorized patient workspace is visible.

## Key handling

- Never commit `.env`.
- Never put `SUPABASE_SECRET_KEY` in frontend variables or browser bundles.
- Rotate a key immediately if it is pasted into GitHub, a public issue or a screenshot.
- Use synthetic information for judging; this schema is not a certified medical record system.
