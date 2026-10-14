# My Boat Prep — PRD

## Original problem
User built a prototype in Google Gemini (github.com/tomreidsaiemail-ops/my-boat-prep: index.html, app-engine.js, manifest.json) and asked us to look at it. Approved plan: rebuild faithfully as a working phone-first app with real offline and cloud saving.

## Personas
Recreational skippers and crew (NZ/AU) who want boat routines on their phone at sea and printable for the on-board binder.

## Architecture
- Frontend: React (CRA) PWA — `pages/BoatPrep.jsx`, `components/boat/*`, `hooks/useBoatStore.js` (localStorage + outbox + auto-sync), `hooks/useGps.js` (watchPosition, degrees-minutes), `lib/defaults.js` (11 lists, dynamic labels), `public/sw.js` (network-first cache), `public/manifest.json`, icons.
- Backend: FastAPI `GET/PUT /api/boats/{device_id}` (MongoDB `boats`, unique device_id). No auth.

## Implemented (2026-06)
- Boat details bar (required before actions), NZ date
- 11 built-in lists with all original items; custom lists via "+"; duplicate blocking
- Tick/untick, add, edit (dialog), delete, Reset All
- Mayday/Pan Pan scripts auto-filled with vessel, callsign, live GPS; Ship Log date fill; emergency banners
- Export Current / Export All print layout (one list per page, header, sign-off line)
- Automatic offline detection, outbox banner, auto-sync + toast; per-device cloud backup
- Installable PWA, works offline
- Tested: backend 100%, frontend 100% (iteration_1)

## Iteration 2 (2026-06)
- Ship Log help text updated to user's wording + "Skipper's Tip" line
- Restored manual Status: Online/Offline toggle with "Tap to toggle" label; going online asks "Sync Cloud Database with Offline changes?" (still auto-detects real signal loss)
- Mayday position line: dropped "passed Rock"
- User declined: AI starter checklists, log history, landmark field

## Backlog
- P1: Ship Log rework: user to supply the changes lost from the Gemini version
- P1: Export/email ship's logs (from Skipper's Tip)
- P2: Crew accounts / sharing a boat across phones; multiple boats; Coast Guard trip report automation
