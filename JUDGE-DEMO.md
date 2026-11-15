# 3-minute judge walkthrough

## Story

Lakshmi is a synthetic 72-year-old patient. Her daughter Meena and caregiver Revathi coordinate care with her. NalamLink does not stop at a reminder: it records the task, the response and the handoff.

## Walkthrough

1. **Patient overview (25 sec):** show today's medication timeline, appointment and pending care items.
2. **Medication integrity (30 sec):** add or edit a medicine, show generated dose events, record a dose outcome, refresh and show the state persisted. Explain that repeated confirmation does not decrement stock twice.
3. **Family collaboration (25 sec):** switch to family/caregiver demo role and show shared patient data, assigned tasks and the care circle. In Supabase mode, demonstrate a real invitation only if you have configured two test accounts.
4. **Care continuity (35 sec):** open Care Intelligence. Explain an unresolved missed dose, overdue task, low-stock threshold or handoff signal and point to the underlying record. Show the next action, not just a red warning.
5. **Wellbeing and handoff (25 sec):** submit a check-in and create/acknowledge a caregiver handoff. Show the activity history.
6. **Appointment intelligence (20 sec):** generate a visit brief from the recorded medication, dose, task and check-in history.
7. **Mitra and Care Passport (20 sec):** ask for a summary; clearly identify whether it is rules-based or uses a configured provider. Export the Care Passport.
8. **Trust (20 sec):** open `/api/health` and state honestly whether the deployment uses temporary demo storage or Supabase persistence, and which optional integrations are configured.

## Key message

"Most apps send a reminder. NalamLink closes the care loop: it identifies what needs attention, shows who is responsible, records the response and keeps the family coordinated."

## Do not claim

- Do not call demo role switching secure authentication.
- Do not claim the local JSON demo store is durable.
- Do not claim email, AI, OCR or scheduled dispatch is live unless configured and tested.
- Do not describe care signals as medical diagnoses or predictive risk scores.
- Do not use real patient information in a public hackathon demo.


## 3.1 visual presentation upgrades

- Start on the redesigned Overview: introduce the patient, highlight today's care pulse, show the adherence ring and review the medication timeline.
- Open **Insights & reports** and switch between 7D, 30D and 90D. Explain that charts are derived from recorded dose outcomes, while dates with no outcomes are not treated as confirmed adherence.
- Demonstrate medication inventory thresholds, caregiver task distribution and patient-reported check-in summaries.
- Use the workspace search to find a medication, appointment or care task without opening each section.
- Export the CSV report and explain that it contains records already stored in this demo workspace.
