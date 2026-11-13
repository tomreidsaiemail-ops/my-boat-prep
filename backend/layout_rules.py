"""The skipper's layout comment as strict placement rules, and a check of a drawn plan against them (bow right: port = top half, starboard = bottom half)."""
import asyncio
import base64
import json
import logging
import os
import re
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

log = logging.getLogger(__name__)
TEXT_MODEL = VISION_MODEL = "gemini-2.5-flash"
AREAS = ("galley", "nav station", "saloon", "cabin", "heads")
SIDE_TEXT = {"port": "TOP half of the picture (port)", "starboard": "BOTTOM half of the picture (starboard)", "centre": "on the centre line"}
POS_TEXT = {"forward": "in the RIGHT third (forward, towards the bow)", "midships": "in the MIDDLE third (midships)", "aft": "in the LEFT third (aft, towards the stern)"}

PARSE_PROMPT = """A skipper described the interior layout of their boat:
"{comment}"
Turn it into placement rules. Areas: galley, nav station, saloon, cabin, heads (a "head", toilet or WC is heads; a v-berth or fore peak berth is a cabin).
For each area the skipper places, give side (port, starboard, centre or "") and position along the boat (forward, midships, aft or "").
"fore peak" and "v berth" mean forward and centre; "aft of the saloon" means aft_of "saloon"; "forward of X" means forward_of "X".
Give one rule per cabin and per heads. cabins and heads are the totals the skipper states (0 if not stated).
Reply with strict JSON only: {{"cabins": 0, "heads": 0, "rules": [{{"area": "galley", "side": "port", "position": "midships", "aft_of": "", "forward_of": ""}}]}}"""

LOCATE_PROMPT = """This is a top-down boat interior layout plan. First say which way the bow (the pointed end) points: up, down, left or right.
Then list every labelled area of the interior (cabins, heads, galley, nav station, saloon and so on) with the exact label text and the centre of
that area as x and y fractions of the picture width and height (0 = left/top, 1 = right/bottom). Ignore the words PORT, STARBOARD and BOW.
Reply with strict JSON only: {"bow": "right", "areas": [{"label": "Galley", "x": 0.5, "y": 0.3}]}"""


def _json(text) -> dict:
    m = re.search(r"\{.*\}", str(text), re.S)
    return json.loads(m.group(0)) if m else {}


def _clean(v, allowed) -> str:
    v = str(v or "").strip().lower()
    return v if v in allowed else ""


async def parse_rules(comment: str, session: str) -> dict:
    """{"cabins", "heads", "rules"}; empty rules when there's no comment or it can't be read."""
    if not comment.strip():
        return {"cabins": 0, "heads": 0, "rules": []}
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session, system_message="You turn boat layout descriptions into strict JSON.").with_model("gemini", TEXT_MODEL)
        raw = _json(await asyncio.wait_for(chat.send_message(UserMessage(text=PARSE_PROMPT.format(comment=comment[:300]))), 40))
    except Exception as e:
        log.warning(f"Layout comment parse failed: {e!r}")
        return {"cabins": 0, "heads": 0, "rules": []}
    rules = []
    for r in raw.get("rules") or []:
        area = _clean(r.get("area"), AREAS) if isinstance(r, dict) else ""
        if area:
            rules.append({"area": area, "side": _clean(r.get("side"), SIDE_TEXT), "position": _clean(r.get("position"), POS_TEXT),
                          "aft_of": _clean(r.get("aft_of"), AREAS), "forward_of": _clean(r.get("forward_of"), AREAS)})
    count = lambda k: int(raw.get(k) or 0) if str(raw.get(k) or "0").isdigit() else 0  # noqa: E731
    return {"cabins": min(count("cabins"), 8), "heads": min(count("heads"), 6), "rules": rules[:16]}


def rule_text(r: dict) -> str:
    where = [SIDE_TEXT[r["side"]] if r["side"] else "", POS_TEXT[r["position"]] if r["position"] else "",
             f"directly left of (aft of) the {r['aft_of'].title()}" if r["aft_of"] else "", f"directly right of (forward of) the {r['forward_of'].title()}" if r["forward_of"] else ""]
    return f"{'A ' if r['area'] in ('cabin', 'heads') else ''}{r['area'].title()}: " + ", ".join(w for w in where if w)


def rules_prompt(parsed: dict) -> str:
    if not parsed["rules"] and not parsed["cabins"] and not parsed["heads"]:
        return ""
    lines = [f"- {rule_text(r)}" for r in parsed["rules"] if r["side"] or r["position"] or r["aft_of"] or r["forward_of"]]
    counts = " ".join(f"There are exactly {n} {k}{'' if k == 'heads' else 's'} in total, no more and no fewer: only the ones placed above. "
                      f"Do not add any other {'heads, toilets or washrooms' if k == 'heads' else 'cabins or sleeping cabins'} anywhere, even if this model usually has them."
                      for k, n in (("cabin", parsed["cabins"]), ("heads", parsed["heads"])) if n)
    return ("STRICT LAYOUT RULES from the skipper. These are fixed positions, not suggestions; they override anything you know about this model:\n"
            + "\n".join(lines) + (f"\n{counts}" if counts else "") + "\n")


def _kind(label: str) -> str:
    s = label.lower()
    if re.search(r"galley|kitchen", s):
        return "galley"
    if re.search(r"\bnav|chart", s):
        return "nav station"
    if re.search(r"saloon|salon|dinette|lounge", s):
        return "saloon"
    if re.search(r"cabin|berth|stateroom|owner", s):
        return "cabin"
    if re.search(r"\bheads?\b|toilet|\bwc\b|bathroom", s):
        return "heads"
    return ""


def _fits(r: dict, a: dict, found: dict) -> bool:
    x, y = a["x"], a["y"]
    side = {"port": y < 0.5, "starboard": y > 0.5, "centre": 0.3 <= y <= 0.7}.get(r["side"], True)
    pos = {"forward": x > 0.58, "midships": 0.28 <= x <= 0.72, "aft": x < 0.42}.get(r["position"], True)
    ref = lambda k: found.get(k) or []  # noqa: E731
    aft = all(x < o["x"] for o in ref(r["aft_of"])) if r["aft_of"] and ref(r["aft_of"]) else True
    fwd = all(x > o["x"] for o in ref(r["forward_of"])) if r["forward_of"] and ref(r["forward_of"]) else True
    return side and pos and aft and fwd


def check(parsed: dict, located: dict) -> list[str]:
    """Plain-English problems with the drawn plan; [] when it follows every rule."""
    problems = []
    bow = str(located.get("bow") or "").lower()
    if bow and bow != "right":
        problems.append(f"The bow points {bow}; it must point right (stern on the left, port at the top, starboard at the bottom).")
    found = {}
    for a in located.get("areas") or []:
        try:
            k, x, y = _kind(str(a.get("label", ""))), float(a["x"]), float(a["y"])
        except (KeyError, TypeError, ValueError):
            continue
        if k:
            found.setdefault(k, []).append({"label": a.get("label"), "x": x, "y": y})
    for k, n in (("cabin", parsed["cabins"]), ("heads", parsed["heads"])):
        if n and len(found.get(k, [])) != n:
            problems.append(f"It shows {len(found.get(k, []))} {k}{'' if k == 'heads' else 's'}; the skipper has exactly {n}.")
    used = set()
    for r in parsed["rules"]:
        if not (r["side"] or r["position"] or r["aft_of"] or r["forward_of"]):
            continue
        cands = [(i, a) for i, a in enumerate(found.get(r["area"], [])) if (r["area"], i) not in used]
        hit = next(((i, a) for i, a in cands if _fits(r, a, found)), None)
        if hit:
            used.add((r["area"], hit[0]))
        elif not found.get(r["area"]):
            problems.append(f"There is no {r['area'].title()} where the skipper said: {rule_text(r)}.")
        else:
            problems.append(f"The {r['area'].title()} is in the wrong place. It must be: {rule_text(r).split(': ', 1)[1]}.")
    return problems


async def locate(data: bytes, session: str) -> dict | None:
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session, system_message="You read boat plans and reply with strict JSON.").with_model("gemini", VISION_MODEL)
        return _json(await asyncio.wait_for(chat.send_message(UserMessage(text=LOCATE_PROMPT, file_contents=[ImageContent(image_base64=base64.b64encode(data).decode())])), 45))
    except Exception as e:
        log.warning(f"Plan check failed: {e!r}")
        return None
