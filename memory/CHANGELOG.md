# My Boat Prep - Changelog (continued from PRD.md)

## 2026-06 Create List options + meal plan makers + galley crew
- "+" (create-list-btn) opens CreateListOptions: Clone the selected list (Copy icon, hidden when the list can't be cloned), standard Create List (+), Common Meals (UtensilsCrossed), Magic Provisioner from what's onboard / fresh (MagicProvisionerIcon = ChefHat + Sparkles).
- Common Meals: private admin template "Common Meals" (seed migration common_meals, 8 meals in "1. Meal / [recipe] / ingredients" format), GET /api/meals/common; bubbles add meals to a new or existing meal plan (lib/mealPlans.js mealItems). Own meals saved per account: GET/POST/DELETE /api/me/meals (db.user_meals).
- Magic Provisioner: POST /api/ai/mpa/meal-plan (mode fresh|onboard, days, meals, adults/children, provisioning under|normal|over, note, diet, on_board) via _run (skipper's quota for crew). Dialog shows trip days (editable), under/over provisioning, note, preview with per-meal "Prep and cook" crew assignment; headings "1. Day 1 Breakfast: <meal> (Cook: <name>)".
- Galley crew (roles matching provision manager|galley lead|chef; /me/boats my_roles): sync_merge.merge_crew_galley lets them item-merge Provisions + existing meal plans and add new meal plan lists; only galley crew may call the crew meal-plan endpoint. Frontend canEditList, galleyOnly options.
- Tested iteration_120 (fixes: Annotated BoatQ, dialog stays open on first bubble); then galley-only AI check, item-level merge, DELETE 404, clone option hidden for non-cloneable lists.

## 2026-06 Cook's Rota, Make shopping list, grouped Common Meals
- Cook stored as " (Cook: Name)" suffix on meal headings (lib/mealPlans.js COOK_RE/cookOf/withCook). Edit dialog CookPicker on meal headings (names: skipper user.name/owner_name, crew_names via /boats/{id}/crew; crew get my_name from /me/boats).
- CooksRota (everyone): per cook, meals by day, ticked struck through; on meal plan lists and on crew home (hidden there while a meal plan list is open); "Your turns" highlight matches my_name exactly. MPA strips the cook suffix from meal names.
- "Make shopping list" (meal-plan-shopping-btn) on every meal plan for skipper and galley crew; opens MPA with that plan ticked. /ai/mpa/provisions + /ai/mpa/aisles use crew_pro.galley_payer (galley crew on Pro skipper's boat). Galley crew can save the MPA Shopping List (kind mpa) via merge_crew_galley.
- Common Meals bubbles grouped Breakfast/Lunch/Dinner/Any time (mealGroup guess from name; own meals can pick meal_type, stored in /me/meals; re-save keeps the id).
- Tested iteration_121; rota name/duplicate fixes self-verified by screenshot; backend tests 8 passed.


## 2026-06 Provisions shoppers
- Provisions items carry `shopper` (name). Edit dialog Shopper picker (CookPicker with label/testId), Assign shoppers dialog (tick several), amber basket badge in Checklist. Names: skipper, crew_names, pending invites.
- Invites: crewMessage + email add "Food to bring on board" (InviteIn.shopping, crew.shopping_html). Crew dialog rows: SendShoppingButton (email via POST /boats/{id}/crew/shopping, or copy for WhatsApp).
- Print view: "· basket Name" per item + "Who's buying what" summary on Provisions.
- Galley crew can assign; merge_crew_galley now also merges item-level content edits (item ts newer) when list_ts isn't bumped.
- Tested iteration_122 + retest iteration_123 (100%).



## 2026-06 Boat area zone picker + foldable overview colours
- Each top-level boat area row has a zone icon (4 little coloured squares) right of the F/D toggles: greyed when the area has no zone, the zone's colour once picked. Tap opens AreaZoneButton dialog listing boatZones(boat) as "Label – Colour" (no "No zone" option). Saves area.zone {label, colour}; area.zone now wins over zone map photo pins in areaZones.
- Skipper and crew on Food & Drink areas can change it (sync_merge.merge_crew_areas accepts crew zone on top-level F&D areas, validated label<=60, colour<=20).
- Zone Map Overview: "Colours" toggle folds Magically Place Colours, hint and palette; Remove this overview stays visible. Folded state in localStorage mbp_overview_colours_folded_{boatId}.
- Mobile: row action icons are 34px under sm so 6 icons fit at 390px. Tested iteration_124 + self-check.

## 2026-06 ++ Batch Magic Scan zone prompt
- The ++ button (Add boat areas by zone > More options) opens BatchZonePrompt: pick exactly one zone (e.g. Galley – Orange), then BatchScanDialog opens tagged to that zone. "Scan the whole boat instead" shows a warning about using the 4 square picker later, then "Scan whole boat anyway". Other Batch Magic Scan buttons unchanged (user choice). No zones -> ++ opens the batch scan directly as before. Self-tested via screenshot flow.

## 2026-06 Crew check-before-sailing, list search, registration thank-you
- Zone picker: Galley first, then recently picked zones (localStorage mbp_recent_zones_{boatKey}), then map order.
- Search boxes (ListSearch.jsx) on Skipper's Tips, FAQ, and checklists/media lists whose name contains "book" or "video" (Books and eBooks, Education Videos, Latest Tech Videos).
- Photo and crew: Refresh button (reloads crew, register, pulls boat state via mbp:refresh-boat for role briefings); CrewTotals (you + joined + open invites, weight from register weight_kg else crew_weight/85 kg, ± note 3 kg/registered, 20 kg/estimate); CrewFacts per row (invited/joined ago, registered local time, agreement, provisions bringing + list sent via shopping_notes); RoleBubble popovers with briefing read state.
- Crew confirm "I've read it" per role in the agreement dialog: POST /api/crew/briefing-read (briefing_reads, hash so edited briefings need re-reading). GET /boats/{id}/crew returns briefings[], shopping_sent, invited_at/joined_at (user_boats.crew_joined set on join).
- Crew Registration: Refresh button, "Registered <local time>" on rows; requests save boat_id (owner-checked). /crew-register/mine returns vessel, already_crew, has_boat, waiting.
- Registration done view: "Thank you for registering", big tick, "The skipper of <boat> will see...crew invite will follow". No-boat users then see WaitingForInvite (also on later logins while registered with no invite) with "Close my registration window" (logout -> /login) and "I want to set up my own boat instead".
- Fixed crew list collapsing to 0 height in the Photo and crew dialog (shrink-0).
- Tested iteration_125 (100%) + fixes self-tested.

## 2026-06 Admin mode red screens
- Signed in as admin (user.is_admin): body gets class admin-mode (light red #fecaca) on every screen, the faint boat photo watermark is hidden, and a sticky red "Admin mode: changes affect every skipper" strip (AdminModeStrip.jsx, data-testid admin-mode-strip) shows at the top. Non-admins unchanged. Self-tested via screenshots (admin home, /admin, pro user).

## 2026-06 Ready to sail, Magic Fish Whisperer, simpler Magic Bartender
- Crew dialog: green "Ready to sail" badge (registered + agreement accepted + all briefings read + provisions list sent with matching count or nothing to bring) and "N of M ready to sail" count (amber unless all ready). crew/CrewFacts.jsx readyToSail.
- Magic Fish Whisperer (backend fish.py): POST /api/ai/fish (multipart photo + lat/lon/position/when, require_premium, daily Magic quota, Gemini vision via _run kind "fish"/MFW; not_fish refunds the quota). Catches saved in fish_catches with photo in object storage; GET /api/me/catches, GET /api/me/catches/{id}/photo, DELETE /api/me/catches/{id}. Frontend components/boat/fish/{FishWhispererDialog,FishReport,CatchLog}.jsx: help, tap-to-photo, GPS line, full report (species, reasons, similar, size, place/local knowledge, local + national rules, sources, questions, filleting/careful/protection, toxins, batter, sushi), "Add to my Common Meals" (POST /me/meals), catch log tab.
- Opened from app menu (under Magic Bartender) and the new fish icon right of Arrange Lists; cocktail icon opens Magic Bartender (titles on hover).
- Help panels seeded: "Admin - Help Panel - Magic Fish Whisperer" and "Admin - Help Panel - Magic Bartender" (migration magic_fish_bartender_help). MagicHelp.jsx shows until collapsed, then stays hidden (localStorage mbp_help_fish / mbp_help_bartender).
- Magic Bartender simplified: help + big photo tap area + collapsed "Drinks (D) and food (F) boat areas" section (use-photo, areas, Batch Magic Scan, summary); Mix enabled once there are ingredients. BartenderHelp.jsx removed.
- Tested iteration_126 (100%), follow-ups self-tested.

## 2026-06 Fish Whisperer handles shellfish and other seafood
- Prompt + parse_fish add kind (fish|shellfish), safety {biotoxins, gathering}, cooking [{name, ingredients, steps}], size.count. Shellfish report shows "Biotoxins and safe gathering", "Bag limits, sizes and closures", "Cleaning and preparing", up to 3 "Cook it" methods (no batter) and "Eating it raw?". UI copy says fish or shellfish. Self-tested with a real mussel photo.

## 2026-06 Catch map + Tom placeholder
- Magic Fish Whisperer "Catch map" tab (fish/CatchMap.jsx, rendered by CatchLog view="map"): leaflet OSM + OpenSeaMap, circle pins orange fish / purple shellfish, species filter chips with counts, fit to shown pins, tap pin -> card -> full report ("Back to the map"); catches without GPS counted below the map. Self-tested via screenshots with seeded catches (cleaned up).
- "Serviced by" placeholder now "e.g. Tom (owner)" (lib/maint.js).

## 2026-06 Catch in Ship's Log + Share my catch
- POST /api/ai/fish takes optional boat_id/owner_id; fish.log_catch pushes a Ship's Log item (label "Catch on <when> by <Skipper|crew name>: species (scientific), size, at place, position ...", catch_id) into the boat's data.shipsLog + pushed_items; crew catches go into the skipper's log. Skipper's app adds it locally (BoatPrep logCatch).
- "Share my catch" (fish/ShareCatchButton.jsx, lib/catchCard.js): 1080x1350 JPEG card (photo, species, scientific, size, place name only, date, footer) via navigator.share with files, else download + caption copied. Self-tested (crew log via curl, card download via Playwright).

## 2026-06 Zone schematic done, zone folds, Print Cards (QR), QR Magic Scan
- Additional details: read-only ticked "Zone Map Schematic Done" (zone-map-done) replaces the schematic chooser when boatZones(boats.current) is non-empty; hint on hover (title) and tap (toast).
- Boat details magic row: "Batch / Magic Scan..." and "Arrange / Lists" two-line labels, fish + cocktail icons on the same line (no wrap at 390px).
- Boat Inventory zone headings "<zone> - <cupboards>" are fold toggles; folds remembered in localStorage mbp_zone_folds_{boatKey}; search ignores folds.
- Print Cards (inventory/FolderCardsButton.jsx) with QR Codes (default) / Contents radios. QR: POST /api/inventory/qr-cards.pdf (folder_cards.py, reportlab QR, 90x54 mm, 10 per A4, swatch + zone + area name + parent). Contents = old folder cards (sliced to 200).
- QR scanning: card URL <origin>/?scan_area=<id>&b=<boat_id>&o=<owner>. lib/qrScan.js captureQr() on load (localStorage mbp_qr_scan, 30 min, survives login), BoatShell switches boat, BoatPrep opens Boat Inventory, InventoryList (after store loaded) opens inventory/QrScanDialog: multi-photo Magic Scan, merge same names, edit, Add (default) or Replace. Crew only for F/D areas (scan with shopping=true&owner).
- Tested iteration_127; cold-load QR bug fixed (gated on loaded) and self-verified.

## 2026-06 Zone focus + palette two rows
- Boat Inventory zone headings: "Show only this zone" (folds every other zone) / "Show all zones" when focused; chevron at left.
- Zone Map Overview: colours section can't fold until a colour is placed (always shows Magically Place Colours); palette shows first two rows with "Show N other zones, and their colours" / "Show fewer colours", remembered per boat (localStorage mbp_overview_all_colours_{boat_id}). Measured with ResizeObserver. Self-tested via screenshots.

## 2026-06 QR take out / used + quick count
- QrScanDialog third mode "Take out / used": +/- per listed item (capped at qty) or photo (Magic Scan names matched via lib/qrStock matchItem; unmatched toasted). Save reduces qty; 0 -> qty 0 + removed (restock), same as applyConsumed.
- After any QR save the dialog shows QrQuickCount: "<area> now holds N items" (sum of qty of in-place items), different things count, Low stock list (qty 1 amber "Only 1 left", removed/0 red "None left"). lib/qrStock.js applyQr shared by dialog + InventoryList.saveQr. Sticky Cancel/Save bar. Self-tested via Playwright (add, take out, counts).

## 2026-06 Delete this list button on every own list
- BoatPrep default checklist branch: red "Delete this list" button (list-delete-list-btn, bin icon) at the bottom for non-crew, non-empty lists, except Ship's Log and EMERGENCY lists; opens the existing Delete list confirm dialog (two taps). Maint/Budget/Media lists keep their own buttons.
- Fixed a stray "}" rendered at the bottom of every list page (extra brace after FishWhispererDialog).

## 2026-06 — Mayday / Pan-Pan distress emails
- Boat Details: new Shore contact email (same field as Ship's Log shore contact, boat.shore_email) and Coastguard email (boat.coastguard_email) under Email.
- Mayday/Pan-Pan panels: red "Send to Coastguard Email" button at top (online + valid coastguard email only); background send; Sent (green tick) / Could not send (red cross, tap to retry).
- Opening Mayday/Pan-Pan (header or list, online): inline Yes/No prompt for coastguard; shore contact emailed automatically once per session per kind. Re-fires when coming back online on the panel.
- Subject "MAYDAY|PAN-PAN VESSEL NAME X, CALLSIGN: Y, POSITION Z"; body = all panel text. Position = live fix, else last known fix with time (localStorage mbp_last_fix), else UNKNOWN.
- Backend: POST /api/distress-email (backend/distress_email.py), 30/day per user, logged in db.distress_emails. Tested: iteration_142 (100%).
- 2026-06 follow-up: Coastguard email REMOVED (legal). Field, prompt, button and boat.coastguard_email (unset in DB) gone. Only the shore contact auto-email (once per session per kind) remains; /api/distress-email no longer takes `target`.

## 2026-06 Skipper's comment on zone map photos
- Per-photo comment (zone_maps[].comment, <=500) typed in Edit labels (ZonePinEditor), saved via PUT /boats/{id}/zone-maps/{map}/pins {comment}. Shown under the photo everywhere (Zone maps list, full dialog, Zone dialog big view, Crew walkthrough every stop, Crew Agreement stops).
- Walkthrough + agreement stops show "Cupboard: <full name>" above the photo.
- Removing a photo with a comment warns first (RemoveMapConfirm) with Copy comment. Tested iteration_143 (100%).
- 2026-06 follow-up: a zone map photo with a Skipper's comment but no labels is now one walkthrough stop of its own (pin id "comment"; frontend walkSteps + backend crew_agreement.map_pins for stop_ids, walk-stops, agreement PDF). Comment-only stops hide Cupboard/contents. Empty text: "The skipper hasn't labelled a zone map or commented on one yet, so there are no stops to tick." Charter terms stops unchanged.

## 2026-06 Crew "Ticked by" on Done badge
- Crew ticks stamped server-side with checked_by (crew_names name) in sync_merge.merge_crew_ticks; untick clears. Skipper ticks clear names (stampTicks in TickBadge.jsx). Done badge (TickBadge) shows "· Ticked by X" on hover (desktop) or press-and-hold 450ms (phone) without toggling. Select All undo restores names. Tested iteration_144 (100%).

## 2026-06 Cupboard comments
- Top-level cupboards have area.comment (<=300) entered in Edit cupboard below "Where is it in the <zone>?" (AreaEditDialog). Shown as "Cupboard comment" on that cupboard's walkthrough stops (CrewWalkthrough, Crew Agreement stops) - skipped stops are hidden so the comment is too.
- Walkthrough stops panel (WalkStopsPicker): Comment bubble per stop toggles the comment; amber warning lists commented cupboards with no label on any photo, with "Label it on <photo>" opening ZonePinEditor (focusArea preselected once); panel stays open after save. Picker root data-no-dirty (no false discard prompt). Tested iteration_145.

## 2026-06 Remove crew walkthrough badge
- Crew Registration walkthrough badge has an x (RegRow onClearWalk) -> confirm -> DELETE /api/crew-register/{entry_id}/walkthroughs/{boat_id}: deletes walkthroughs (no quick accept) and unsets agreements.<uid> on that boat so crew on board redo the agreement + full walkthrough. Self-tested (UI + curl).
