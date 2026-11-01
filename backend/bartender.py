import asyncio
import json
import re
from typing import List
from urllib.parse import quote_plus
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from auth import require_premium
from ai_lists import _run

router = APIRouter(prefix="/api")
MAX_COCKTAILS = 12
COCKTAIL_DB = "https://www.thecocktaildb.com/api/json/v1/1/search.php"
BARTENDER = ("You are the Magic Bartender in the My Boat Prep app: a fun, practical bartender on a boat. "
             "From the ingredients on board, suggest up to 12 cocktails. List first the ones that can be made with what is on board now, "
             "then ones missing only 1 or 2 ingredients, and say exactly what is missing. Never suggest one missing more than 2 ingredients. "
             "Use the standard, well-known name of each cocktail (e.g. 'Mojito', 'Moscow Mule') so it can be looked up. "
             "Assume water, ice, sugar and salt are available. "
             'Reply with JSON only, no code fences: {"cocktails": [{"name": "<cocktail>", "uses": ["<ingredient on board>"], "missing": ["<ingredient to buy>"]}]}')


class BartenderIn(BaseModel):
    ingredients: List[str] = Field(min_length=1, max_length=300)


def _names(raw, limit: int) -> List[str]:
    out = []
    for x in raw if isinstance(raw, list) else []:
        s = str(x or "").strip()[:60]
        if s and s.lower() not in (o.lower() for o in out):
            out.append(s)
    return out[:limit]


def parse_cocktails(text: str) -> list:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON")
    out, seen = [], set()
    for c in json.loads(match.group(0)).get("cocktails", []) or []:
        name = str((c or {}).get("name", "")).strip()[:80]
        missing = _names(c.get("missing"), 3)
        if not name or name.lower() in seen or len(missing) > 2:
            continue
        seen.add(name.lower())
        out.append({"name": name, "uses": _names(c.get("uses"), 12), "missing": missing})
    if not out:
        raise ValueError("no cocktails")
    return out[:MAX_COCKTAILS]


def _key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


async def cocktail_photo(client: httpx.AsyncClient, name: str) -> str:
    """A real photo from TheCocktailDB when the cocktail is listed there, else ''."""
    try:
        drinks = (await client.get(COCKTAIL_DB, params={"s": name})).json().get("drinks") or []
    except Exception:
        return ""
    want = _key(name)
    hit = next((d for d in drinks if _key(d.get("strDrink", "")) == want), None) or next((d for d in drinks if want and _key(d.get("strDrink", "")).startswith(want)), None)
    thumb = (hit or {}).get("strDrinkThumb") or ""
    return f"{thumb}/medium" if thumb.startswith("https://") else ""


def youtube_search(name: str) -> str:
    return f"https://www.youtube.com/results?search_query={quote_plus(f'how to make a {name} cocktail')}"


@router.post("/ai/bartender")
async def bartender(body: BartenderIn, user: dict = Depends(require_premium)):
    ingredients = _names(body.ingredients, 300)
    prompt = "Ingredients on board:\n" + "\n".join(f"- {i}" for i in ingredients)
    cocktails, left = await _run(user, "bartender", prompt, parse_cocktails, {"name": "Magic Bartender", "count": len(ingredients)}, BARTENDER, "The Magic Bartender")
    async with httpx.AsyncClient(timeout=6) as client:
        photos = await asyncio.gather(*(cocktail_photo(client, c["name"]) for c in cocktails))
    return {"cocktails": [{**c, "photo": p, "youtube": youtube_search(c["name"])} for c, p in zip(cocktails, photos)], "asks_left": left}
