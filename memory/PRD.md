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

## Backlog
- P1: AI checklist generation for new list names; AI tidy ship-log entry (Emergent Universal Key)
- P1: Multi-entry ship's log history
- P2: Crew accounts / sharing a boat across phones; multiple boats; Coast Guard trip report automation
