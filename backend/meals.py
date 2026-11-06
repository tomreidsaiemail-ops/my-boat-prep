import json
import re
import uuid
from datetime import datetime, timezone
from typing import Annotated, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from db import db
from auth import get_current_user
from crew_pro import galley_payer
from ai_lists import PROVISIONER, _run, with_diet

router = APIRouter(prefix="/api")
BoatQ = Annotated[Optional[str], Query(pattern=r"^[A-Za-z0-9_-]{1,80}$")]
MY_MEALS_MAX = 200


@router.get("/meals/common")
async def common_meals(_: dict = Depends(get_current_user)):
    """The admin 'Common Meals' template: '1. Meal' lines with an indented [recipe] line and ingredient lines."""
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": r"^\s*common meals\s*$", "$options": "i"}}, {"_id": 0, "items": 1})
    return {"items": (tpl or {}).get("items") or []}


class MyMealIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    recipe: str = Field(default="", max_length=1000)
    ingredients: List[str] = Field(default_factory=list, max_length=40)
    meal_type: Optional[Literal["breakfast", "lunch", "dinner", "any"]] = None


def _meal_out(d: dict) -> dict:
    return {"id": d["id"], "name": d["name"], "recipe": d.get("recipe", ""), "ingredients": d.get("ingredients", []), "meal_type": d.get("meal_type")}


@router.get("/me/meals")
async def my_meals(user: dict = Depends(get_current_user)):
    return {"meals": [_meal_out(d) for d in await db.user_meals.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(MY_MEALS_MAX)]}


@router.post("/me/meals")
async def add_my_meal(body: MyMealIn, user: dict = Depends(get_current_user)):
    name = " ".join(body.name.split())
    if await db.user_meals.count_documents({"user_id": user["user_id"]}) >= MY_MEALS_MAX:
        raise HTTPException(status_code=400, detail=f"You can keep up to {MY_MEALS_MAX} of your own meals")
    doc = {"user_id": user["user_id"], "id": uuid.uuid4().hex[:12], "name": name, "recipe": " ".join(body.recipe.split()).strip("[] "),
           "ingredients": [i.strip()[:120] for i in body.ingredients if i.strip()], "meal_type": body.meal_type, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.user_meals.update_one({"user_id": user["user_id"], "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}, {"$set": doc}, upsert=True)
    return _meal_out(doc)


@router.delete("/me/meals/{meal_id}")
async def delete_my_meal(meal_id: str, user: dict = Depends(get_current_user)):
    res = await db.user_meals.delete_one({"user_id": user["user_id"], "id": meal_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {"ok": True}


class MealPlanIn(BaseModel):
    mode: Literal["onboard", "fresh"] = "fresh"
    days: int = Field(default=1, ge=1, le=60)
    meals: List[Literal["breakfast", "lunch", "dinner"]] = Field(default_factory=lambda: ["breakfast", "lunch", "dinner"], min_length=1, max_length=3)
    adults: int = Field(default=1, ge=0, le=99)
    children: int = Field(default=0, ge=0, le=99)
    provisioning: Literal["under", "normal", "over"] = "normal"
    note: str = Field(default="", max_length=300)
    diet: str = Field(default="", max_length=2000)
    on_board: List[str] = Field(default_factory=list, max_length=200)


AMOUNT = {"under": "Keep amounts lean (slightly under-provisioned), using up what is there.",
          "normal": "Use normal amounts.", "over": "Be generous with amounts (over-provisioned), with spare for hungry crew or a longer passage."}


def parse_plan(text: str, want: int) -> list:
    m = re.search(r"\{.*\}", text, re.S)
    rows = json.loads(m.group(0)).get("meals", []) if m else []
    out = []
    for r in rows if isinstance(rows, list) else []:
        name = str((r or {}).get("name", "")).strip()[:80]
        ing = [str(i).strip()[:120] for i in r.get("ingredients") or [] if str(i).strip()][:25]
        if name and ing:
            out.append({"day": int(r.get("day") or 1), "meal_type": str(r.get("meal", "")).lower() if str(r.get("meal", "")).lower() in ("breakfast", "lunch", "dinner") else "dinner",
                        "name": name, "recipe": " ".join(str(r.get("recipe", "")).split()).strip("[] ")[:600], "ingredients": ing})
    if len(out) < max(1, want // 2):
        raise ValueError("too few meals")
    return out[:want]


@router.post("/ai/mpa/meal-plan")
async def magic_meal_plan(body: MealPlanIn, boat_id: BoatQ = None, owner: BoatQ = None, me: dict = Depends(get_current_user)):
    user = await galley_payer(me, boat_id, owner)
    want = body.days * len(body.meals)
    prompt = (f"Plan {', '.join(body.meals)} for each of {body.days} days of a boat trip, for {body.adults} adults and {body.children} children. "
              "Boat galleys are small: favour simple one-pan or one-pot meals that keep well, and vary the meals. "
              f"{AMOUNT[body.provisioning]} Ingredient amounts are for ONE adult serving (a child is half), e.g. '120 g rice', '2 eggs'.\n")
    if body.mode == "onboard":
        prompt += f"Build the meals mainly from food already on board: {json.dumps(body.on_board[:200])}. Only add a few extra ingredients where really needed.\n"
    if body.note.strip():
        prompt += f"Skipper's note: {body.note.strip()}\n"
    if body.diet.strip():
        prompt = with_diet(prompt, body.diet) + "\n"
    prompt += ('Return exactly: {"meals": [{"day": 1, "meal": "breakfast|lunch|dinner", "name": "<short meal name>", '
               '"recipe": "<one or two sentence method>", "ingredients": ["<amount> <ingredient>", ...]}]}, '
               f"with {want} meals in day order.")
    meals, left = await _run(user, "mpa", prompt, lambda t: parse_plan(t, want), {"name": "Magic meal plan"}, PROVISIONER, "The Magic Provisioner")
    return {"meals": meals, "drafts_left": left}


COMMON_SEED = [
    ("Scrambled Eggs", "Whisk eggs in a bowl, saute spinach in a pan with butter until wilted, add eggs and crumbled feta, and scramble until cooked through.",
     ["4 Large eggs", "2 cups Fresh spinach", "50g Feta cheese", "1 tbsp Butter", "Salt and pepper to taste"]),
    ("Porridge", "Simmer oats in milk for 5 minutes, stirring, then top with banana and honey.", ["80g Rolled oats", "300ml Milk", "1 Banana", "1 tbsp Honey"]),
    ("Bacon Butties", "Fry the bacon until crisp, butter the bread and fill with bacon and a squeeze of sauce.", ["3 rashers Bacon", "2 slices Bread", "1 tsp Butter", "Brown sauce or ketchup"]),
    ("Ham and Cheese Wraps", "Fill each wrap with ham, cheese, lettuce and tomato, then roll up tightly.", ["2 Tortilla wraps", "4 slices Ham", "40g Cheddar cheese", "Lettuce leaves", "1 Tomato"]),
    ("Tuna Pasta Salad", "Cook the pasta, cool it, then mix with tuna, sweetcorn, mayonnaise and chopped spring onion.", ["100g Pasta", "1 can Tuna", "50g Sweetcorn", "1 tbsp Mayonnaise", "1 Spring onion"]),
    ("Chilli Con Carne", "Brown the mince with onion and garlic, add chilli, beans and tomatoes, and simmer for 20 minutes. Serve with rice.",
     ["150g Beef mince", "1/2 Onion", "1 clove Garlic", "1 tsp Chilli powder", "1/2 can Kidney beans", "1/2 can Chopped tomatoes", "80g Rice"]),
    ("Spaghetti Bolognese", "Brown the mince with onion, add tomatoes and herbs, simmer for 20 minutes and serve over spaghetti.",
     ["150g Beef mince", "1/2 Onion", "1/2 can Chopped tomatoes", "1 tsp Mixed herbs", "100g Spaghetti", "Parmesan to serve"]),
    ("Thai Green Curry", "Fry the curry paste, add chicken and coconut milk, simmer for 15 minutes with vegetables, and serve with rice.",
     ["150g Chicken thigh", "1 tbsp Green curry paste", "200ml Coconut milk", "1 handful Green beans", "80g Rice"]),
]


async def seed_common_meals():
    """Runs once: the admin 'Common Meals' template (Admin use only), offered as meal bubbles when creating a meal plan."""
    if await db.migrations.find_one({"_id": "common_meals"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    if not await db.list_templates.find_one({"custom": True, "name": {"$regex": r"^\s*common meals\s*$", "$options": "i"}}, {"_id": 1}):
        items, n = [], 1
        for k, (name, recipe, ing) in enumerate(COMMON_SEED, 1):
            items.append({"id": n, "label": f"{k}. {name}"})
            items += [{"id": n + 1, "label": f"[{recipe}]", "indent": True}] + [{"id": n + 2 + j, "label": i, "indent": True} for j, i in enumerate(ing)]
            n += 2 + len(ing)
        await db.list_templates.insert_one({"list_id": f"tpl_{uuid.uuid4().hex[:10]}", "custom": True, "name": "Common Meals", "private": True,
                                            "description": "Meals offered as bubbles when a skipper creates a meal plan. Each meal: a numbered meal name, then [the recipe], then one ingredient per line.",
                                            "items": items, "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "common_meals", "at": now})
