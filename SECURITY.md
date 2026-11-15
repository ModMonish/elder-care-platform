# Security and privacy notes

## Demo mode

- Demo mode is a public synthetic-data walkthrough with a role switcher. The selected role is sent in a request header and is not authentication.
- Never enter real patient information in demo mode.
- Demo data is stored in a local JSON file and may be lost when a free host restarts or redeploys.

## Supabase mode

- Supabase Auth access tokens are validated by the API using Supabase Auth `getUser`.
- The server checks active membership for each patient before reading or changing patient records.
- Clinician is view-only in the UI/API role policy; patient, family and caregiver roles can perform the supported write actions.
- The Supabase secret/service-role key is stored only in the Render server environment. It must never appear in the frontend bundle or repository.
- RLS is enabled on both tables, with no direct anon/authenticated policies. The API is the only intended data access path.
- Invitation codes are hashed at rest, expire and may be bound to an email address. Acceptance is a transactional RPC.

## Integrity controls

- Dose outcomes are idempotent. A repeated request does not deduct stock twice.
- Notification email claims use a lease and bounded retry count.
- Invitation acceptance checks pending status, expiry and email binding transactionally.
- Important actions create care events/audit history.
- API request bodies and uploads have size limits; API routes are rate-limited.

## AI and OCR

- AI is optional and uses a server-side key. The browser never receives the provider key.
- Mitra is a care-coordination assistant, not a clinician. It must not diagnose, prescribe, change medication instructions or recommend an extra dose.
- OCR output is untrusted draft text. A human must verify it against the original prescription before entering medication details.
- Care signals are rule-based coordination prompts, not diagnoses or validated medical risk predictions.

## Before any real-world use

This hackathon prototype has not undergone healthcare regulatory, clinical safety, penetration, privacy impact or independent security certification. Do not use it as a production healthcare record system. A real deployment needs appropriate jurisdiction-specific legal/privacy review, clinical governance, threat modelling, secure backups, incident response, access reviews, encryption/key lifecycle controls and a validated hosting plan.
