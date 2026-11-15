# Deploy NalamLink AI free — quick path

## Fastest public demo (Render only)

1. Push this folder to a public GitHub repository.
2. Open https://dashboard.render.com/ and sign in with GitHub.
3. Select **New → Blueprint**.
4. Choose the repository containing `render.yaml`.
5. Review `nalamlink-ai`, keep the **Free** plan and create it.
6. Wait for the deployment to become **Live**.
7. Copy the `https://...onrender.com` URL and test it in a private browser window.

No Google Cloud project or credits are used. The service starts in demo mode with synthetic data. Render Free sleeps after 15 minutes of inactivity, so the first visit after sleeping may take about a minute. Demo JSON data is temporary on this plan.

## Persistent accounts and data (Render + Supabase Free)

1. Create a Supabase Free project at https://supabase.com/dashboard.
2. Run `supabase/migrations/001_nalamlink_schema.sql` in its SQL Editor.
3. Copy the Supabase project URL, public anon/publishable key and server-only secret/service-role key.
4. Add the values in Render → service → Environment:

```text
DEMO_MODE=false
DATA_MODE=supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
SUPABASE_SECRET_KEY=YOUR_PRIVATE_SECRET_KEY
TZ=Asia/Kolkata
```

5. Save and redeploy. Register an account in NalamLink, create a patient profile, then invite a family/caregiver account.
6. Confirm `/api/health` reports `mode: production` and `dataMode: supabase`.

Read `SUPABASE_SETUP.md` for details about authentication, RLS and secret handling.

## Optional integrations

- **Mitra AI:** add `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` for an OpenAI-compatible provider. Rules-based summaries work without these.
- **Email:** add `RESEND_API_KEY` and a verified `EMAIL_FROM` address. In-app alerts work without email.
- **OCR:** Tesseract.js runs locally; no Google Vision credentials are needed.
- **Scheduled dispatch:** add `CRON_SECRET` and use an external HTTPS cron service to call `/api/cron/dispatch`.

Do not put secret keys in GitHub or frontend variables. Use synthetic data for the hackathon demo.
