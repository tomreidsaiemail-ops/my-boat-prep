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

## Iteration 3 (2026-06)
- Ship Log panel: email address field + "Email Log PDF" button (enabled only when Online)
- Backend builds PDF (reportlab), emails via Emergent managed Resend (from "My Boat Prep") with log summary + PDF download link (proxy has no attachments); title "Ship's Log - Vessel (Callsign) - Date"
- Emailed status kept with green tick, recipient, time, PDF link (synced); 10 emails/device/day limit
- Tested iteration_2: 100%

## Iteration 4 (2026-06)
- "Ship Log" renamed "Ship's Log" (auto-migrates saved data); add placeholder "My own Ship's Log..."
- Boat details: Vessel|Callsign / Skipper|Email; editable Date moved to header left of GPS (drives log, print, email date)
- Email panel button "Email Ship's Log", sends to email from top bar
- Tested iteration_3: 100%

## Iteration 5 (2026-06)
- "Email PDF" button in print view (between Save PDF and Back to Edit App) emails the current list or all lists (multi-page PDF)
- Missing email -> prompt dialog everywhere, saved to top Email field
- Removed "Checked by (Skipper) / Time" line from print + PDF
- New boat icon (sail + hull + MBP + small green tick) for header, PWA icons, favicon; toasts moved to bottom
- Tested iteration_4: 100%

## Iteration 6 (2026-06)
- Skipper's Tip wording updated
- New built-in lists: Head (Toilet) (6 items), Engine Service (9 items), placed after Provisions; auto-added to existing devices

## Iteration 7 (2026-06)
- Ship's Log panel: optional "Shore Contact" email; Ship's Log email goes to skipper + shore contact; sent tick shows both
- Engine Service panel: Engine Hours Log (hours, service date, notes; last service summary; delete entries), synced to cloud (engine_log)

## Iteration 8 (2026-06)
- Ship's Log help is collapsible ("Hide help" / "Show Ship's Log help"); stays hidden on the device until restored

## Iteration 9 (2026-06)
- "Shore Contact" tick box (same row as Sends to); Shore Contact field only shown (and only emailed) when ticked; address kept when unticked

## Iteration 10 (2026-06)
- Delete Lists: trash icon on any empty list (custom or supplied) with confirm dialog; can't delete the last list
- Restore Lists: Reset All also brings back deleted supplied lists (original items, original position); deleted_lists synced to cloud
- New supplied "My To Do List" (empty) with its own hideable help panel
- Fixed duplicate React key that left stale help panels when switching lists
- Tested iteration_5: 100%

## Iteration 11 (2026-06)
- My To Do List priorities: red flag (moves item to top + red highlight; unflag removes highlight only), up/down arrows to reorder; flags shown in print view, PDF ("FLAGGED:") and email

## Iteration 12 (2026-06)
- Reset All: confirm dialog explaining behaviour; resets all supplied lists to original items (except Ship's Log and My To Do List), restores deleted supplied lists, leaves user-created lists untouched (iteration_6 100%)
- Boat details panel collapses to one line (Vessel + Callsign + expand chevron) once Vessel/Callsign/Skipper/valid Email are entered and focus leaves the panel; stays open while incomplete (iteration_7 100%)
- Note: published version predates these; redeploy needed

## Iteration 13 (2026-06)
- Emailed PDF links now use the host the app was opened on (preview, live gemini-prototype.emergent.host, or future custom domain), validated hostname; PUBLIC_APP_URL only a fallback (iteration_8 100%)

## Backlog
- P1: Ship Log rework: user to supply the changes lost from the Gemini version
- P2: Crew accounts / sharing a boat across phones; multiple boats; Coast Guard trip report automation
