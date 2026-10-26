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

## Iteration 14 (2026-06): User tiers
- Emergent Google Sign-In required (login page, AuthCallback, cached user for offline use, waits for /auth/me when online)
- users collection with role free | beta_tester | pro; admin = ADMIN_EMAIL (tomreidsaiemail@gmail.com); /admin page to set tiers
- Boat data now per user (/api/me/boat, user_boats collection); local data claimed per account (mbp_owner)
- Pro = Stripe yearly subscription NZD 9.99 (claimable sandbox, tax mode: Stripe calculates only), checkout, status polling, webhook, cancel/resume renewal
- Pro/Beta only: Export All, Email PDF, Email Ship's Log, create own lists, hide help, unlimited To Do (free max 5); server enforces email gating
- Free tier: AdSense banner at bottom (placeholder until REACT_APP_ADSENSE_CLIENT / REACT_APP_ADSENSE_SLOT set)
- Tested iteration_9/10: 100% after fixes

## Iteration 15 (2026-06)
- Sign-out warning when unsynced offline changes exist (count, Stay signed in / Sign out anyway)
- Skipper's Tips: shared master list (db.tips) shown to all users at end of list menu; only admin can add/edit/reorder/delete (PUT /api/admin/tips); cached for offline; numbered in print/PDF; email PDF supported
- Tested iteration_11: 100% (minor UX fixes applied after)

## Iteration 16 (2026-06)
- Sign-in switched to the user's own Google OAuth client (code flow: /auth/google frontend callback -> POST /api/auth/google; state check; id_token verified; redirect host must match request host). Emergent auth removed
- BLOCKED until user registers redirect URIs in Google Cloud Console (preview currently shows redirect_uri_mismatch)
- Tested iteration_12 (backend 100%; toast fix applied after)

## Iteration 17 (2026-06)
- Email + password accounts alongside Google: register/sign-in tabs on login page, bcrypt, per-email 5-fail/15-min lockout, forgot/reset password by email (1h single-use hashed token), sessions reuse session_token cookie
- Google sign-in on an unverified password account removes that password (anti-squatting); cross-site API writes blocked by Origin check
- Tested iteration_13/14 (fixes applied: XFF-proof lockout, race-safe register/reset, no account enumeration)

## Iteration 18 (2026-06)
- Real Google AdSense enabled for free tier: REACT_APP_ADSENSE_CLIENT=ca-pub-5701201472462351, REACT_APP_ADSENSE_SLOT=8671193820 (horizontal responsive banner below lists); ads.txt + google-adsense-account meta added; strip auto-hides when Google returns no ad (e.g. preview domain)

## Backlog
- P1: Ship Log rework: user to supply the changes lost from the Gemini version
- P1: Define Beta 'early features'
- P2: Crew accounts / sharing a boat across phones; multiple boats; Coast Guard trip report automation

## Iteration 15 (2026-06): Sailing YouTube Channels & Sailing Movies
- Two shared lists at the bottom of the list selector (after Skipper's Tips); every signed-in user sees them, cached for offline viewing
- Admin only: add/edit/delete (with confirm)/reorder entries: name, link, optional one-line note (backend `media.py`, Mongo `media_lists`)
- Thumbnails fetched automatically from the link (YouTube video thumbnail, or the page's preview image e.g. channel picture / IMDb poster); default YouTube/Film icon when none; link without https:// accepted
- Tapping an entry opens the link in a new tab; Export Current / Email PDF include the list numbered
- Tested iteration_15 (backend 97%, frontend 95%); fixed: names of only spaces, link without https:// blocked by the browser, delete confirmation, redirect safety check
- Note: needs redeploy to go live

## Backlog
- P1: multi-entry Ship's Log history
- P2: automatic Coast Guard trip reports
- Future: AI checklist generation, crew accounts / shared boats / multiple boats

## Iteration 16 (2026-06): Google sign-in "Cross-site request blocked" fix
- Cause: live build talks to the API on myboatprep.com; opening the app on www.myboatprep.com or gemini-prototype.emergent.host made sign-in a cross-site POST, blocked by the same-origin guard in server.py
- Fix (frontend/src/index.js): the app redirects to the REACT_APP_BACKEND_URL host (keeps path/query) before rendering, so the page and API always share one address
- Verified on preview (normal load + Google redirect); live check needs a redeploy

## Iteration 17 (2026-06): Search engine visibility
- index.html: keyword title + description, canonical https://myboatprep.com/, Open Graph + Twitter tags, WebApplication JSON-LD (Free / Pro NZD 9.99), google-site-verification meta, better noscript
- Crawlable feature summary inside #root (replaced when React mounts, so users still see sign-in first)
- New public/og-image.jpg (1200x630 share image), robots.txt (blocks /admin, /auth/, /api/), sitemap.xml
- Worldwide wording (user choice). Needs redeploy; user then submits sitemap in Google Search Console

## Iteration 18 (2026-06): FAQ, app menu, feedback, Terms of Service, Skipper emergency ticks
- FAQ list (admin-maintained, Q/A icons, bottom of list picker): backend `faq.py` (GET /api/faq, PUT /api/admin/faq with server-side dedupe), frontend FaqList/FaqRow/FaqDialog, useFaq (offline cache), included in Export/Email PDF
- Header menu icon (AppMenu): FAQ, Submit feedback..., Terms of Service
- Feedback: POST /api/feedback (`feedback.py`), title -> subject "Feedback: <title>", body + sender details, emailed to ADMIN_EMAIL via Resend, 5/day/user, stored in db.feedback
- Terms of Service (lib/terms.js, version 2026-06): public /terms page, login page link, one-time TermsGate (stored locally first, synced via POST /api/auth/accept-terms; users.tos_version)
- May Day / Pan Pan: Skipper tick box in the banner (reminder only), saved as boat emergency_checked (kept if a client omits it), cleared by Reset All
- Header second row: Date label stacks on mobile to fit the menu icon
- Tested iteration_16: backend 100%, frontend 100%
- Terms have no business/legal name or governing law yet (user skipped); contact = admin email

## Iteration 19 (2026-06): Clone List
- Clone button next to + in ListSelector; blocked with warning toasts for admin lists (Tips, YouTube, Movies, FAQ), My To Do List + Ship's Log, and May Day + Pan Pan (user choice)
- Pro/Beta only (Free -> plan dialog; perks list now includes "Clone lists"); requires boat details like +
- Dialog pre-fills "My <name>", case-insensitive duplicate check; copy is an independent custom list with all items unticked; unaffected by Reset All
- Tested iteration_17: frontend 100%

## Iteration 20 (2026-06): Master templates + selective "Reset All..."
- Admin master templates for all 12 built-in checklists incl. May Day/Pan Pan (not My To Do / Ship's Log): backend `templates.py` (GET /api/templates, PUT /api/admin/templates/{list_id}; Mongo list_templates; May Day/Pan Pan must keep smart vessel/callsign/GPS lines)
- Admin publishes from own list via PublishTemplateBar (confirm dialog, "Last published" status); built-in items used until published
- New users start from templates (useBoatStore 404 branch -> applyTemplates); existing users only get templates on reset; clones/custom lists never touched
- "Reset All..." opens ResetListsDialog: per-list tick boxes (all unticked), Select All, "Nothing is selected" warning, deleted built-in lists offered "(deleted, will be restored)" (disabled if a custom list has the same name); resetting May Day/Pan Pan clears its Skipper tick
- Tested iteration_18: backend 100%, frontend 100%
- Backlog note: old accounts auto-adding Head/Engine/To Do via migration use built-in items

## Iteration 21 (2026-06): Rename lists, Template Updated badge, Multiple boats
- Rename any list (incl. built-in, To Do, Ship's Log; not admin shared lists) via pencil next to + / clone; Pro/Beta; ids kept so templates/resets still apply
- Template Updated: boat state template_versions; "Updated" note + " • Updated" in list picker when admin published newer items; Get latest items (confirm) or Keep mine; publish marks admin's current boat
- Multiple boats (Pro/Beta unlimited; Free 1, server 403): user_boats keyed (owner_id, boat_id), existing = "main"; GET /api/me/boats, DELETE /api/me/boats/{id}, ?boat_id on GET/PUT /api/me/boat, boat_id in email-log
- Frontend: useBoats (boat list, active boat per device, offline flush of other boats), BoatShell remounts BoatPrep per boat, per-boat localStorage keys (main keeps old keys), BoatSwitcher (add = copy of current boat, unticked; Ship's Log default, To Do/engine hours/callsign empty; delete needs online)
- Tested iteration_19: backend 100%, frontend 100%; low items fixed (sync toast on new boat, renamed names in reset dialog, publish bar copy, delete of unsynced boat, 404 before 400)
- Known edge: two boats can be given the same vessel name via the Vessel field

## Iteration 22 (2026-06): Remember last boat, Crew sharing, Boat photos
- Last boat: PUT /api/me/last-boat {key}; GET /api/me/boats returns `last`; first fetch per session opens it (joining a crew sets it to the shared boat)
- Sync merge (sync_merge.py): items carry ts, lists list_ts, sections sec_ts (stamped automatically in useBoatStore.mutate via defaults.stamp); server merges per item; client adopts merged PUT response; shared boats poll every 20s
- Crew sharing (crew.py): owner (Pro/Beta) emails invite (7 days, token hashed, must sign in with invited email) -> /join/<token> (JoinCrew page; signed-out stores token and returns after login); crew tick-only (server merge_crew_ticks), any plan, shared boats not counted to Free limit; owner manages crew/invites in CrewDialog; crew can leave; owner emails hidden from crew
- Boat photos (photos.py, Emergent Object Storage via EMERGENT_LLM_KEY): owner uploads (client resized 800px JPEG, max 3MB) in CrewDialog; thumbnails in shadcn Select boat picker for owner+crew; soft delete
- Boat keys: own = boat_id, crew = c_<owner_id>_<boat_id> (local storage per key)
- Tested iteration_20: backend 100% (31 new + regression), frontend fixed (join selection, AdSense double push, JoinCrew double toast)
- Known: storage has no delete API, so replaced/removed photos remain as orphans

## Iteration 23 (2026-06): Boat Inventory, zone map, area tags, watermark
- Boat Inventory (Pro/Beta; id boatInventory; per boat state.areas = cupboards with items {name, qty, onboard}); never reset; can't clone/rename; crew read-only; in Export/Email PDF
- Admin: one zone map picture (inventory.py, object storage) shown at top of Boat Inventory; publishes own cupboard names as suggestions (app_settings.area_defaults); skippers "Add from suggested cupboards"
- Area tags: Edit Item dialog area picker (Pro, not crew) -> chip on items; Area filter above lists (All / used areas / No area)
- Watermark: faded current boat photo behind the page (BoatWatermark)
- New boat copies cupboard names (empty contents)
- Tested iteration_21: backend 100%, frontend ~95% -> testing agent fixed tick visual + qty validation; I added plan perk, count under cupboard name, edit keeps item fields
- Known: inventory merges as one section (two offline phones editing inventory -> last wins); storage orphans on replace

## Iteration 24 (2026-06): Inventory search + Rigging Checks list
- Boat Inventory search box: filters cupboards as you type (cupboard name match shows all its items, otherwise only matching items), auto-opens matches, highlights text, "Found in N cupboards" / "Nothing matches"; add forms hidden while searching
- New built-in "Rigging Checks" list (after Safety, 15 default items, ids 200+), added to existing users via addMissingLists, master-template enabled (templates.py)
- Verified via screenshot automation

## Iteration 25 (2026-06): Skipper's own zone maps
- Each boat can have up to 3 of the owner's own zone maps (Pro/Beta): POST /api/boats/{boat_id}/zone-maps, DELETE /api/boats/{boat_id}/zone-maps/{map_id}, GET (owner or crew via ?owner=); stored on user_boats.zone_maps; listed in /api/me/boats (zone_maps [{id, v}])
- Own maps replace the admin default on that boat; removing them brings the default back; crew view only; admin controls relabelled "Default map for skippers without their own"
- Self-tested: backend limits/permissions via API, upload/remove via UI automation

## Iteration 26 (2026-06): Tagged checklist items appear in Boat Inventory
- Items tagged with a cupboard show inside it as "<List> - <item>" (link icon); their tick = checklist tick (two-way); counted in cupboard "x/y on board"; included in Export/Email PDF (backend inventory_list_for_pdf with registry/data)
- Inventory search covers linked items, ignores spaces/hyphens ("headtorch" finds "Head torch"); summary "N found in M cupboards · K on board" (own items count by quantity)
- Self-tested via UI automation

## Iteration 27 (2026-06): Apply all items to Area + AI Auto-Scan
- Area panel on checklists (Pro owners with cupboards) lists all cupboards; "Apply..." (enabled for a cupboard) opens ApplyAreaDialog with all untagged items pre-ticked; OK tags them
- AI Auto-Scan per cupboard (ai_scan.py, POST /api/boats/{boat_id}/scan, Gemini 3 Flash via EMERGENT_LLM_KEY, emergentintegrations streaming): photo resized 1600px, image verified with PIL, 20 scans/user/24h (db.ai_scans; failed scans not counted), AI failure -> 503 friendly message; ScanReviewDialog to edit/untick/add before saving; saving REPLACES the cupboard's own items (on board); photo not stored
- Tested iteration_22: backend + frontend 100%; follow-ups fixed (503 instead of proxy-replaced 502, failed scans refunded, PIL check, dialog gutters, guard closes apply dialog)
- /app/image_testing.md holds image test rules; sample photo backend/tests/scan_sample.jpg

## 2026-06 Magic scan wording
- Scan button renamed "Upload image for magic scan..." (AI icon kept), with "Save time adding items:" help label before it
- Newly added cupboard/locker opens automatically so the add-item box and magic scan are visible

## 2026-10 Price change + company footer
- Pro price NZD 9.99/year (setup_stripe.py amount 999; old 4.99 price archived, lookup_key pro_yearly transferred)
- setup_stripe.setup() now runs on backend startup (background) and moves active subscribers on old prices to the new price with no proration (applies from next renewal)
- PlanDialog shows price notice to subscribers; all copy (Login, PaymentResult, Terms, index.html JSON-LD/noscript) updated
- CompanyFooter (Lisbon Lions Limited, NZBN 9429038086274) on Login and Terms pages only

## 2026-10 List ordering toggle
- "Show List Ordering Icons" checkbox in AddItemForm on every checklist (not admin lists or inventory); per list, saved on device (localStorage mbp_order_<listId>); free for all
- When on: numbered rows (tap number to type a new position), flag (jumps to top, red), up/down arrows; hidden under an area filter with a note
- Flagged red highlight always visible; My To Do List help text updated
- Tested: iteration_23 (100%)

## 2026-10 Admin template lists
- Admin panel "Template lists" section: create/edit/delete new lists (e.g. Prep your trip), items one per line (TemplateListsAdmin/TemplateListEditor)
- Backend /api/admin/template-lists CRUD in templates.py (list_templates docs with custom:true, id tpl_<hex>); GET /api/templates exposes them
- Auto-added to every owner boat (Free included) before My To Do List once the cloud copy has loaded (useBoatStore `loaded`), skipping deleted lists and name clashes; Updated note, Reset All restore and in-app publish bar work for them
- Admin rename affects new boats only; deleting a template leaves existing copies as normal lists
- Tested: iteration_24 (backend 31/31, frontend all flows)

## 2026-10 Manage template lists page
- Account menu (admin only): "Manage template lists" under "Manage user tiers" -> /admin/templates (AdminTemplates.jsx); template list controls removed from the User tiers page

## 2026-10 Promo codes, typing fix, small UI
- Admin "Manage promo codes and coupons" page (/admin/promos): create code + % + expiry with live price preview; "Generate & Publish Code" creates Stripe coupon (first year only, Pro product) + promotion code (expires 23:59 NZ); list with times used/active. Backend promo_codes.py; checkout allow_promotion_codes=True
- Fixed vessel/boat detail typing race (useBoatStore editsRef)
- Magic Scan Discoveries wording; Terms gate bottom spacer; /admin Joined shows UTC + local time
- Tested: iteration_25 (all pass)

## 2026-10 Move Boat Area Items
- Move icon (left of rename/delete) on each Boat Inventory area opens "Move Boat Area Items" (MoveAreaDialog/MoveRow, lib/inventoryMove.js applyMove)
- All items ticked by default; partial quantities; target defaults to first non-source area; changed target carries down to rows below until the next explicitly set row; Show List Ordering Icons on by default (order saved to source)
- Same-name items merge quantities (blocked above 9999); linked checklist items retagged; empty source kept; warning when only one area; guard keeps dialog open when boat details missing
- Tested: iteration_26 (all pass, guard toast bug fixed after)

## 2026-10 Move single item
- Edit Item dialog has a "Boat area" select (when 2+ areas); choosing another area moves the whole item there (same-name merge, 9999 cap, toast). InventoryList.moveItem
- Self-tested via screenshot (move + merge milk x2+x1=x3)

## 2026-10 Service history items, Electrical Service, indented lists
- Log Service saves ticked items into the entry and unticks them (engine_log / new electrical_log section synced; backend models, sync_merge SECTIONS)
- New built-in Electrical Service list (id electricalService, items 300+, master template enabled) with Electrical Service History (electrician name, date, notes)
- Help drop-downs for Engine and Electrical Service (ListIntro prefix field)
- Indent/Unindent in Show List Ordering Icons (lib/outline.js): one level, N.n numbering, group-locked moves, parent moves group, alternating light-blue blocks when a list has sub-items; indent kept in PDFs (server + print view), templates and clones
- Tested: iteration_27 (backend 34/34; frontend all flows); follow-ups fixed: print-view indent, copy, guard warning near the service panel, top-level number input ignores N.n

## 2026-10 Fold groups, service reminders, service history PDF
- Fold/unfold indented groups (per device, localStorage mbp_fold_<listId>); folded parent shows "N sub-items · M ticked"; indenting under a folded group unfolds it
- Next service due date on Engine/Electrical panels -> My To Do item id due_<listId> ("Engine service due dd/mm/yyyy"); coloured status green/amber(<=30d)/red(overdue)/grey(ticked); reminder items excluded from Free 5-item To Do limit
- Export PDF (Pro/Beta) via POST /api/service-history/pdf (service_history.py, require_premium), RFC 5987 filename for non-ASCII vessel names
- Tested: iteration_28; fixes after: unicode filename 500, "by <name>" summary, Free limit, guard bar near reminder
- Known: standard PDF fonts cannot draw characters like O-macron in names (affects all PDFs)

## 2026-10 Group shading simplified
- Every group with sub-items is light green (#eaf7ee) with a green top edge on its parent; no alternating colours; plain items stay white

## 2026-10 Prompt on delete + group merge warning
- "Prompt on delete" checkbox beside Show List Ordering Icons (per list, per device, default on; useListSetting mbp_prompt_delete_<listId>); on = confirm dialog item-delete-*, off = instant delete
- Indenting a group main item (merges its group into the one above) asks first (merge-group-* dialog)
- Self-tested via screenshot

## 2026-10 Undo delete + Fold all
- Every checklist item delete shows a 6s toast with Undo (restores item at its position and re-indents a promoted sub-item)
- "Fold all groups (N)" / "Unfold all groups" button above lists that have groups (FoldAllButton, useFolds setFoldAll)
- Self-tested via screenshot

## 2026-10 Undo inventory deletes
- Boat Inventory item and area deletes show a 6s Undo toast; area undo restores position, contents and checklist tags (InventoryList deleteItem/deleteArea)
- Self-tested via screenshot
