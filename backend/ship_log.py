from io import BytesIO
from html import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Image, SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors

TITLE = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=22, leading=26, spaceAfter=4)
META = ParagraphStyle("m", fontName="Helvetica", fontSize=10, leading=14)
ITEM = ParagraphStyle("i", fontName="Helvetica", fontSize=12, leading=16)
DONE = ParagraphStyle("d", parent=ITEM, textColor=colors.HexColor("#555555"))
FLAG = ParagraphStyle("f", parent=ITEM, fontName="Helvetica-Bold", textColor=colors.HexColor("#b91c1c"))
NOTE = ParagraphStyle("n", fontName="Helvetica", fontSize=9, leading=11, textColor=colors.HexColor("#475569"))


def log_lists(log: dict) -> list:
    return log.get("lists") or [{"name": "Ship's Log", "items": log.get("items", [])}]


def log_title(log: dict) -> str:
    lists = log_lists(log)
    name = lists[0]["name"] if len(lists) == 1 else "Vessel Manifest Master Logs"
    return f"{name} - {log['vessel']} ({log['callsign']}) - {log['local_date']}"


MMSI_LABEL = "or MMSI Number (Optional, skipper to delete or add one)"


def _pet_words(pets: list) -> str:
    named = [p for p in pets or [] if (p.get("type") or "").strip() or (p.get("name") or "").strip()]
    if not named:
        return ""
    kinds = [f"{'an' if t[:1] in 'aeiou' else 'a'} {t}" for t in ((p.get("type") or "pet").strip().lower() for p in named)]
    joined = f"{', '.join(kinds[:-1])} and {kinds[-1]}" if len(kinds) > 1 else kinds[0]
    return f" Also {'1 pet' if len(named) == 1 else f'{len(named)} pets'} on board: {joined}."


def _pob_words(ctx: dict) -> str:
    pob = ctx.get("pob") or 1
    kids = min(ctx.get("children") or 0, pob)
    pets = _pet_words(ctx.get("pets"))
    if not kids:
        return f"{pob} persons on board POB.{pets}"
    n = lambda k, one, many: f"{k} {one if k == 1 else many}"  # noqa: E731
    return f"{pob} persons on board POB, {n(pob - kids, 'adult', 'adults')} and {n(kids, 'child', 'children')}.{pets}"


def _label(it: dict, ctx: dict) -> str:
    v, c, pos = ctx["vessel"], ctx["callsign"], ctx["position"]
    mmsi = f", MMSI {ctx['mmsi']}" if ctx.get("mmsi") else ""
    return {
        "logDate": it.get("label", "").replace("[DATE]", ctx["local_date"]),
        "maydayVessel": f"This is {v}, {v}, {v}",
        "maydayCallsign": f"Callsign {c}{mmsi}",
        "maydayVesselCallsign": f"MAYDAY {v} {c}",
        "maydayGps": f"Report position {pos}",
        "panPanGps": f"Check GPS position {pos}",
        "panPanPosition": f"Report position {pos}",
        "panPanVessel": f"This is {v}, {v}, {v}. Callsign {c}{mmsi}",
        "pobDescription": f"There are {_pob_words(ctx)} The boat is a white {ctx.get('boat_type') or '[BOAT TYPE]'}. NOTE: If not white state correct colour of boat.",
    }.get(it.get("dynamic"), f"(MMSI {ctx['mmsi']} is included above)" if it.get("id") == 400 and ctx.get("mmsi") and it.get("label") == MMSI_LABEL else it.get("label", ""))


def _mpa_label(m: dict) -> str:
    parts = [m.get("base", ""), "".join(f"({s})" for s in m.get("src") or []), "".join(f"[{n}]" for n in m.get("meals") or [])]
    return " ".join(p for p in parts if p)


# MPA shopping rows keep their PROV and on-board badges as text in exports (only while the row is unedited).
def _with_badges(it: dict, label: str) -> str:
    m = it.get("mpa")
    if not isinstance(m, dict) or label != _mpa_label(m):
        return label
    subs = [f"{a}: {x.get('name', '')}" for x in m.get("subs") or [] for a in x.get("areas") or []]
    tags = (["PROV"] if m.get("prov") else []) + ([f"On board: {', '.join(m['areas'])}"] if m.get("areas") else []) \
        + ([f"On board instead: {', '.join(subs)}"] if subs else [])
    return f"{label} · {' · '.join(tags)}" if tags else label


def _key(v):
    return str(v) if isinstance(v, (int, float, str)) else None


def arrange_log(items: list) -> list:
    """Ship's Log folders: each passage or year folder is followed by its logs (items point at their folder with `in`)."""
    if not any(isinstance(it, dict) and it.get("folder") for it in items):
        return items
    by = {_key(it.get("id")): it for it in items if _key(it.get("id")) is not None}

    def parent(it):
        p = _key(it.get("in"))
        return p if p is not None and p != _key(it.get("id")) and (by.get(p) or {}).get("folder") else None
    kids, out, seen = {}, [], set()
    for it in items:
        if parent(it):
            kids.setdefault(parent(it), []).append(it)

    def walk(it, depth):
        if id(it) in seen:
            return
        seen.add(id(it))
        out.append({**it, "_depth": depth})
        if it.get("folder"):
            for k in kids.get(_key(it.get("id")), []):
                walk(k, depth + 1)
    for it in items:
        if not parent(it):
            walk(it, 0)
    return out


def render_items(items: list, ctx: dict) -> list:
    items = arrange_log(items)
    return [{"label": _with_badges(it, _label(it, ctx)), "checked": bool(it.get("checked")), "flagged": bool(it.get("flagged")), "indent": bool(it.get("indent")) and n > 0,
             "depth": it.get("_depth") or (1 if it.get("indent") and n > 0 else 0), **({"folder": True} if it.get("folder") else {}),
             **({"answer": str(it.get("mmd_answer") or it.get("detail"))} if it.get("mmd_answer") or it.get("detail") else {}),
             **({"photos": [{"photo_id": str(ph.get("photo_id", "")), "note": str(ph.get("note") or "")[:600]} for ph in it["weather_photos"][:5] if isinstance(ph, dict)]}
                if isinstance(it.get("weather_photos"), list) and it["weather_photos"] else {})}
            for n, it in enumerate(items)]


def _item_para(i: dict) -> Paragraph:
    if i.get("folder"):
        return Paragraph("<b>" + escape(i["label"]) + "</b>", ITEM)
    if i.get("flagged"):
        return Paragraph("FLAGGED: " + escape(i["label"]), FLAG)
    answer = f'<br/><font size="9" color="#475569">{escape(i["answer"]).replace(chr(10), "<br/>")}</font>' if i.get("answer") else ""
    return Paragraph(escape(i["label"]) + answer, DONE if i["checked"] else ITEM)


def _photos_block(i: dict, images: dict) -> list:
    """Weather and routing screenshots logged with a departure, two to a row with the skipper's note under each."""
    cells = []
    for ph in i.get("photos") or []:
        data = images.get(ph.get("photo_id"))
        if not data:
            continue
        try:
            w, h = ImageReader(BytesIO(data)).getSize()
        except Exception:
            continue
        scale = min(76 * mm / w, 62 * mm / h)
        cells.append([Image(BytesIO(data), width=w * scale, height=h * scale), Paragraph(escape(ph.get("note") or ""), NOTE)])
    if not cells:
        return []
    rows = [cells[n:n + 2] + [""] * (2 - len(cells[n:n + 2])) for n in range(0, len(cells), 2)]
    return [Spacer(1, 4), Table(rows, colWidths=[78 * mm, 78 * mm], style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)])]


def _cell(i: dict, images: dict):
    extra = _photos_block(i, images) if i.get("photos") else []
    return [_item_para(i), *extra] if extra else _item_para(i)


def _pdf_row(mark: str, i: dict, images: dict = None) -> list:
    # Sub-items sit one column in, under their parent item; Ship's Log folder contents step in once per folder level.
    depth = i.get("depth") or (1 if i.get("indent") else 0)
    if i.get("folder"):
        mark = ""
    if depth:
        pad = min(depth - 1, 4) * 8 * mm
        return [Paragraph("", ITEM), Table([["", Paragraph(mark, ITEM), _cell(i, images or {})]], colWidths=[pad, 12 * mm, 150 * mm - pad],
                                           style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)])]
    return [Paragraph(mark, ITEM), _cell(i, images or {})]


def log_photo_ids(log: dict) -> set:
    return {ph["photo_id"] for lst in log_lists(log) for i in lst.get("items", []) for ph in i.get("photos") or []}


def build_pdf(log: dict, images: dict = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=log_title(log), author="My Boat Prep")
    meta = Table([[Paragraph(f"<b>VESSEL:</b> {escape(log['vessel'])}", META), Paragraph(f"<b>SKIPPER:</b> {escape(log['skipper'])}", META)],
                  [Paragraph(f"<b>CALLSIGN:</b> {escape(log['callsign'])}", META), Paragraph(f"<b>DATE:</b> {escape(log['local_date'])}", META)],
                  [Paragraph(f"<b>BOAT TYPE:</b> {escape(log.get('boat_type') or '-')}", META), Paragraph(f"<b>POB:</b> {log.get('pob') or 1}", META)]],
                 colWidths=[87 * mm, 87 * mm])
    meta.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.2, colors.black), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story = []
    for n, lst in enumerate(log_lists(log)):
        if n:
            story.append(PageBreak())
        mark = (lambda n, i: f"{n}.") if lst.get("numbered") else (lambda n, i: "[X]" if i["checked"] else "[  ]")
        rows = [_pdf_row(mark(n, i), i, images) for n, i in enumerate(lst["items"], 1)]
        story += [Paragraph(escape(lst["name"].upper()), TITLE), Spacer(1, 4), meta, Spacer(1, 12)]
        if rows:
            tbl = Table(rows, colWidths=[12 * mm, 162 * mm])
            tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
                                     ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
            story.append(tbl)
    doc.build(story)
    return buf.getvalue()


def build_email_html(log: dict, pdf_url: str, from_name: str) -> str:
    lists = log_lists(log)
    heading = lists[0]["name"] if len(lists) == 1 else "Vessel Manifest Master Logs"
    if len(lists) == 1:
        rows = _item_rows(lists[0]["items"])
    else:
        rows = "".join(f'<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:15px">{escape(lst["name"])} ({len(lst["items"])} items)</td></tr>' for lst in lists)
    return _wrap(log, heading, rows, pdf_url, from_name)


def _item_rows(items: list) -> str:
    return "".join(
        f'<tr><td style="padding:8px 10px 8px {24 * min(i.get("depth") or (1 if i.get("indent") else 0), 5)}px;border-bottom:1px solid #e2e8f0;width:24px;vertical-align:top;font-weight:bold">{"" if i.get("folder") else "&#10003;" if i["checked"] else "&#9744;"}</td>'
        f'<td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:15px;{"color:#b91c1c;font-weight:bold" if i.get("flagged") else "font-weight:bold;color:#0f172a" if i.get("folder") else "color:#0f172a"}">{"&#9873; " if i.get("flagged") else ""}{escape(i["label"])}{_answer_html(i)}</td></tr>'
        for i in items
    )


def _answer_html(i: dict) -> str:
    pics = f'<br/><span style="font-size:13px;color:#475569">+ {len(i["photos"])} weather and routing photos with notes (see the PDF)</span>' if i.get("photos") else ""
    if not i.get("answer"):
        return pics
    return f'<br/><span style="font-size:13px;color:#475569">{escape(i["answer"]).replace(chr(10), "<br/>")}</span>{pics}'


def _wrap(log: dict, heading: str, rows: str, pdf_url: str, from_name: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0f172a">'
        f'<h1 style="margin:0 0 4px;font-size:22px">{escape(heading)}</h1>'
        f'<p style="margin:0 0 16px;font-size:14px;color:#475569">{escape(log["vessel"])} &middot; Callsign {escape(log["callsign"])} &middot; Skipper {escape(log["skipper"])}{" &middot; " + escape(log["boat_type"]) if log.get("boat_type") else ""} &middot; POB {log.get("pob") or 1} &middot; {escape(log["local_date"])}</p>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>'
        f'<p style="margin:24px 0"><a href="{escape(pdf_url)}" style="background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Download PDF</a></p>'
        '<p style="font-size:13px;color:#475569">Print it and add it to the binder on board.</p>'
        f'<p style="font-size:12px;color:#888888">Sent by {escape(from_name)}. We never ask for your password or card details by email.</p>'
        '</td></tr></table>'
    )
