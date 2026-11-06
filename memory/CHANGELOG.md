# My Boat Prep - Changelog (continued from PRD.md)

## 2026-06 Create List options + meal plan makers + galley crew
- "+" (create-list-btn) opens CreateListOptions: Clone the selected list (Copy icon, hidden when the list can't be cloned), standard Create List (+), Common Meals (UtensilsCrossed), Magic Provisioner from what's onboard / fresh (MagicProvisionerIcon = ChefHat + Sparkles).
- Common Meals: private admin template "Common Meals" (seed migration common_meals, 8 meals in "1. Meal / [recipe] / ingredients" format), GET /api/meals/common; bubbles add meals to a new or existing meal plan (lib/mealPlans.js mealItems). Own meals saved per account: GET/POST/DELETE /api/me/meals (db.user_meals).
- Magic Provisioner: POST /api/ai/mpa/meal-plan (mode fresh|onboard, days, meals, adults/children, provisioning under|normal|over, note, diet, on_board) via _run (skipper's quota for crew). Dialog shows trip days (editable), under/over provisioning, note, preview with per-meal "Prep and cook" crew assignment; headings "1. Day 1 Breakfast: <meal> (Cook: <name>)".
- Galley crew (roles matching provision manager|galley lead|chef; /me/boats my_roles): sync_merge.merge_crew_galley lets them item-merge Provisions + existing meal plans and add new meal plan lists; only galley crew may call the crew meal-plan endpoint. Frontend canEditList, galleyOnly options.
- Tested iteration_120 (fixes: Annotated BoatQ, dialog stays open on first bubble); then galley-only AI check, item-level merge, DELETE 404, clone option hidden for non-cloneable lists.
