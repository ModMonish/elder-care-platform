# NalamLink AI 3.1 — Visual Insights Edition

## Experience and interface
- Reworked the Overview with a high-contrast care hero, care-pulse ring, quick actions and improved metric cards.
- Improved medication timeline, weekly bars, appointment and follow-up panels, activity feed and responsive layouts.
- Added a dedicated **Insights & reports** workspace.

## New interactive features
- Switch medication-outcome charts between 7, 30 and 90 days.
- Explore a line chart for recorded adherence and a donut chart for taken, missed, skipped and pending events.
- Visualize medication inventory against each medication's configured refill threshold.
- Review caregiver open-task distribution and patient-reported wellbeing check-ins.
- Search medications, appointments, care tasks and recent care events from the global workspace search.
- Export medication, dose, appointment, care-task and check-in records to CSV.

## Data and safety
- All charts are calculated from the care records loaded for the current workspace.
- Days without recorded outcomes are shown as gaps in the adherence history rather than being treated as successful or missed doses.
- No new clinical diagnosis, risk prediction or medication recommendation logic was added.
- Continue to use synthetic data for public demonstrations; confirm all clinical instructions with a qualified clinician.

## Verification
- Node server syntax checks passed.
- TypeScript/TSX transpilation syntax checks passed for the application files.
- Existing automated Node test suite: 10/10 passed.
- A full Vite/TypeScript build was not run because dependency installation did not complete in the current environment. Run `npm install` and `npm run build` in the project environment before deployment.
