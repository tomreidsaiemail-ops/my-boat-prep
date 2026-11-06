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

