"""Buyer Handover Pack: the welcome email a new owner gets, a short summary first, then every zone, cupboard and the maintenance history."""
import html
import re

from db import db

e = html.escape
LOGS = (("engine_log", "Engine service log"), ("electrical_log", "Electrical service log"), ("rigging_log", "Rigging check log"))
H2 = "font-family:Arial,sans-serif;color:#0B1F3A;border-bottom:2px solid #0B1F3A;padding-bottom:4px;margin-top:28px"


def area_zones(doc: dict) -> dict:
    """Same rules as the app: the cupboard's own zone, else a pin on a Zone Map Photo, and boxes follow their cupboard."""
    areas, out = doc.get("areas") or [], {}
    for a in areas:
        if (a.get("zone") or {}).get("label"):
            out[a["id"]] = a["zone"]["label"]
    for n, m in enumerate(doc.get("zone_maps") or []):
        for p in m.get("pins") or []:
            if p.get("area_id") and p["area_id"] not in out:
                out[p["area_id"]] = m.get("zone") or m.get("name") or f"Zone Map {n + 1}"
    for _ in range(3):
        for a in areas:
            if a.get("parent_id") in out and a["id"] not in out:
                out[a["id"]] = out[a["parent_id"]]
    return out


def items_of(a: dict) -> list:
    return [i for i in a.get("items") or [] if not i.get("removed") and str(i.get("name") or "").strip()]


def qty(i: dict) -> str:
    q = i.get("qty")
    return "" if q in (None, "", 1, "1") else f" ×{e(str(q))}"


async def maintenance_lists(doc: dict) -> list:
    """Lists in the Boat Maintenance category (from Admin - List Categories), except the Ship's Log."""
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": r"^\s*admin - list categories\s*$", "$options": "i"}}, {"_id": 0, "items": 1})
    names, inside = set(), False
    for i in (tpl or {}).get("items") or []:
        label = str(i.get("label") or "").strip()
        if re.match(r"^\d+\.", label):
            inside = "maint" in label.lower()
        elif inside and label and not label.startswith("*") and "ship" not in label.lower():
            names.add(label.lower())
    data = doc.get("data") or {}
    return [(r["name"], data.get(r["id"]) or []) for r in doc.get("registry") or [] if str(r.get("name") or "").strip().lower() in names and data.get(r.get("id"))]


def zone_tree(doc: dict) -> list:
    areas = doc.get("areas") or []
    zones, kids = area_zones(doc), {}
    for a in areas:
        kids.setdefault(a.get("parent_id"), []).append(a)
    groups = {}
    for a in kids.get(None, []) + [a for a in areas if a.get("parent_id") and a["parent_id"] not in {x["id"] for x in areas}]:
        groups.setdefault(zones.get(a["id"]) or "No zone", []).append(a)
    return [(z, groups[z], kids) for z in sorted(groups, key=lambda k: (k == "No zone", k.lower()))]


def cupboard_html(a: dict, kids: dict, depth: int = 0) -> str:
    food = " <span style=\"color:#b45309\">(Food &amp; Drink, emptied on sale)</span>" if a.get("food") or a.get("drinks") else ""
    rows = "".join(f"<li>{e(str(i['name']))}{qty(i)}</li>" for i in items_of(a)) or "<li style=\"color:#777\"><i>Empty</i></li>"
    inner = "".join(cupboard_html(k, kids, depth + 1) for k in kids.get(a["id"], []))
    return (f"<div style=\"margin:8px 0 8px {depth * 16}px;padding:6px 10px;border-left:3px solid #0B1F3A\"><b>{e(str(a.get('name') or 'Cupboard'))}</b>{food}"
            f"<ul style=\"margin:4px 0\">{rows}</ul>{inner}</div>")


def log_html(title: str, rows: list) -> str:
    out = "".join(f"<li><b>{e(str(r.get('date') or ''))}</b>{' · ' + e(str(r['hours'])) + ' hours' if r.get('hours') not in (None, '') else ''}"
                  f"{' · ' + e(str(r['engine_type'])) if r.get('engine_type') else ''}: {e('; '.join(str(x) for x in r.get('items') or []))}"
                  f"{' (' + e(str(r['notes'])) + ')' if r.get('notes') else ''}</li>" for r in rows)
    return f"<h3 style=\"font-family:Arial,sans-serif\">{e(title)} ({len(rows)})</h3><ul>{out}</ul>"


async def handover_pack(doc: dict, seller: str, when: str, app_url: str) -> tuple[str, str]:
    vessel = (doc.get("boat") or {}).get("vessel") or "Your boat"
    areas, tree = doc.get("areas") or [], zone_tree(doc)
    tops = [a for a in areas if not a.get("parent_id")]
    logs = [(t, doc.get(k) or []) for k, t in LOGS if doc.get(k)]
    lists = await maintenance_lists(doc)
    n_items = sum(len(items_of(a)) for a in areas)
    ship = len((doc.get("data") or {}).get("shipsLog") or [])
    glance = [("Zones", len([z for z, _, _ in tree if z != "No zone"])), ("Cupboards", len(tops)), ("Boxes and folders", len(areas) - len(tops)),
              ("Items in the inventory", n_items), ("Maintenance log entries", sum(len(r) for _, r in logs)),
              ("Maintenance lists", len(lists)), ("Ship's Log entries", ship)]
    summary = "".join(f"<tr><td style=\"padding:4px 12px 4px 0\">{e(k)}</td><td><b>{v}</b></td></tr>" for k, v in glance)
    zones_html = "".join(f"<h3 style=\"font-family:Arial,sans-serif;margin-bottom:4px\">{e(z)}</h3>" + "".join(cupboard_html(a, kids) for a in rows) for z, rows, kids in tree)
    lists_html = "".join(f"<h3 style=\"font-family:Arial,sans-serif\">{e(n)}</h3><ul>" + "".join(
        f"<li>{'☑' if i.get('checked') else '☐'} {e(str(i.get('label') or ''))}</li>" for i in items) + "</ul>" for n, items in lists)
    body = (f"<div style=\"font-family:Arial,sans-serif;color:#1f2937;max-width:680px\">"
            f"<h1 style=\"color:#0B1F3A\">Welcome aboard {e(vessel)}</h1>"
            f"<p>{e(seller)} transferred {e(vessel)} to you on My Boat Prep on {e(when)}. Here's your handover pack.</p>"
            f"<h2 style=\"{H2}\">At a glance</h2><table>{summary}</table>"
            "<p>The boat comes with no crew, an empty Route Planning, and empty Food &amp; Drink cupboards. "
            f"Crew names in the Ship's Log are hidden. Open <a href=\"{app_url}\">My Boat Prep</a> and pick {e(vessel)} from your boats.</p>"
            f"<div style=\"page-break-before:always\"></div><h2 style=\"{H2}\">Zones and cupboards</h2>{zones_html or '<p>No cupboards yet.</p>'}"
            f"<h2 style=\"{H2}\">Maintenance history</h2>{''.join(log_html(t, r) for t, r in logs) or '<p>No maintenance logs recorded.</p>'}"
            f"{lists_html}</div>")
    return f"Welcome aboard {vessel}: your handover pack", body
