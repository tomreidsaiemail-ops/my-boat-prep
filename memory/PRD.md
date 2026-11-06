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

## 2026-10 Pro NZD 49.99 + FIRST5000 launch promotion
- Prices: pro_yearly 4999; pro_yearly_first5000 2499 (metadata plan=first5000, same product, skipped by startup migration)
- Admin toggle "Promotion FIRST5000 is running" on /admin/promos (PUT /api/admin/promo-codes/first5000, db.app_settings); GET /api/payments/offer for the Plan dialog
- Checkout uses the FIRST5000 price when running (metadata first5000=1) with a Stripe submit message explaining first year + first renewal at 24.99 then 49.99; promo codes stack (allow_promotion_codes)
- billing.end_first5000_after_first_renewal switches the sub to 4999 (no proration) on any sync after the first renewal (subscription.updated, invoice.paid, status poll); no subscription schedules (they broke cancel renewal)
- users.first5000 (set from current sub metadata each sync) + renew_price; FIRST5000 badge on /admin; Plan dialog notice
- Tested: iteration_29/30 (E2E purchases with promo stacking, cancel/re-enable renewal, test-clock lifecycle 2499->2499->4999)

## 2026-10 FIRST5000 launch banner
- Public GET /api/payments/offer/public; First5000Banner on Login (always while running) and in-app for Free owners (closable 7 days, localStorage mbp_first5000_hidden_until) with "Get 50% off Pro" opening the Plan dialog
- Self-tested via screenshot

## 2026-06 — Create New List with pasted items
- CREATE NEW LIST dialog (`components/boat/CreateListDialog.jsx`) now has an "Items, one per line" box (all users), a collapsible help panel with Skipper's tip (open the first time, closed after), duplicate/blank lines removed, live item count.
- Confirm with empty items asks "Create an empty list?" (Create anyway / Go back).
- Redeployed to myboatprep.com with NZD 49.99 pricing, FIRST5000 and launch banner.
- Auto Indent Categories (2026-06): checkbox in Create New List (on by default). Lines like "1. Deck" / "2) Cabin" become headings (number kept), following lines become sub-items. Logic: lib/outline.js isHeadingLine/linesToItems.
- AI List Builder (2026-06): "Write this list with AI" button in Create New List (Pro/Beta). POST /api/ai/list-draft {name} -> {lines, drafts_left}; Gemini 3 Flash via Emergent LLM key; 20 drafts/day/user (db.ai_drafts). Draft fills the items box, grouped with numbered headings. Tested iteration_31.
- 2026-06: Skippers (Pro) can clone Sailing YouTube Channels / Sailing Movies (own media list: registry kind youtube|movies, items {id,name,url,note,thumbnail,label}, POST /api/media/thumbnail) and Skipper's Tips (kind tips, normal checklist). Ordering toggle on own media lists; FAQ still not cloneable. Cloned media lists deletable when empty.
- 2026-06: Admin Template List editor has AI draft + auto-indent; backend template-lists accepts items as strings or {label, indent}.
- 2026-06: Boat details: boat_type (list + Other) and pob (default 1, clamped 1-999 server side); shown on print view + emailed PDF meta.
- 2026-06: Engine Service: engine_type field (one row with hours + date), pre-filled from latest; history shows engine type heading once per run ("Not recorded" for untyped after typed). Not on service PDF (user choice).
- 2026-06: Batch Magic Scan in Boat Inventory: "++" button next to "+" opens batch screen (BatchScanDialog/BatchAreaForm/BatchEntry, hooks/useBatchScan.js sequential queue, abort on discard/delete). Confirm / Confirm and add another; progress "Scanning image X of N"; tick each reviewed area; Done/Confirm Batch enabled only when all ticked; delete entry with confirm; discard warning; same-name areas warned and replaced. Max 50 areas per batch; daily AI scans raised to 50. Tested iteration_33.
- 2026-06: May Day & Pan Pan POB line is now dynamic "pobDescription": "There are <POB> persons on board POB. The boat is a white <BOAT_TYPE>..." from Boat Details ([BOAT TYPE] when unset). Existing boats/templates migrated (server startup _upgrade_pob_lines + frontend migrateState upgradePob). Email PDF renders it too.
- 2026-06: Pan Pan now filled like May Day: "This is V, V, V. Callsign C" (panPanVessel) + editable "or MMSI Number (Optional, skipper to delete or add one)" (id 400), "Report position <live GPS>" (panPanPosition). Existing boats/templates migrated (server upgrade_items at startup + frontend upgradePob).
- 2026-06: Pan Pan: added 'ALL STATIONS, ALL STATIONS, ALL STATIONS' (id 401) after 'Transmit: PAN PAN...'; existing boats migrated.
- 2026-06: Renamed May Day -> Mayday, Pan Pan -> Pan-Pan everywhere (list names on every boat via one-off radio_v2 flag, intros, terms, meta, transmit line 'PAN-PAN PAN-PAN PAN-PAN', tips/FAQ text). Server one-time migration flag db.migrations radio_calls_v2 (idempotent radio_text).
- 2026-06: "Magic List Generation" (renamed from AI draft; marketing: Marine Magic List Generation / Marine Magic Scan). Create New List + Admin template editor have LIST DESCRIPTION (512 max); generation uses the description (required) and follows any instruction (not boating-only). Description saved on registry entry (custom lists) / template doc (template lists) and shown at top of list (data-testid list-description).
- 2026-06: Rename List dialog (RenameListDialog.jsx) edits name + List Description on any renamable list (description on registry entry; falls back to admin template description). Magic List Top-Up (TopUpDialog.jsx, POST /api/ai/list-topup): suggestions grouped by existing headings (tolerant heading match), review+tick, inserted as sub-items at end of matching group or end of list; shares the 20/day Magic List Generation limit. Tested iteration_34.
- 2026-06: FIRST200 promotion (admin toggle in Promo codes, mutually exclusive with FIRST5000; backend/launch.py cached flag; while on every user premium + launch_free, checkout blocked, FIRST200 banner "free during launch"). App opens on Boat Inventory for premium users. Zone Map collapsible (starts collapsed) with first-time help, up to 20 photos, new default-map text. Inventory ticks now mean "removed for now" (field `removed`, red row; old `onboard` ignored so all existing items start unticked); new items unticked. Inventory instructions + Skipper's tip under Zone Map. Boat Details button "On the boat? Take a Boat Inventory using Batch Magic Scan...". Batch area form help (first time) + photo hint; batch dialog text/tip changes.
- 2026-06: Annotate Zone Photos: pinned labels on own zone maps (PinnedPhoto.jsx, ZonePinEditor.jsx; PUT /api/boats/{id}/zone-maps/{map_id}/pins, max 60, stored on zone_maps entries). Pins link to inventory areas (new names create areas on save); tapping a pin opens/scrolls to that area; crew view-only. Tested iteration_36 + orphan-pin fix.
- 2026-06: Boat Inventory instructions collapsible (remembered per device, key mbp_inventory_instructions_collapsed; auto-collapse on search). Boat Details batch button text lengthened ('..."Easy as"').
- 2026-06: Header Mayday (red) / Pan-Pan (orange) half-height buttons under GPS coords open those lists. Find on Map: 'Show on zone map' in pinned inventory areas opens the photo full size with that pin highlighted (pulsing amber). Crew Walkthrough (CrewWalkthrough.jsx): pin by pin, photo by photo, highlighted pin + area contents, Back/Next/Done; available to crew.
- 2026-06: Top-up button renamed "Ask The Magic Mariner what's missing from the list". Magic Marine Engineer (EngineerAsk.jsx, POST /api/ai/engine-ask, Gemini 3 Flash via Emergent key, premium only, own 20/day quota kind=engine): textarea under Engine Service notes (1024 max, 1 line -> 3 lines when typing), blank engine type warning with Add engine type / Ask anyway, answer card with Add to Notes (appends Q+A to notes; engine notes now 2000 max; service PDF puts long notes >300 in a full-width row). Walkthrough Sign-Off: last walkthrough stop has 'Sign off in Ship's Log' -> adds 'Crew Walkthrough signed off by <name> on <when> (<n> stops)'; owner locally, crew via POST /api/me/boat/walkthrough-signoff (server $push into owner's data.shipsLog). Tested iteration_38 + fixes (PDF long notes, textarea height).
- 2026-06: "Share the app" in the app menu (ShareAppDialog.jsx, qrcode.react, renders offline): real QR code for https://myboatprep.com (decode-verified with OpenCV), plus a Share link button (phone share menu, copies the link if sharing is unavailable). Gemini flyer QR was AI-drawn and not scannable; replace it with a screenshot of this QR.
- 2026-06: Front-screen Batch Magic Scan button text now ends "Easy as" Just click here!
- 2026-06: Crew invites v2. Root cause of the SY Seven CS bug (production RCA): invite went to chris.siekmann.cs@googlemail.com, crew signs in as chrissiekmann.cs@googlemail.com, and an exact email compare returned 403. Fix: crew.email_key (gmail/googlemail same, dots and +tags ignored), backfilled at startup. Pending-invite prompt on app open (PendingInvitePrompt.jsx: Join / Not now (per session) / Decline -> skipper sees "Declined"). New InviteCrewDialog (email required, RolePicker multi-roles from boat "Crew Roles" list -> admin template -> used roles, plus custom roles; sticky Planned Voyage Notes saved on user_boats.voyage_notes). Actions: Send email invite (links to the app, crew just logs in), Copy WhatsApp message, Copy link (https://myboatprep.com). All actions save a pending invite. Roles stored in user_boats.crew_roles[user_id] and shown in the skipper's crew list. Endpoints: GET /api/crew/pending, POST /api/crew/invites/{id}/accept|decline, PUT /api/boats/{id}/voyage-notes. Daily invite limit now counted in db.invite_sends (TTL). Tested iteration_39 (19+31 pytest, UI 100%).
- 2026-06: Edit Crew Roles (pencil on each crew member -> EditRolesDialog, PUT /api/boats/{id}/crew/{member}/roles). Crew RSVP: crew who have joined see a "Planned voyage" card (VoyageCard.jsx; GET /api/crew/voyage, POST /api/crew/rsvp in|out) showing only their own reply. The skipper sees RSVP badges in the crew list and a Voyage replies summary (crew dialog + invite dialog), and "Clear replies" (DELETE /api/boats/{id}/rsvp). No emails. Stored in user_boats.rsvp[user_id]. Tested iteration_40.
- 2026-06: Crew Watch Rota (WatchRotaDialog.jsx + lib/watchRota.js buildRota): traditional ship's watches incl. First/Last Dog, start date/time, voyage length 12h-14 days, 1 or 2 per watch, tick who stands watch (default skipper + "I'm in" crew), roles shown. Saved as user_boats.watch_rota (PUT/DELETE /api/boats/{id}/watch-rota, premium). Crew see it on their Planned voyage card with their own watches highlighted. The rota is a snapshot: re-save after crew or role changes. Crew Invite QR: "Show QR code to scan" in the invite dialog saves the invite and shows a QR to myboatprep.com with a "log in with <email>" caption. Share the app: "Download QR for printing" saves a 2048x2048 PNG (SVG drawn to a fixed canvas, so it's the same size on every phone; decode verified). Tested iteration_41 + fixes.
- 2026-06: Invite crew window asks after each invite "Clear this email and their roles for your next invite?" (Clear / Keep). Boat Details: Boat type + POB line replaced by an "Additional boat details..." button -> AdditionalDetailsDialog: boat type, POB, children (blank = none, max POB-1, shows the adults/children split), MMSI (9 digits), Metres/Feet toggle, LOA, beam, draft, mast height, trip duration (days, 0-365). Backend BoatDetails fields: children, mmsi, units, loa, beam, draft, mast_height, trip_days (validators plus a model clamp). Mayday/Pan-Pan: POB line says "N persons on board POB, A adults and C children."; Callsign / Pan-Pan vessel lines add ", MMSI x"; the manual "or MMSI Number" item shows "(MMSI x is included above)" when one is set (frontend displayLabel + backend ship_log._label). Tested iteration_42 + fixes.
- 2026-06: Marine Magic Provisioning Assistant (MPA). lib/mpa.js: meal plan = group with top-level meal name, first indented "(recipe)", then ingredients. parseQty handles g/kg/ml/L/tsp/tbsp/cup/clove/can/pack/count, leading or trailing amounts. keyOf singularises. Portions = adults + 0.5 x children (amounts per adult), each meal cooked once, Food-area stock subtracted for counts (other units show "N on board"). Provisions list is added with AI amounts (POST /api/ai/mpa/provisions, Gemini, Pro, shares the Magic 20/day quota) and skipped when already an ingredient. Output: one "MPA Shopping List" (registry kind "mpa") replaced each run, with a Meals (N) key, then Ingredients, then Provisions. Items carry mpa {base, src, meals}, and labels end with "(TM)(HM) [1][3]" so export/print/PDF work; Checklist renders source circles and meal squares (MpaBadges.jsx). Food areas: circled-F toggle on inventory areas (area.food); zone map "Show Food areas only" filter. Boat Inventory is now first in the list selector. Paste dedupe is now per numbered group; meal plan lists allow duplicate items. Print view uses checkboxes, not numbers, for MPA. Tested iterations 43-44 (100%).
- 2026-06: Built-in "Meal Plan" list (id mealPlan, lib/mealPlan.js, 7 days x 3 meals in MPA format; added to existing boats via addMissingLists; admin master-template slot). Custom template lists keep repeated sub-items under different headings. MPA "Sort by shopping aisle" (lib/aisles.js built-in groups in shop-walk order; unknown items -> POST /api/ai/mpa/aisles; fallback Other). Magic Marine Doctor (DoctorAsk.jsx, POST /api/ai/doctor-ask, Pro, own quota) on lists named "First Aid Kit...", with the caveat "(The MMD does not hold an M.D. but can help in an emergency)" and a forced safety footer. Tested iteration 45.
- 2026-06: Admin Analytics (/admin/analytics, AdminAnalytics.jsx, admin_analytics.py): growth (users, users this month, Pro = role pro, Pro this month via users.pro_since set by admin role change/billing), compute (real token counts from the emergentintegrations StreamDone.usage recorded in db.ai_usage by usage.record_usage for every AI call; estimated cost from admin-set prices per million tokens, app_settings compute_pricing, default $0.50 in / $3 out), Magic Suite tiles MMD/MPA/MME/MLG/BMMS/MMS (users + uses, all-time and this calendar month UTC; batch scans send ?batch=true). Past uses backfilled once from ai_drafts/ai_scans with 0 tokens. User tiers list shows per-user compute (30s refresh) and can sort by compute. Tested iteration 46 (100%).
- 2026-06: MPA recipe line now uses square brackets "[...]" only (mpa.js BRACKET). Built-in Meal Plan uses [ ]; migrateState.upgradeMealPlan converts unedited built-in "(...)" recipe lines on existing boats. Verified by screenshot (Meal Plan recognised, 21 meals).
- 2026-06: Route Hazards renamed Route Planning (built-in routeHazards; migrateState renames unedited names; admin template name). Magic Marine Navigator (NavigatorAsk.jsx; POST /api/ai/navigator-ask; Pro; own quota; usage feature MMN): START/DESTINATION saved as boat.route_start/route_dest, auto-filled into the 1024-char question with extra text kept, blocks if either is blank, considers boat details and Route Planning items, answer card ends with a charts/tides/weather safety line. Tested iteration 47.
- 2026-06: Deployment readiness check passed (no blockers); publish of current version queued.
- 2026-06: Category delete window (DeleteGroupDialog.jsx; BoatPrep askRemove/removeMany): deleting a top-level item with sub-items always opens a window listing the category + each item, all ticked. Unticking any item unticks the category (category kept with unticked items); re-ticking items never re-ticks the category; ticking the category ticks all. One Undo restores all in place. Destructive confirm buttons now truly red (!bg). Tested iteration 48 (100%).
- 2026-06: MPA list's first category now "Meals (N) from <list names>". MPA soft warnings before making the list (mpa.js mpaWarnings, MpaWarningsDialog.jsx): too many meals (> trip days x 3; unset days = 1 with a hint) and missing meal types (Breakfasts, Lunches, Dinners / mains, Desserts, Snacks, matched by meal-name words). Go back or Make it anyway. Tested iteration 49 (100%).
- 2026-06: Meal types: item.meal_type (breakfast/lunch/dinner/dessert/snack) set in Edit Item via MealTypePicker (only on meal heads = top-level item with [recipe] first sub-item, mpa.isMealHead); badge on the meal line. MPA checks use the picked type, else words in the name; desserts/snacks don't count toward 3/day. Built-in Meal Plan now 35 meals (21 main + 7 desserts + 7 snacks appended, ids unchanged); untouched old 21-meal plans upgrade on load (defaults.upgradeMealPlan). Admin master templates keep meal_type. Tested iteration 50 (100%).
- 2026-06: List item limit is 1000 characters everywhere (ITEM_MAX in outline.js): Magic List and Top-Up lines (ai_lists.py, were 120), typed (AddItemForm), edited (Edit Item TextDialog maxLength + counter), pasted/admin template lines (linesToItems), master templates (already 1000). Verified (to_lines check + add input caps at 1000).
- 2026-06: Auto meal types: meals with no picked type get one from the earliest type word in the name (mpa.detectMealType/autoMealTypes, flagged meal_type_auto so it follows renames and disappears if no longer a meal). Applied on every change (useBoatStore.mutate via autoTypeData on changed lists) and on load (migrateState). Picking in Edit Item (even the same value) makes it manual; "Not set" re-detects. Tested iteration 51 (100%).
- 2026-06: MPA inventory overlap: foodStock collects Food-area names (qty 0 ignored); shopping rows store mpa.areas and show a green on-board badge (Archive icon + first area name, "+N", truncates). Provisions-list items not in recipe ingredients store mpa.prov and show a blue PROV badge (Forward icon); provisions matched to an ingredient merge with no PROV. .item-text max-width:100% fixes mobile overflow. Tested iteration 52 + self-verified layout at 390px.
- 2026-06: Exports: MPA rows add " · PROV" / " · On board: areas" in PDF + email (ship_log._with_badges, only while unedited). Navigator now returns JSON {answer, waypoints[2-20], distance_nm, passage_time}; answer card shows RouteMap.jsx (Leaflet 1.9.4, OSM + OpenSeaMap seamarks, numbered pins start green/end red, dashed line, full-screen overlay via portal + Esc, live GPS boat dot from useGps lat/lon/acc + locate button) and CoastGuardReport.jsx (general-format trip report built from boat details + route, placeholders for missing info, copy button, labelled "Suggested by the Magic Marine Navigator"). Tested iteration 53; fixes after: map isolate (was over dialogs), plurals, 9-digit MMSI, trimmed legs.
- 2026-06: Shared daily Magic limit + paid top-up (quota.py). Settings in app_settings key "magic_quota" {daily_limit 20, pack_size 20, pack_price 5}, editable on /admin (MagicQuotaSettings.jsx). Per-user db.magic_quota {daily_used, purchased_allowance, last_reset_date}; reset at the skipper's local midnight (X-Timezone header -> ContextVar via server middleware). All Magic features (lists, top-up, MPA, MME, MMD, MMN, AI Scan/batch) consume one unit: free first, then purchased; refund on AI failure; 429 {code: daily_limit} opens global MagicLimitDialog ("Buy +20 for NZ$5"). Stripe one-time Checkout (POST /api/payments/topup-checkout, Pro currency, metadata kind=magic_topup); webhook + status poll credit purchased_allowance idempotently (credit_topup, metadata fallback). Old per-feature limits (20/kind, 50 scans) removed. Tested iteration 54 (100%) + follow-up fixes.
- 2026-06: Magic extras: big pack (settings big_pack_size 100 / big_pack_price 15, admin-editable, optional in PUT), packs[] in quota + 429; checkout {pack: small|big}. Account menu MagicBalance ("X of N free today · Y bought" + Buy more Magic -> MagicLimitDialog buy mode via MAGIC_BUY_EVENT, Best value tag). Low-balance nudge: server sets X-Magic-Free-Left on free consumes (quota_note ContextVar dict filled in consume, cleared on refund; middleware adds header), client toasts once/day at 3 with Buy more action; Toaster pointer-events auto + DialogContent ignores outside clicks on toasts. My plan TopUpHistory (GET /api/payments/topups: credited top-ups, tz-aware dates, Stripe receipt_url via session->payment_intent->latest_charge, cached; missing receipts re-checked hourly). Tested iteration 55 + fixes self-verified.
- 2026-06: Preview-only admin: PREVIEW_ADMIN_EMAILS env (previewadminuser1@gmail.com) honoured in auth.to_user_out only when the request host ends with .preview.emergentagent.com (auth.on_preview ContextVar set in server middleware). Live app admin stays ADMIN_EMAIL only. Verified by curl (preview host 200, other host 403).
- 2026-06: List description limit 512 -> 1000 (DESCRIPTION_MAX, ai_lists DraftIn/TopUpIn, templates). MPA food synonyms (mpa.foodSynonyms): boat lists named "Food Synonyms" (admin template copy) + "My Food Synonyms" (case-insensitive); heading + indented items or "a = b" lines form groups; admin groups sharing a word are joined; words in My list are removed from admin groups (My wins). Only affects the food-area on-board check: when the exact item isn't on board but a synonym is, row gets mpa.subs [{name, areas}] -> dashed green SubBadge "Table Salt · Galley Cupboard 1" (no deduction/tick); also PROV rows. Exports: " · On board instead: Area: Name" in server PDF/email and client PrintView (mpaPrintText). Tested iteration 56 + fixes.
- 2026-06: BUG FIX live "Couldn't start checkout": prod users carried stripe_customer_id values from another Stripe account (deployer RCA: "No such customer: cus_VRwBm7c10k2aPx", 7 users). payments._start_session (used by Pro checkout and top-up checkout) retries by email when the saved customer is rejected and clears the stale id (self-heals); other Stripe errors -> 502 with readable detail (<=200 chars). Tested iteration 57 + pytest 59 passed + curl.
- 2026-06: Private admin template lists (templates.py private flag; editor checkbox "Private to admin user" -> button "Save Admin Use Only"; "Admin use only" tick in list; excluded from /api/templates so never on any boat; PUT keeps stored value when omitted). GET /api/mpa/rules returns items of private "Admin - Food Synonyms" + "Admin - Food Noise Words" (case-insensitive). MPA wide matching (mpa.matchRules/subsFor) replaces the old boat-list Food Synonyms/My Food Synonyms: split on and/&/comma (trimmed), strip noise words + regex patterns (per token) on both sides, then synonym groups; results only as dashed possible-match badges. Rules cached in localStorage mbp_mpa_rules for offline. Tested iteration 58 (100%).
- 2026-06: MPA matching fixes after prod RCA (live Admin - Food Noise Words contained "(.*)" which wiped every name): two-way synonym matching via conceptsOf (own key + any group whose word it is/contains as whole words); compileNoise re-reads catch-all patterns with literal brackets ("(.*)" -> /\(.*?\)/ span) and skips anything still matching ""/"salt" or invalid; spans stripped before splitting. Tested iterations 59-60. YouTube links: lib/youtube.js (splitYouTube with left-boundary group, no lookbehind; withoutYouTube), LinkedText.jsx renders red "YouTube" pill (span role=link, window.open new tab, stops row toggle) in every checklist line (MpaText) and VoyageCard notes; MPA strips URLs from ingredients/provisions before matching. Tested iteration 61 + self-verified fixes.

## 2026-06 MPA main-word matching + tappable place badges
- Synonym matching now uses the main (last) word: "Chilli pickle" no longer links to Chilli/Pepper groups; "Sea salt" still matches Salt; "pepper to taste" reads as pepper.
- Admin synonym groups stay separate (no merging); exact spelling wins over singular/plural, so "Pepper" (black/white) and "Peppers" (bell/chilli) don't cross-match.
- On-board / "may do instead" badges are tappable (touch + keyboard) and open a popover listing every match with its area; "+N" chip shown when more than one. Taps never tick the row.
- Existing MPA shopping lists keep old badges until regenerated. Tested iteration_62 + self-test; unit tests /app/tests/mpa_bidir_unit.mjs (37/37).
- 2026-06: MPA most-specific synonym match (groupsFor scores by matching word count, exact spelling breaks ties): "Red bell pepper" -> Bell Peppers group, never the Pepper (black/white) spice group. User chose no built-in veg list: admin adds Capsicum / Red Pepper / Green Pepper etc. to the "Peppers" group in Admin - Food Synonyms. Unit tests 46/46.
- 2026-06: Magical Organisation. Boat details: compact "Batch Magic Scan..." + "Magically Organise Your Lists..." buttons side by side. Private admin template "Admin - List Categories" (heading line, "*Colour*" line, list names; GET /api/list-categories, cached mbp_list_categories) -> lib/listCategories.js (parseCategories, organiseLists, dropdownSections). Colours: brown, green, blue, red, yellow, orange, purple, pink, teal, grey; uncategorised system = white, uncategorised user lists = light purple (always bottom, user icon). OrganiseDialog: coloured bubbles (tap = select list + close), per-list and per-category Show checkboxes (indeterminate when mixed), link user lists to a category (registry entry `category`, "" = none). Hidden ids in boat state `list_hidden` (synced section; backend models/STATE_FIELDS/KEEP_IF_OMITTED/sync SECTIONS). Clones inherit the source category. Main list dropdown is now a custom Radix Select (list-selector trigger, list-option-{id}) with shading + category headers; Boat Inventory first; active list always visible. User creates the Admin - List Categories list themselves (preview test copy removed). Tested iteration_63.
- 2026-06: Category icons (CategoryIcon.jsx, picked from category name: basket/anchor/wrench/cross/info/tag; dashed circle = uncategorised, user = own lists) in Organise dialog headers and dropdown section headers. Crew hide lists: crew get "Magically Organise Your Lists..." (crew-organise-btn); their hidden lists live only on their device (localStorage mbp_crew_hidden_{boatId}), fully separate from the skipper's list_hidden; no linking for crew. Batch Magic Scan help icon (HelpPanelIcon, tap or mouse hover) shows items of admin list "Admin - Help Panel - Batch Magic Scan button". GET /api/admin-lists?prefix= (allowed: "Admin - Help Panel - ", "Admin - List Template - "), cached per prefix. Create New List: "List templates" select (prefix stripped) fills List description (asks before replacing user-typed text). Magic List Generation blocked while <placeholder> text remains. List description limit raised to 4000 (frontend + ai_lists + templates). Tested iteration_64 (100%) + fixes self-tested.
- 2026-06: Placeholder fill boxes in Create New List ("Fill in the blanks"): one box per <placeholder> in List description, fills the text live as they type (base text + fills; typing in the description itself bakes the current text in). Analytics: USERS TODAY tile (users.last_seen updated in get_current_user at most every 5 min; browser sends local midnight as `since`), tap opens UsersTodayDialog with names, emails, last-seen time and role (GET /api/admin/users-today?since=). Self-tested (curl + screenshots).
- 2026-06: MLG YouTube links: only when the name/description mentions YouTube, the prompt adds a real-links rule and backend/youtube_links.py checks every link (oEmbed for videos, page 404 for channels; network errors count as found); response gains youtube {checked, bad}. Frontend YouTubeFixPanel holds the items and lets the user remove the links, swap in YouTube search links, or drop the items (lib/youtube.js fixYouTube; empty headings removed and renumbered). LinkedText now also recognises channel/@, playlist and results links. Edit List Panel (was Rename List): name, description + MoveToAreaSection (pick area, all items offered: no-area ticked, other-area unticked with chip, same-area disabled). ApplyAreaDialog and the area filter's Apply button removed. Tested iteration_65 (100%) + LOW fixes.
- 2026-06: "Hide Area filter" toggle (hide-area-toggle) between Show List Ordering Icons and Prompt on delete; ticked by default per list (useListSetting mbp_hide_area); ticking hides the Area filter and clears it. Crew unaffected (filter shows as before). Self-tested.
- 2026-06: MLG YouTube: the 3-option panel is gone; when a list asks for YouTube links, links that do not exist are swapped automatically for YouTube search links (lib/youtube.js swapBadYouTube) and the note says how many. Other lists untouched. Boat details - Additional details: Pets on board (PetsSection.jsx): add/remove any number (max 20) of pets with type (Dog/Cat/Bird/Rabbit/Fish/Other...), name, breed, weight (kg for metres, lb for feet); stored in boat.pets (backend Pet model); summary shows pet count. Self-tested.
- 2026-06: Pets in provisioning: MPA dialog "Add food and supplies for N pets" (mpa-pets-check, on by default when pets exist); pets go in the same /ai/mpa/provisions call (no extra Magic use), which now accepts items [] + pets + units and returns pets [{name, amount, for}]; shopping list ends with "For the pets (names)" section. Pets in Mayday/Pan-Pan pobDescription ("Also 2 pets on board: a dog and a cat.") in app and emailed/PDF ship log, and "Pets on board: ..." line in the Coast Guard trip report. Tested iteration_66 (100%) + minor fixes.
- 2026-06: Pet first aid: Magic Marine Doctor shows "Who needs help?" (doctor-who: A person + one button per pet); picking a pet sends pet {type,name,breed,weight} + units to /ai/doctor-ask, which uses a pet first-aid prompt (no unsafe human medicines, vet-first footer). Also fixed /ai/mpa/aisles regression from the pets provisioning change (parse_provisions now returns {amounts, pets}). Self-tested (curl real answers + mocked UI).
- 2026-06: Pet First Aid Kit: "Make a Pet First Aid Kit list" button under Pets on board (make-pet-kit-btn, Pro, needs signal) -> POST /api/ai/pet-kit {pets, units, days} (one Magic generation) builds "First Aid Kit - Pets" with one heading per pet + Shared, sized by type/breed/weight; existing kit list items are replaced after a confirm. Doctor on that list defaults "Who needs help?" to the first pet. Self-tested (real call + mocked UI).
- 2026-06: Extra "Magic Provisioning" button (mpa-open-top-btn) left of Fold all groups at the top of meal plan / Provisions / MPA lists (list-top-tools row). Amazon links (amazon.* stores, amzn.to/eu/asia, a.co) render as a brown "Amazon" pill with cart icon in LinkedText, like the red YouTube pill; splitYouTube now returns kind youtube|amazon and withoutYouTube strips both for MPA matching. Self-tested.
- 2026-06: Amazon links in Magic List Generation: Amazon blocks automated checks, so (user choice) every generated Amazon product link becomes an Amazon search for the item on the same country site (lib/youtube.js amazonSearchLinks; existing /s?k= searches kept). Note tells the user. Unit tests /app/tests/amazon_search_unit.mjs.
- 2026-06: "Planned voyage or race notes" (invite dialog, WhatsApp message, invite email). Crew Roles: "*" before a role in the admin Crew Roles template = ticked by default on the boat copy (templateItems); the boat Crew Roles list shows ticked roles in blue with a tick (no strike-through, Checklist picks prop / .is-pick); ticked roles (all if none ticked) are the roles offered when inviting or editing crew, grouped under their headings (lib/crewRoles.js roleGroups, RolePicker groups); no 12-role cap on options. Invite crew "Change available" button saves the draft (sessionStorage mbp_invite_draft), opens the Crew Roles list with a "Back to Invite crew" bar that reopens the invite with the draft restored. One-off migration crew_racing_roles adds "Racing Roles" (Port Trim, Starboard Trim, Mainsheet, Helm, Foredeck (headsail/spinnaker)) after Safety & Emergency in the admin Crew Roles template.

## 2026-06 Magic Provisioning Assistant naming + pre-select
- Buttons and dialog title renamed to "Magic Provisioning Assistant" (no "Marine")
- Opening MPA from a meal plan list pre-selects that list (even with several meal plans); from a non-meal-plan list nothing is pre-selected (iteration_68 passed)

## 2026-06 Boat Budget
- Additional details: Make + Model beside Boat Type; POB/Children/split on their own row
- Boat Budget list (id boatBudget, kind budget, skipper only; backend strips it and budget_notes for crew) seeded from private admin list "Admin - Boat Budget" (auto-seeded at startup; "Description | Product")
- Header shows Boat Type/Make/Model + fill-in button + currency picker (guess from phone region, pinned when AI writes)
- MAGIC MARINER BUDGETING COMMENTS (POST /api/ai/budget, Pro/Beta): auto-fills when empty (waits 1.5s, paused while details dialog open), Refresh button
- Table: Description, Product, store link (enter/edit dialog; Opening Store 2s bar then new window), Date Paid, Cost; total in cost column; 2025 rows orange, 2024- red; totals for this year / last year / previous year
- Tests: iteration_69, iteration_70 passed; backend/tests/test_boat_budget.py

## 2026-06 Magic Bartender + budget collapse
- Boat Budget rows: Product + Store collapse under Description (per-row chevron + expand-all); compact dd/mm/yy date cell; total visible at 390px
- Toolbar: "Arrange Lists" (4-colour-square icon + wand), new "Magic Bartender" (martini) button
- Boat areas: D (Drinks) flag beside F (Food), area.drinks
- MAGIC BARTENDER dialog: help text + cheers icon, optional Bartender Photo (POST /boats/{id}/scan?bartender=true), ingredient chips, minimised thumb, "Using the Bartender Photo" checkbox, F/D area toggles, Batch Scan shortcut
- POST /api/ai/bartender (backend/bartender.py): up to 12 cocktails (missing <=2), TheCocktailDB photos (exact/startswith match, else martini icon), YouTube search link; saved as list "Magic Bartender Cocktails" (kind bartender, replaced each run)
- Tests: iteration_71 passed; backend/tests/test_bartender.py

## 2026-06 Bartender follow-ups
- Mocktails: /api/ai/bartender children>0 adds up to 3 mocktail:true items (Alcohol-free badge, youtube "mocktail"); children=0 strips them server-side
- Cocktail shopping: button with count still to buy -> checklist dialog (all ticked, already-on-Provisions disabled) -> adds to Provisions
- Sundowner card (SundownerCard.jsx, lib/sun.js NOAA sunset from GPS, 6pm fallback): daily stable pick (+ kids mocktail), Share (navigator.share / WhatsApp), open list, dismiss for the day
- Tests: iteration_72 (+ mocktail fix re-verified via tests/test_bartender_mocktails.py)

## 2026-06 Zone Map help from admin list
- ZoneMap "How to make a zone map" panel reads "Admin - Help Panel - Zone Map help" (items, indented = bullets, links clickable); falls back to the built-in text when missing. Verified both cases in preview.

## 2026-06 Admin template long lines
- Bug: admin template editor silently cut each line at 1000 chars (linesToItems ITEM_MAX), so long help paragraphs lost their end. Now template lines allow 4000 (backend TEMPLATE_LINE_MAX), editor shows an error instead of cutting, textarea grows to fit the text. Private-list create toast fixed. Verified 1268-char line round-trips.

## 2026-06 Budget wording
- Product placeholder "Description - Product/Organisation"; "Store" wording replaced with "Web link" / "Add web link" (row button, toggles, dialog title, Opening web link bar). Verified by screenshot.

## 2026-06 Boat Budget double delete prompt + Reset All restore
- Deleting the Boat Budget asks twice: "Delete Boat Budget?" then "Are you absolutely certain?" (delete-list-certain-btn); Keep Budget cancels and the next attempt starts at stage one
- Reset All lists "Boat Budget (deleted, will be restored)" only after it was deleted; restoring adds the empty template budget (withBudget in lib/budget.js, shared with first seed)
- Verified end-to-end in preview by screenshot script

## 2026-06 Merge Latest
- Updated note: "New Master items are available for merge with X. Your X will be kept by default." + "Merge Latest" button (Keep mine stays)
- Merge window (components/boat/merge/*): summary of master changes at top, your own changes kept, master additions/removals offered UNTICKED, Merge N changes / Keep as is, Throw away the master updates, Throw away my changes (confirm). Any merge choice clears the Updated tag.
- 3-way merge via base = master version the boat last synced: backend saves previous master versions in db.template_versions (30 per list) on publish/edit; GET /api/templates/{id}/version?at=; identical republish no longer bumps updated_at; deleting a custom list removes its versions. No base (old boats/offline) -> 2-way diff. Sub-items keyed under their heading (lib/merge.js).
- Tests: iteration_73 + fixes re-verified (pytest 7/7, /app/tests/merge_unit.mjs)

## 2026-06 What's New notes + Vessel Telemetry + Leaving the Dock check
- Master publish dialog + custom template editor take an optional "Why this changed" note (300 chars); stored on list_templates + template_versions; version endpoint returns notes since the synced version; Merge Latest summary shows "Why it changed". Republishing unchanged items returns unchanged:true (toast says nothing published).
- Additional details: "Vessel Telemetry / Vessel Dimensions" collapsible (LOA, beam, draft, mast); "Vessel Telemetry (tank levels and battery status)" open until configured: litres/gallons, fuel tank + jerry cans (+size, blank=20 L/5 gal), gas bottles x kg (blank=4.5) + extra, water tank + jerry cans, batteries (engine, house, portables: make, V, Ah, type, capabilities). Backend BoatDetails fields + Battery model.
- Engine Service History: Cruising speed (default 6 kn) beside Engine type (boat.cruise_kn)
- Leaving Dock list top: DepartureCheck (components/boat/departure): Full..Empty colour buttons for fuel/gas/water/each battery, red warning at 1/4 and Empty, 1/3 rule hint; Magic Mariner passage calc POST /api/ai/passage (distance nm + fuel use/h), skipper reviews or overrides; range + red/amber warnings (1/3 rule incl. jerry cans; water and gas incl. extras); skipper acknowledgment (holding cruise speed / 6 kn default); checkbox copies summary into Ship's Log, flags and updates the entry if things change. Logic in lib/telemetry.js.
- Tests: iteration_74 + follow-up fixes (pytest 9 passed/1 skipped, /app/tests/telemetry_unit.mjs)

## 2026-06 Arrival check, green ticks, Doctor photos, item photos
- Arrival status check (ArrivalCheck.jsx) at top of Arriving at Destination + Returning to Dock: levels on arrival, spare cans/bottles still full, fuel/water/gas used vs departure (boat.depart) and planned, actual L/h; copies to Ship's Log (shared LogCopy/TankLevels with departure). boat.arrive persisted.
- Ticked checklist rows: green background + left edge + "Done" badge (no strike-through); flagged+ticked stays red; cocktails rows green.
- Magic Marine Doctor: optional photo (attach/take) -> POST /api/ai/doctor-ask-photo (Gemini vision); every answer saved in db.doctor_answers with photo in object storage; "Past answers and photos" history (GET /api/ai/doctor-history, /{id}/photo, DELETE). Disclaimer unchanged.
- Item photos on riggingChecks/electricalService/engineService: camera icon, 32px thumbnail with red X badge, hover preview + Open full view, tap = full view; skipper adds, crew views (photos.py item-photo endpoints, db.item_photos, item.photo_id). Row height unchanged.
- Tests: iterations 75-77 passed

## 2026-06 Before/After item photos, captions, service PDF photos
- Items on riggingChecks/electricalService/engineService: Before (photo_id/photo_note) and After (after_id/after_note) photos; split thumbnail + "2" badge; hover preview / full view (PhotoSlots.jsx) to add, caption (80 chars) or delete each.
- Service history PDF (engine/electrical) gets a PHOTOS section after the table: each item Before/After side by side with captions (service_history.py _load_photos owner-only, unreadable images skipped).
- Dev note: inotify watch limit (12288) can stop hot reload for frontend and backend; restart with "sudo supervisorctl restart backend frontend" after edits if changes do not appear.
- Tests: iteration_78 + fixes (pytest 26 passed)

## 2026-06 Fix: numbered headings without a space
- isHeadingLine now accepts "1.Trauma", "1. Trauma", "1) Trauma" (not "2.5L water"); toLines uses it too.
- Admin template saves push indents to every boat's copy (backend templates.push_indents); ticks/notes/photos kept; boats synced to the old version stay up to date when only grouping changed.
- Amber warning when auto-indent is ticked but no numbered headings found (admin editor + Create List).
- Both First Aid templates re-saved with grouping in this DB. Tests: backend/tests/test_template_indent_push.py, iteration_79 (frontend 100%).

## 2026-11 Crew invites, Crew Prep cloning, Role Briefing, Boat Terms Agreement
- Invite Crew window: required Crew member's name LEFT of email; invite stores name; crew list shows it (crew_names on boat after accept).
- Clone on Crew Prep opens a crew picker (joined + invited crew) -> "Crew Prep - <name>" lists; no crew -> warning + "Yes, invite crew"; lists for people invited are auto-created when the invite window closes.
- Crew Roles list: Role Briefing field on roles (item.briefing); included in the invite email.
- Boat Terms and Conditions Agreement (backend crew_agreement.py): admin private list "Admin - Boat Terms and Conditions" (seeded) + boat_terms (skipper, crew dialog) + role briefings + Zone Map Walk Through stops (must tick all to accept). Crew can choose Not now (joins, not accepted). Skipper sees badge per crew member with stops ticked.
- Fix: Watch rota and Additional boat details dialogs no longer autofocus the date/boat-type pickers.
- Tests: backend/tests/test_crew_agreement.py (+ _edges), iteration_80.
- Backlog: re-ask crew to accept when boat terms or zone map pins change.

## 2026-11 Crew Prep progress, Agreement PDF, Briefing resend, MMD Ship's Log
- Crew Prep progress: "Crew Prep - <name>" list shows a progress bar (headings not counted); skipper's crew list shows each member/invite's ticks (backend crew.crew_prep_progress).
- Agreement PDF: GET /api/crew/agreement/pdf (skipper any member via member_id; crew own only) - agreement_pdf.py.
- Briefing resend: POST /api/boats/{id}/briefings {member_id?} (manual only, 40/day) - crew_briefings.py; per-member and "all crew" buttons.
- MMD: must tick "logged in Ship's Log" box (backend log_agree required); every Q&A saved to Ship's Log as "Magic Marine Doctor asked by <crew name|Skipper> on <when>: <question>" with mmd_answer (collapsed/expandable in list; included in Ship's Log PDF/email).
- Sync fix: server-pushed list items (crew MMD + walkthrough sign-offs) tracked in user_boats.pushed_items and re-added until the skipper's phone sends them back once (sync_merge.keep_pushed).
- Note: FIRST200 promo makes free users Pro, so old tests expecting free 403s fail (pre-existing).
- Tests: test_crew_prep_mmd.py, test_mmd_log_race.py, iteration_81.

## 2026-11 Sub-areas, zone map colours, rainbow grouping
- Sub-areas (folders/boxes): areas with parent_id, nested inside parent (closed by default), own list + Magic Scan (photo not kept); "Add a folder or box", "Put inside another area" (merge), "Take out of <parent>"; delete parent removes subs (Undo restores); search returns zone map › area › sub-area path; inventory PDF lists subs after parent ("Parent › Sub: item").
- F/D badge before area names removed (toggle buttons on right remain).
- Zone maps: name + colour (zone_colours.py). 20-colour sequence auto-assigned, unique per boat; colour picker square left of Edit labels (PUT /api/boats/{id}/zone-maps/{map}/meta); names containing a word from private admin list "Admin - Zone Map Predetermined Colours" (seeded "Cockpit - Gold" etc) default to that colour unless taken or manually picked.
- Boat areas take their zone map's colour; inventory list grouped in rainbow order with map-name headers, "Not on a zone map" last.
- Tests: backend/tests/test_zone_colours.py, ui82_setup.py, iteration_82.

## 2026-11 Walkthrough folder peek, contents cards, Navigator weather photos, Departure decision log
- Crew walkthrough + agreement stops list each cupboard's folders/boxes (closed, tap to peek) - inventory/FolderPeek.jsx.
- "Print contents cards" (Boat Inventory, shown when sub-areas exist): POST /api/inventory/folder-cards.pdf -> 4 quarter-page cards per A4 (folder_cards.py).
- Magic Marine Navigator: intro text under ASK label, route map removed, up to 5 weather/routing screenshots (item-photo list_id weatherRouting) with commentary, 12h stale hint, reminders (re-upload on forecast updates, AI polars), "Why we're going" note; stored in boat.weather {photos[{id,note,at,logged}], why, advice, advice_at}; crew see photos read-only.
- Leaving Dock: heading containing "Departure" ticks/unticks its children and auto-ticks when all children ticked (lib/outline tickDeparture). On Departure ticked (skipper) -> warning dialog Log it / Not now -> Ship's Log "Departure decision - route - time" with folded detail + weather_photos thumbnails; Ship's Log PDF embeds the photos (server.log_images), email notes them.
- Tests: test_weather_departure.py, ui83_setup.py, iteration_83.

## 2026-11 Area totals + movable zone map labels
- Boat area item count now includes items in its folders/boxes (just the total).
- Edit labels: drag a label to move it (PinnedPhoto onDrag, pointer events, tap still opens), plus up/down/left/right nudge buttons (1% steps) in the label form; new labels show while placing. Self-tested (drag + nudge saved to DB).

## 2026-11 Year of manufacture
- Boat details > Additional details: "Year of manufacture" (boat.year_built, 4 digits, 1800..next year, backend validated). Shown in Boat Budget header ("Year built"); sent to /api/ai/budget so the Magic Mariner allows for the boat's age. Self-tested (save/reload, AI answer).

## 2026-11 Trip report boat line + LWL
- Coast Guard trip report "Boat:" line now: type, make model, "built YYYY", LOA and LWL.
- Vessel Dimensions: new LWL (waterline length) next to LOA (boat.lwl, backend validated like other dimensions). Self-tested save/reload.

## 2026-11 Hull/deck colour + hull speed hint
- Additional details: Hull colour + Deck colour (common list or "Other..." own words; boat.hull_colour/deck_colour, 40 chars). Trip report gets "Colours: white hull, cream deck" line (placeholder if empty).
- Hull speed = 1.34 x sqrt(LWL ft); hint under LWL and under Engine Service cruising speed: "Hull speed X kn. Comfortable cruising about 80%" + "Use N kn" button (sets cruise_kn); multihull/planing note. Self-tested.

- 2026-06: Moved Magic Bartender button from Boat Details into the hamburger menu (above FAQ, with separator). Hidden for crew as before.

## 2026-06 Boat Maintenance lists + master attributes
- Private admin lists seeded once (templates.seed_master_attributes, migration master_attributes): "Admin - master attributes" (notes + "Name | type | lists or All"; types char/char(n)/date/integer/integer age/decimal/decimal length/area/weight/cost/image/pdf or a picklist name) and "Admin - master attribute types" ("type name - a, b, c"). Fetched via GET /api/admin-lists?prefix=Admin - master (cached offline). Parsing in frontend lib/maint.js.
- Closing Additional details with Boat type + Make + Model filled (no maint lists yet, not dismissed: localStorage mbp_maint_offers per boat+make/model/type) opens MaintSetupDialog: Pro+online -> POST /api/ai/boat-kind (cached in db.boat_kinds, 30/day, no Magic quota); otherwise local sail-word check. Offer: 5 lists (Deck Hardware, Sail Loft, Running Rigging, Standing Rigging, Ground Tackle), guidance, optional global Service due date. Pro+online -> POST /api/ai/maint-lists (kind maint, feature MMM, uses Magic quota; AI fills picklist attrs only); else STARTER items. Also "Create Boat Maintenance lists..." button in Additional details.
- Lists: registry kind "maint", maint key, category "Boat Maintenance". Items: top-level = category (attrs.next_service_date = category due), indented = items; effective due = own or category. Table (MaintTable/MaintRow): Description | Last service | Service due, orange <=30 days, red overdue, expand row for attributes (AttrField/AttrFile), units follow boat metric/imperial, cost in boat currency, image (item-photo, maint_ list ids allowed) and PDF (POST/GET/DELETE /api/boats/{id}/item-file, 5 MB). Undo delete, add to category/new category. Crew read-only. Export shows label + dates (incl. inherited) + attributes.
- Hamburger menu: Magic Bartender above FAQ with separator (removed from Boat Details).
- Tested iteration_84 (backend 15/15, frontend ~97%, tester fixed row height) + follow-up fixes self-verified.

## 2026-06 Excel export
- "Export to Excel..." button under both Reset/Export bars (everyone, works offline, no vessel-details guard) -> ExcelExportDialog: This list (.xlsx), Every list as separate spreadsheets (one zip), Every list in one master workbook (tab per list). Files named "<name> YYYY-MM-DD.xlsx" / "<Vessel> spreadsheets YYYY-MM-DD.zip" / "<Vessel> master YYYY-MM-DD.xlsx".
- Built client-side in lib/excelExport.js (SheetJS xlsx 0.20.3 from cdn.sheetjs.com + JSZip). Sheets: checklists (Group, Item, Heading, Ticked, Flagged, Boat area), Boat Budget (real dates, numeric cost), Boat Maintenance (category/item, last/due incl. inherited, every master attribute, units columns), Boat details, Boat inventory, Engine/Electrical service history, Zone maps, Crew (skipper only, online; note when offline). Tab names sanitised (31 chars, unique, no reserved 'History', no edge apostrophes).
- Tested iteration_85 (95%, reserved-name bug fixed after).

## 2026-06 Shopping in / stores out (MPA)
- Hamburger menu: Magic Bartender, Batch Magic Scan My Shopping..., Sync Food & Drink Boat Areas Magically..., separator, FAQ (skipper only; Pro; needs signal).
- ShopScanDialog (components/boat/stores): areas step (defaults Fridge F+D, Freezer F, Dry Goods F, Hanging Basket F, Pantry F, Bilge D, Gantry D + other F/D areas; missing ones created; "Click here to show other boat areas" to tag F/D) -> Shopping Set N of M per area (up to 20 photos total, background scan via useBatchScan(boatId, {shopping:true}) -> POST /boats/{id}/scan?shopping=true returning weight_g) -> review (qty, destination, weight) -> Done adds to areas (same name adds qty, clears removed), learning stored as area.learned keys (lib/stores.js applyShopping), Ship's Log line with items + MPA estimated weight.
- SyncStoresDialog: typed text or MicButton (MediaRecorder -> POST /api/ai/transcribe, Whisper whisper-1, no Magic used) -> POST /api/ai/mpa/consumed (one Magic, kind stores/MPC) -> review/confirm -> applyConsumed (qty 0 => removed:true) + Ship's Log line with items + weight removed.
- Tested iteration_86 (backend 14/14, frontend 100%) + minor fixes (qty<1 dropped, learned area must be F/D, same-name learning order, snapshot stock, boat_maps .get hardening).

- 2026-06: Boat Maintenance lists now have the standard "Show List Ordering Icons" (numbers, flag, up/down, indent/unindent; categories with items cannot be indented) and "Prompt on delete" toggles at the bottom (per-list settings shared with other lists; confirm dialog maint-item-delete-dialog, categories mention their item count). Self-tested by screenshot.

- 2026-06: Deleting a Boat Maintenance list (kind maint) now asks twice like the Boat Budget: "Delete <name>?" then "Are you absolutely certain you want to delete this and all that is contained in it?" (DeleteListDialog). Self-tested.

- 2026-06 fix: "Create Boat Maintenance lists..." button in Additional details now shows whenever any of the 5 maintenance lists is missing (was hidden once any existed). Setup dialog marks existing ones "(already on your boat)" and offers only the missing ones; tapping with no Make/Model shows a hint. Auto-offer still only when none exist. Self-tested (delete Ground Tackle -> button back -> recreated).

- 2026-06: Magic Mariner maintenance lists now pre-fill Weight (decimal weight, kg or lb per boat units) and Cost (decimal cost, replacement cost new in the boat currency) for every item, driven by the types in Admin - master attributes (client sends type; server validates numbers 0-999999.99). Values carry <key>__unit + <key>__est; AttrField shows an amber "est." tag until the skipper edits the value; maintLabel/Excel add "(est.)". Starter (free/offline) lists stay blank. Also: sync_merge tolerates non-scalar item ids (a test restore had written Long objects as ids, making PUT /api/me/boat 500 and the app go offline); 2 bad ids repaired in preview DB. Self-tested.

## 2026-06 Custom Attribute List Builder
- Hamburger menu "Custom Attribute List Builder..." (below Sync Food & Drink, above separator; skipper only; needs boat details via guard) -> CustomListBuilder.jsx: list name (unique), pick master attributes (plus built-in Condition picklist Good/Fair/Worn/Replace) or make your own (name + 13 types incl. picklist choices), reorder/remove, tick up to 2 as table Columns; duplicate/reserved (Description, Category) names rejected.
- Create -> registry {id maint_custom_<ts>, kind maint, maint "custom", attrs, columns}, starting category "Items". Reuses MaintList/MaintTable/MaintRow with `cols` (Description + chosen columns, read-only attrText cells open details). attrsForList returns list.attrs for custom; Excel export skips service-date columns for custom; custom lists don't affect the 5-list maintenance offer (haveMaint). Delete list asks twice (custom wording).
- Tested iteration_87 (95%) + fixes self-verified.

- 2026-06: Route Planning "ASK THE MAGIC MARINE NAVIGATOR" intro paragraphs now come from private admin list "Admin - Help Panel - MMN Routing Guidance" (NavigatorIntro via useAdminLists, cached offline; hidden if the list is missing). Self-tested.

## 2026-06 Crew decision to go (Crew Route Share)
- Route Planning (skipper): CrewGoShare card under "Why we're going": "Send to crew" posts POST /api/boats/{id}/go-plan (route, why, up to 5 weather photos; marks photos shared so removal doesn't delete files); re-send confirms and clears answers. Status list via GET /api/boats/{id}/go-plan (crew answers + pending invites "Not joined yet"), refreshes on focus and every 60 s. In-app only (no email).
- Crew: GoDecisionCard in the crew header (after Planned voyage): route, why, photos; Agree to go / Not agreed (reason required, Cancel) -> POST /api/crew/go-plan/answer (409 if plan is stale). Ship's Log lines pushed server-side (pushed_items) for the send and for every answer. backend/go_decision.py.
- Tested iteration_88 (backend 6/6, frontend 100%) + minor fixes. Test crew link: test-user-free is crew on test-user-pro/main.

## 2026-06 Import Spreadsheet
- Hamburger menu "Import Spreadsheet..." (after Custom Attribute List Builder; skipper only; guard) -> ImportDialog (components/boat/import): pick .xlsx/.xls/.csv (up to 10 files, 10 MB each) -> columns step (per tab: list name, first column = item description, every other column type select defaulting to Text; empty tabs flagged) -> preview (lists, counts, first 5 rows, empty tabs skipped) -> Import. Parsing in browser (lib/sheetImport.js, SheetJS). Names "Imported - <tab>", or "Imported - <file> - <tab>" for multi-file (CSV tab = file name), " (2)" on clashes.
- Imported tabs become custom attribute lists (kind maint, maint custom, imported true, first 2 attributes as columns, one category per tab). Dates (Excel dates and locale text with day/month swap + validity), numbers (signed for number/decimal/cost, positive for age/length/area/weight), picklist options from column values, default units/currency.
- Rows with only blanks and 0 (0, 0.00, -0) are skipped and counted ("N rows with only blanks and 0 skipped"); a tab of only such rows is an empty tab.
- Move: expanded item in an imported list -> "Move to another list..." (MoveItemDialog, default My To Do List) -> checklists get "Description - Name: value, ..."; maint/custom targets map attributes by name/key and append unmatched to the description; Boat Budget gets Product details + cost. Undo toast.
- AttrField number filters accept a leading "-" for Whole number, Decimal and Cost.


## 2026-06 Select All, budget links, fuel & water auto-log
- Checklist Select All (header checkbox checklist-select-all): ticks every shown item, tap again unticks all, no confirm; Undo toast restores the exact previous ticks.
- Boat Budget: web links stay editable on locked past years (user choice); banner says so. Other fields stay locked.
- Fuel & water auto-log: TankChange card (Fuel/Water, amount, Added/Used) in Leaving the Dock and Arrival checks (arrive- prefix). Each change goes straight into the Ship's Log with volume, fuel type (diesel 0.84 / petrol 0.74 / water 1 kg/L; lb for ft boats; gal x 3.785) and estimated weight change; with a picked level and tank capacity, it shows "Tank now about X of Y" and moves the level picker. Over-capacity/over-use errors; inline message when boat details are missing. lib/telemetry.js tankChange().
- Tested iteration_94 (frontend 100%).
- Backlog: turn ship log notes into tidy log entries (AI).

## 2026-06 Smarter Select All + Gas bottle log
- Select All hidden on Ship's Log, Mayday/Pan-Pan (EMERGENCY), any list whose name contains "Crew Roles", and for crew (tick-only) views.
- TankChange card now "Add or use fuel, water and gas": Gas tab (whole bottles) with Swapped (empty for full, + gas weight; raises the gas level by count/bottles in use when a level is picked), Added / Removed (full spare bottles, updates boat.gas_extra, weight = gas + estimated empty bottle of the same weight). Errors for swapping more than in use / removing more spares than on board; decimal typed -> "counted whole" message. lib/telemetry.js gasChange().
- Tested iteration_95 (100%); its 3 low polish items fixed after (hint only when bottles in use set, decimal feedback, buttons in a full-width row on the gas tab).

## 2026-06 Spars & Heavy Hardware (6th Boat Maintenance list)
- MAINT_LISTS/MAINT_KEYS now 6: + sparsHardware "Spars & Heavy Hardware" (mast, spreaders, boom, gooseneck, rigid vang, spinnaker/whisker pole, bowsprit, mast step, arch/davits). STARTER items for free/offline.
- Master attribute dictionary: migration add_spars_attributes (once, keeps admin edits) puts Spars on Age/Diameter/Length and adds "Spar material | spar material types | Spars & Heavy Hardware" + picklist line. Fresh seeds include them.
- Magic Mariner: /api/ai/maint-lists now runs one Gemini call per list in parallel (one Magic use per request, one retry per list, json_repair fallback). Sends picklists, weight, cost, length/area (units m/mm or feet/inches, sqm/sq ft) and make/model/colour; length/diameter/area also marked est. Toast names any list that fell back to starter items.
- Existing boats with the 5 old lists get the "Create Boat Maintenance lists..." button offering only the new one; new sailboats are auto-offered all 6.
- Tested iteration_96 (backend + frontend 100%); json/brand fixes self-tested by curl. tests/test_maint_spars.py added by tester.

## 2026-06 Racing weight tracking
- lib/weights.js weighUp() (provided through WeightsContext in BoatPrep): gear total per Boat Maintenance category (sum of "decimal weight" attrs, g/kg/lb/oz converted; category heads with items not double counted; custom lists excluded), fluids from latest Leaving the Dock levels (no level = full; diesel 0.84 / petrol 0.74 kg/L by engine type, water 1, gas + estimated empty bottle = bottle size), provisions = area items qty x unit_g (Batch Magic Scan now stores unit_g), crew = POB x average crew weight (default 85 kg / 187 lb), boat baseline weight.
- Additional details: Racing weight panel (WeightPanel.jsx): editable Weight (boat_weight), read-only Totalled on deck weight, Average crew weight (crew_weight), six category totals, All-Up Racing Displacement breakdown. Boat/crew weights convert when Measurements toggle m<->ft. Backend BoatDetails boat_weight/crew_weight (up to 6 digits).
- Each non-custom maintenance list: footer with list weight total, on deck total, displacement.
- Tested iteration_97 (backend 9/9, frontend 100%) + polish (alignment, unit switch, head double count, 6 digits) self-verified.

## 2026-06 Ship's Log organisation + admin template sort/filter
- Admin template lists: search, quick filters (All / Admin use only / Published / Help Panels / Admin lists), sort (Name A-Z/Z-A, Recently updated, Most items); API cap 1000.
- Ship's Log help from private admin list "Admin - Help Panel - Ships Log" (seeded; "Skipper's Tip:" line = tip). Passage popup help from "Admin - Help Panel - Ships Log Passage Folders".
- Ship's Log folders (lib/logFolders.js, components/boat/shipslog/*): Group a passage (Start/End log, Source, Destination, dates -> "Src - Dst - range" folder), Fold a year ("<yyyy> Ship's Logs" holding passages + logs), open/close, open/close all, rename, ungroup with Undo. Items point at folders with `in`; folders keep `open`. Crew open/close locally only.
- Batch Magic Scan Paper Logs: per page title + date typed by skipper, POST /api/boats/{id}/paper-log (Gemini OCR, one Magic per page, usage MPL), editable text, rows "<title> - <date>: <text>" with log_date.
- Print/PDF/email (backend ship_log.arrange_log) and Excel (Folder + Folder row columns) follow folder order and depth.
- Excel master workbook now named Boat_Lists_Export_<YYYY-MM-DD>.xlsx; separate files still one zip.
- Tested iteration_98 + iteration_99 (100%).

## 2026-06 Indent / Outdent controls
- Duplicate item check is per group (same label allowed under different parents; clashes only within one parent or at top level).
- Checklist ordering tools: separate Indent right (ArrowRightToLine) and Outdent left (ArrowLeftToLine) buttons, text labels from sm up. Indent only shows for a top-level item with no sub-items whose item above belongs to a normal group (not a Ship's Log folder); Outdent only on sub-items. Old "merge group into the group above" dialog removed (outline.js canIndent).

## 2026-06 Multi-level lists (up to 4 levels)
- lib/outline.js is tree-aware: items keep `indent:true` for any sub-item (one-level code still works) plus `level` 2-3 for deeper ones (6 > 6.1 > 6.1.1 > 6.1.1.1). depthsOf/outlineInfo (num path, depth, ancestors, prevSib, canIndent/canOutdent, whole-branch subs), move/place/flag move whole branches among siblings, setIndent moves the branch one level in/out, removeOutline promotes the first sub-item's branch, normalizeLevels + levelShifts/restoreLevels for exact Undo.
- Every level with sub-items folds; hidden by any folded ancestor. Indent shows only with a previous sibling and if the branch stays within 4 levels; Outdent never at top level. Maintenance lists stay one level.
- Delete category dialog shows depth and has "Delete only <heading>, keep its items". Order badge widens for 6.1.1.1; dotted position typing per level. Print view / PDF indent per level; template publish keeps level.
- Tested iteration_100 (95% -> fixes self-verified).

## 2026-06 Async paper log scan + Ship's Log clamp
- Batch Magic Scan Paper Logs is asynchronous (usePaperQueue.js): pages read one at a time as soon as they're added (title/date now optional server-side, checked if given) while the skipper titles/dates them; "Processing n of N" banner (amber "read / didn't work" summary on failures), per-page status + Try again, 429 stops the queue; Review step (edit title/date/text) then OK adds rows. Closing confirms (mentions an in-flight page). Disabled buttons dimmed globally.
- Ship's Log rows clamp to 3 lines (ClampText.jsx, measured with ResizeObserver), full text as hover tooltip, per-row expand/collapse icon only on long rows, master "Expand all / Collapse all log rows"; always start collapsed on each visit. Works for crew.
- Tested iteration_101 + iteration_102 (100%), last two polish items self-applied.

## 2026-06 Typed hierarchy moves + Log Rigging Check on maintenance lists
- Typing a full number (e.g. 10.2.1) in an item's number badge moves it (with its branch) there if valid (lib/outline.js moveToPath): parent must exist, not itself/its own branch, max 4 levels; error toast otherwise; opens folded ancestors; toast when the final number shifts.
- Boat Maintenance lists (6 core): "Log Rigging Check" (rigging/spars) / "Log Service" (deck, sails, ground tackle) button + per-item "Log service for this item..." (MaintServiceDialog). Sets Last service / Service due on picked items, keeps per-item service history, adds a Rigging Service History entry (with list name/next due), a Ship's Log row and a My To Do reminder (due_maint_<listId>, earliest due).
- Tested iteration_103 (96%; ancestor unfold, error clearing and move toast fixed after).

## 2026-06 Role briefings in crew invites
- WhatsApp invite message/preview now includes "*Role briefing - <role>*" for each selected role with a briefing (lib/crewRoles.js roleBriefings).
- Invite POST sends the phone's briefings for the selected roles (InviteIn.briefings, max 20, 2000 chars each); server merges them over synced briefings so a just-typed briefing is in the email. Tested iteration_104 (100%).

## 2026-06 Crew Registration
- Skipper's crew register (one list across all their boats, db.crew_register, backend/crew_register.py): "Crew Registration" button under the boat photo in Photo and crew -> CrewRegisterDialog. Crew: add/edit/delete (name, phone, email, DOB, height cm, weight kg, allergies, food preferences, next of kin name/email/phone, general comments; only name+email needed from skipper). Status Unregistered -> Pending (registration request by email, WhatsApp wa.me link / copied message, or "email everyone not registered") -> Registered (green tick).
- Crew side: CrewRegistrationPrompt after sign-in (pending request, or invited / already crew on skipper's boat), prefilled, every field mandatory, bold "text the skipper" note, Registered confirmation. Auto pop-ups queued (lib/promptQueue.js): boat invite -> Terms agreement -> registration.
- Interested parties (name, phone, email) registered straight away; "Email crew details to interested parties" (register + Photo and crew window) sends name, phone, email, age, height, next of kin + status; warns if crew not registered, Send anyway. 60 register emails/day.
- Invite crew dialog: RegisterPicker chips grouped Registered / Unregistered fill name + email. Details only visible to the skipper.
- Tested iteration_105 (backend 16/16, frontend 100%); follow-ups (prompt queue, parties limit, /mine eligibility + duplicate check) self-verified.
