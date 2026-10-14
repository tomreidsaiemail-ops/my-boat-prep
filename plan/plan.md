# My Boat Prep — Rebuild Plan

## What it is
A phone-first checklist and log app for skippers: pre-departure, docking, safety and emergency (Mayday / Pan Pan) checklists, a simple ship's log, and printable lamination-ready sheets.
A faithful rebuild of the Gemini prototype at github.com/tomreidsaiemail-ops/my-boat-prep, turned into a working app with real offline use and cloud saving.

## Who it's for
Recreational skippers and their crew (NZ/AU focus — NZ date format, Coast Guard trip reports) who want their boat routines on their phone, usable at sea without signal, and printable for the on-board binder.

## Core features and experience
- **Boat details bar**: Vessel name, Skipper, Callsign and today's date. These are required before checklists can be ticked, edited or exported, same as the prototype.
- **11 built-in lists**, carrying over every item exactly as written in the prototype: Leaving Dock, Returning to Dock, Arriving at Destination, Safety, Route Hazards, Crew Prep, Provisions, Ship Log, Grab Bag, May Day, Pan Pan.
- **Smart wording**: the Mayday and Pan Pan scripts fill in the vessel name, callsign and live position automatically. The Ship Log entry fills in the date.
- **Checklist actions**: tick or untick items, add your own items, edit, delete, and "Reset All" to clear the ticks. Duplicate items and duplicate list names are blocked.
- **Custom lists**: the "+" button creates new lists (e.g. "Engine").
- **Export Current / Export All**: a clean print layout with a boat details header and tick boxes, one list per page, saved as PDF through the browser's print dialog.
- **Live GPS**: the device's real position replaces the fixed coordinates in the prototype, shown in degrees and minutes. If location permission is refused, a "Position unavailable" message is shown.
- **Real offline mode**: the manual Online/Offline toggle is replaced by automatic detection. Changes made at sea are queued with an "Outbox: N unsynced changes" banner and sync automatically when signal returns. A confirmation toast shows after each sync.
- **Installable on the phone home screen** (as in the prototype's manifest). The app opens and works with no signal.
- **Look and feel**: a clean, high-contrast, marine-practical design with large touch targets that stays easy to read in sunlight. It is styled more carefully than the prototype but keeps the same layout and flow.

## Phase 1: what gets built now
- Everything listed above, working end to end.
- **No sign-in**: each phone or browser has its own private boat and lists. Data is saved automatically on the device and backed up to the cloud, so "Save My Lists" becomes automatic and that button is removed.
- **No AI features**: the prototype code contains no AI. Gemini was only used to build it. Nothing AI-powered is added in Phase 1, though AI features can come later (for example, generating a checklist for a new list name, or turning ship log notes into a tidy log entry). These would run on the Emergent Universal Key, with no API key needed.
- **Out of scope for now**: crew accounts, sharing a boat between several phones, multiple boats per user, a multi-entry ship's log history, and automatic Coast Guard trip reports.
