## Chosen Vertical
Elderly Care & Medication Management Platform. NalamLink AI helps elderly people, family members and caregivers manage medicines and doctor appointments together, while the elder stays at the centre of their own care.

## Approach and Logic
- **Care circle with roles:** patient, family and caregiver can add and edit records. Clinicians have read-only access. Members join through a 6-digit invitation code that expires in 24 hours and is stored only as a hash.
- **Dose tracking:** each medication creates scheduled doses. If a dose is not confirmed within a grace period (default 30 minutes, set by DOSE_GRACE_MINUTES), it becomes "missed" and the care circle is notified.
- **Reminders:** members are notified about doses due within 10 minutes, missed doses, and appointments within 24 hours. Each notification has a unique ID, so the same alert is never sent twice.
- **Mitra AI (Gemini):** builds daily summaries and doctor-visit briefs from the recorded care data only. It never diagnoses or changes medication. If the AI provider fails, a grounded local summary is shown instead.
- **Safety and security:** input validation, rate limiting, secure headers, and API keys kept only on the server in environment variables.
- **Accessibility:** large readable layout and a voice read-aloud option for answers.

## How It Works
1. Open the app and pick a role (demo mode uses synthetic data).
2. Add medications and appointments, and mark doses as taken.
3. Missed doses trigger follow-up notifications for family and caregivers (email when configured).
4. Ask Mitra for a care summary or an appointment brief.
5. Export a Care Passport to share with a doctor.

## Assumptions
- The public demo runs in demo mode with synthetic data only. No real patient data is used.
- Email uses the Resend free test sender, which can deliver only to the account owner's address until a domain is verified.
- Scheduled reminders need an external cron call with CRON_SECRET, because the free host sleeps when idle.
- The app gives reminders and summaries, not medical advice. Users must follow the prescribing doctor's instructions.
- Prescription OCR text must be checked against the original prescription.

---# NalamLink AI 3.1 — Connected Elderly Care Operations Platform

**A multi-layer care coordination product, deployable without Google Cloud credits.**

NalamLink connects an elderly patient, their family and caregivers around medication routines, wellbeing check-ins, appointments, shared tasks and follow-through. The product is designed around a simple principle: a reminder is not the same as completed care. Every important care loop should have an owner, a response and a visible history.

> Hackathon prototype notice: use synthetic data only. This is not a medical device, emergency monitoring service, electronic health record or substitute for a clinician. Never use it to prescribe, change doses or make clinical decisions.

## Deployment choices

### Recommended: Render + Supabase Free

- **Render** hosts the complete React + Express application and provides the public HTTPS URL.
- **Supabase** optionally provides PostgreSQL persistence and email/password authentication.
- No Google Cloud project, Cloud Run, Cloud Build or Google Cloud credits are required.
- The public demo can run without configuring AI, email or Supabase. For durable shared data, connect a Supabase Free project.

The repository includes a Render Blueprint (`render.yaml`). Render can create the Node web service directly from the GitHub repository.

### Free-tier caveats

- Render Free web services sleep after 15 minutes without traffic and can take around a minute to wake. Their filesystem is ephemeral, so demo JSON changes can disappear after a restart, spin-down or redeploy.
- Supabase Free currently includes a 500 MB database and pauses projects after one week of inactivity. Review the current plan limits before relying on it.
- For persistent judging data, configure Supabase as described below. Free tiers are suitable for a hackathon prototype, not guaranteed production healthcare hosting.

## Product layers

### 1. Patient experience
- Today's care overview and medication timeline.
- Large, clear medication actions and patient-entered dose outcomes.
- Tamil/English preference field and voice-friendly Mitra read-aloud controls.
- Daily wellbeing check-in with optional note.

### 2. Medication intelligence
- Medication creation, editing, schedule generation and active/inactive status.
- Individual dose events with pending, taken, missed and skipped states.
- Idempotent dose confirmation and unit-aware stock deduction (including fractional liquid quantities).
- Reconciliation of future pending dose events when a medication schedule is edited.
- Low-stock thresholds and refill review prompts.
- Local Tesseract OCR endpoint for prescription image text extraction; extracted text is a draft and must be verified by a human.

### 3. Family care circle
- Patient, family, caregiver and clinician roles.
- Expiring six-digit invitation codes, hashed before storage and optionally bound to an email.
- Patient-level membership checks on API requests.
- Revocation of care-circle access.
- Shared notifications and care activity history.

### 4. Care continuity engine
- Detects pending doses that pass the configured grace period.
- Escalates missed-dose follow-up to family/caregivers.
- Deduplicates scheduled notifications and uses delivery leases to avoid concurrent duplicate sends.
- Tracks notification email attempts and status.
- Appointment reminder workflow and protected scheduled-dispatch endpoint.
- Dose outcomes are transactional in Supabase so stock is not decremented twice by duplicate confirmation requests.

### 5. Caregiver operations
- Shared care tasks with assignment, priority, due date and completion state.
- Caregiver handoffs with recipient acknowledgement.
- Daily patient check-ins and help-request notifications.
- Caregiver workload summary and recent activity history.

### 6. Care intelligence
- Seven-day medication adherence trend.
- Explainable care signals with evidence, severity and suggested next action.
- Unresolved missed doses, overdue tasks, low stock, pending handoffs and near-term appointments.
- Appointment visit brief generated from recorded medication, dose, task, check-in and event history.
- Care Passport JSON export.

### 7. Insights & reporting studio
- Visual 7/30/90-day adherence trend controls with an SVG line chart and clear recorded-outcome definitions.
- Dose outcome composition for taken, missed, skipped and pending events.
- Medication stock visualization against each record's configured refill threshold.
- Caregiver open-task distribution and patient-reported check-in summary.
- Downloadable CSV report containing medication records, dose outcomes, appointments, tasks and check-ins.
- Cross-record search across medicines, appointments, tasks and recent activity from the workspace header.

### 8. Mitra assistant
- Uses only the authorized care workspace data supplied by the backend.
- Rules-based grounded summary works without an AI API key.
- Optional OpenAI-compatible model provider can be configured using server-side environment variables.
- The assistant is non-diagnostic and must not prescribe, alter dosage, infer that a medicine was taken or recommend an extra dose.

## Visual upgrade in v3.1
The overview now uses a visual care-pulse hero, adherence ring, clearer metric cards, daily timeline status and an enhanced weekly trend. The new **Insights & reports** navigation item provides the deeper analytics workspace. Search and CSV export are client-side features and use only records already loaded for the signed-in/demo user.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

For a production-style local run:

```bash
npm test
npm run build
npm start
```

Open `http://localhost:8080`.

The default is a synthetic demo workspace. The demo role switcher is for judging walkthroughs only; it is not authentication and must not be used for real patient data.

## Deploy on Render — no Google Cloud credits

1. Download/extract this repository and push its contents (not the ZIP file) to a public GitHub repository.
2. Open <https://dashboard.render.com/> and sign in with GitHub.
3. Choose **New → Blueprint** and select your `nalamlink-ai` repository.
4. Render detects `render.yaml`. Review the service named `nalamlink-ai` and select the **Free** plan.
5. Create the service and wait for the build/deploy to finish.
6. Open the Render service page and copy its `https://...onrender.com` URL.
7. Open the URL in a private/incognito browser window and test `/api/health`.

The Blueprint defaults to `DEMO_MODE=true` and `DATA_MODE=demo`, so it does not need a Supabase project to display the synthetic hackathon walkthrough. This demo store is temporary on Render Free because its filesystem is ephemeral.

### Persistent mode: connect Supabase Free

For persistent data and real accounts, follow [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md), then set these variables in Render → Environment:

```text
DEMO_MODE=false
DATA_MODE=supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SECRET_KEY
```

If your Supabase dashboard uses the legacy `service_role` key, set `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_SECRET_KEY`.

Never put the secret/service-role key in GitHub, browser code, `VITE_*` variables or screenshots. The public anon key is delivered to the browser; the secret key stays on the server.

## Optional integrations

### AI provider

Mitra works with a rules-based grounded summary without any external AI credential. To enable a model, configure an OpenAI-compatible endpoint in Render environment variables:

```text
AI_API_KEY=your_provider_key
AI_BASE_URL=https://provider.example/v1
AI_MODEL=provider-model-name
```

The backend sends a constrained prompt and authorized care summary. Do not use a model response as a medical decision.

### Email notifications

The application supports the Resend HTTPS API, avoiding SMTP ports that some free hosts block:

```text
RESEND_API_KEY=your_resend_key
EMAIL_FROM=NalamLink <verified-sender@your-domain.example>
```

The sender address/domain must be verified with the provider. Until configured, notifications are in-app only and the application reports email as unavailable.

### OCR

OCR uses Tesseract.js locally in the Node service. No Google Cloud Vision project is needed. The first scan can take longer while the English OCR model is fetched. Prescription text is not automatically converted into a medication order; a person must compare it with the original and approve the fields.

### Scheduled reminders

The API exposes a protected `POST /api/cron/dispatch` endpoint. Set a long random `CRON_SECRET`, then configure a free external HTTPS cron service (for example, cron-job.org) to call the endpoint every five minutes with:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

Do not expose the cron secret in frontend code. Scheduled dispatch is not active merely because the endpoint exists; verify the health/settings indicators and the cron provider's execution history.

## GitHub upload

From the extracted project directory:

```bash
git init
git add .
git commit -m "NalamLink AI 3.0 - multi-layer care platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nalamlink-ai.git
git push -u origin main
```

GitHub Actions runs tests and a production build on pushes and pull requests to `main`.

## Demo walkthrough for judges

Read [`JUDGE-DEMO.md`](JUDGE-DEMO.md). The strongest story is:

1. Show Lakshmi's synthetic patient dashboard and medication schedule.
2. Record a dose outcome and show the dose timeline and stock update.
3. Switch to the family/caregiver role and show the shared care circle.
4. Submit a wellbeing check-in and create/acknowledge a caregiver handoff.
5. Open Care Intelligence and explain each rule-based signal from its source record.
6. Generate an appointment brief and export the Care Passport.
7. Ask Mitra for a care summary and show whether the answer is rules-based or from the configured AI provider.
8. Open `/api/health` and accurately describe which integrations are configured.

## API overview

- `GET /api/health` — service mode and configured integrations.
- `GET /api/settings` — deployment settings indicator.
- `GET /api/bootstrap` — current user and care workspace.
- `GET /api/patients/:patientId/analytics` — analytics and explainable care signals.
- `POST /api/patients` — create patient profile (authenticated mode).
- `POST /api/patients/:patientId/medications` — create medicine and dose events.
- `PATCH /api/patients/:patientId/:collection/:recordId` — update supported records.
- `POST /api/patients/:patientId/checkins` — wellbeing check-in.
- `POST /api/patients/:patientId/handoffs` — create caregiver handoff.
- `POST /api/patients/:patientId/handoffs/:handoffId/acknowledge` — acknowledge handoff.
- `POST /api/patients/:patientId/ai/summary` — Mitra summary.
- `POST /api/patients/:patientId/ocr/extract` — local OCR.
- `GET /api/patients/:patientId/appointments/:appointmentId/brief` — appointment preparation brief.
- `GET /api/passport/:patientId` — Care Passport data.
- `POST /api/cron/dispatch` — protected scheduled dispatch.

## Verification before submission

- [ ] `npm install` completes.
- [ ] `npm test` passes.
- [ ] `npm run build` completes.
- [ ] Render deployment shows Live.
- [ ] Public URL opens in an incognito window.
- [ ] `/api/health` shows the expected `mode` and `dataMode`.
- [ ] Demo role switching is clearly identified as demo-only.
- [ ] Dose confirmation does not deduct stock twice.
- [ ] Invitation expiry and email binding work in Supabase mode.
- [ ] No secret keys or real patient information are committed.
- [ ] Any optional AI/email/OCR integration is only claimed as live if it has been tested.

## License and responsible use

Hackathon prototype. Use synthetic records only. Before any real-world deployment, obtain appropriate clinical, legal, privacy, security and accessibility review, and implement the applicable healthcare data-protection requirements for the deployment jurisdiction.
