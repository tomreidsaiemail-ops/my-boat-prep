import re
from datetime import datetime, timezone
from uuid import uuid4
from db import db

MAYDAY_TEMPLATE = "ADMIN - MAYDAY TEMPLATE"
PANPAN_TEMPLATE = "ADMIN - PAN-PAN TEMPLATE"
_OTHER = "Other information - there are <POB> persons on board (POB). The boat is a <BOAT COLOUR> <BOAT TYPE>. Length <LENGTH>. <Optional MMSI Number>"
MAYDAY_LINES = [
    "Tune VHF Radio to Channel 16", "Transmit: MAYDAY MAYDAY MAYDAY", "This is <BOAT NAME>, <BOAT NAME>, <BOAT NAME>", "Callsign <CALLSIGN>",
    "MAYDAY <BOAT NAME> <CALLSIGN>", "We are at (state your general geographical position) at position <GPS>", "Nature of distress and what assistance is required",
    _OTHER, "OVER",
    "Allow a short time for a response. If no reply, repeat the distress call, working through all the distress frequencies on the radio. "
    "If contact is made with a shore station, tell them you have activated your distress beacon and follow their instructions.",
]
PANPAN_LINES = [
    "Tune VHF Radio to Channel 16", "Transmit: PAN-PAN PAN-PAN PAN-PAN", "ALL STATIONS, ALL STATIONS, ALL STATIONS", "This is <BOAT NAME>, <BOAT NAME>, <BOAT NAME>",
    "Callsign <CALLSIGN>", "We are at (state your general geographical position) at position <GPS>", "Nature of urgency and what assistance is required",
    _OTHER, "OVER",
    "Allow a short time for a response. If no reply, repeat the urgency call, working through all the frequencies on the radio. "
    "If contact is made with a shore station, tell them you are ready to activate your distress beacon and follow their instructions.",
]
TAGS_NOTE = "Fill-in tags: <BOAT NAME> <CALLSIGN> <GPS> <POB> <BOAT COLOUR> <BOAT TYPE> <LENGTH> <Optional MMSI Number> (left out when there's no MMSI)."


async def seed_radio_templates():
    """Runs once: the MAYDAY and PAN-PAN call scripts every skipper's lists follow, editable by the admin."""
    if await db.migrations.find_one({"_id": "radio_templates_v1"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    for name, lines, what in ((MAYDAY_TEMPLATE, MAYDAY_LINES, "MAYDAY"), (PANPAN_TEMPLATE, PANPAN_LINES, "PAN-PAN")):
        if not await db.list_templates.find_one({"custom": True, "name": {"$regex": rf"^\s*{re.escape(name)}\s*$", "$options": "i"}}, {"_id": 1}):
            await db.list_templates.insert_one({"list_id": f"tpl_{uuid4().hex[:10]}", "custom": True, "name": name, "private": True,
                                                "description": f"Every skipper's {what} list follows this when they sign in, one step per line. {TAGS_NOTE}",
                                                "items": [{"id": n + 1, "label": t} for n, t in enumerate(lines)], "created_at": now, "updated_at": now, "updated_by": "system"})
    await db.migrations.insert_one({"_id": "radio_templates_v1", "at": now})


# Same rules as frontend/src/lib/radioScript.js fillRadio.
_TAG = re.compile(r"<\s*([A-Za-z][A-Za-z ]*[A-Za-z])\s*>")
_PAIR = re.compile(r"<\s*BOAT\s*COLOU?R\s*>\s*<\s*BOAT\s*TYPE\s*>", re.I)
_OPTIONAL = {"OPTIONALMMSINUMBER"}


def _low(v) -> str:
    return str(v or "").strip().lower()


def _colour(c: dict) -> str:
    h, d = _low(c.get("hull")), _low(c.get("deck"))
    return "" if not h or not d else h if h == d else f"{h} hull and {d} deck"


_NATO = dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey X-ray Yankee Zulu".split()))


def phonetic(cs) -> str:
    """ "ZMT123" reads "ZMT123 - Zulu Mike Tango 123"."""
    s = str(cs or "").strip()
    parts = re.findall(r"[A-Z]|\d+", s.upper())
    return f"{s} - {' '.join(_NATO.get(p, p) for p in parts)}" if any(p in _NATO for p in parts) else s


def _value(key: str, c: dict):
    """The tag's text, "" when the detail is blank, None for a tag the scripts don't know."""
    mmsi = c.get("mmsi") or ""
    vals = {"BOATNAME": c.get("vessel"), "VESSEL": c.get("vessel"), "VESSELNAME": c.get("vessel"), "CALLSIGN": phonetic(c.get("callsign")), "GPS": c.get("position"),
            "POSITION": c.get("position"), "POB": c.get("pob"), "BOATCOLOUR": _colour(c), "BOATCOLOR": _colour(c), "BOATTYPE": c.get("boat_type"),
            "LENGTH": c.get("length"), "MMSI": mmsi, "OPTIONALMMSINUMBER": f"MMSI {mmsi}." if mmsi else ""}
    return str(vals[key] or "").strip() if key in vals else None


def fill_radio(text: str, c: dict) -> str:
    def pair(m):
        t, col = (c.get("boat_type") or "").strip(), _colour(c)
        if not t or not col:
            return m.group(0)
        return f"{col} {t}" if _low(c.get("hull")) == _low(c.get("deck")) else f"{t} with a {_low(c.get('hull'))} hull and {_low(c.get('deck'))} deck"

    def tag(m):
        key = re.sub(r"[^A-Z]", "", m.group(1).upper())
        v = _value(key, c)
        return m.group(0) if v is None else v or ("" if key in _OPTIONAL else m.group(0))
    return re.sub(r"\s{2,}", " ", _TAG.sub(tag, _PAIR.sub(pair, str(text or "")))).strip()
