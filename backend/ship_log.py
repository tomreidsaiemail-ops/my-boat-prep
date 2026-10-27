from io import BytesIO
from html import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak
from reportlab.lib import colors

TITLE = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=22, leading=26, spaceAfter=4)
META = ParagraphStyle("m", fontName="Helvetica", fontSize=10, leading=14)
ITEM = ParagraphStyle("i", fontName="Helvetica", fontSize=12, leading=16)
DONE = ParagraphStyle("d", parent=ITEM, textColor=colors.HexColor("#555555"))
FLAG = ParagraphStyle("f", parent=ITEM, fontName="Helvetica-Bold", textColor=colors.HexColor("#b91c1c"))


def log_lists(log: dict) -> list:
    return log.get("lists") or [{"name": "Ship's Log", "items": log.get("items", [])}]


def log_title(log: dict) -> str:
    lists = log_lists(log)
    name = lists[0]["name"] if len(lists) == 1 else "Vessel Manifest Master Logs"
    return f"{name} - {log['vessel']} ({log['callsign']}) - {log['local_date']}"


def _label(it: dict, ctx: dict) -> str:
    v, c, pos = ctx["vessel"], ctx["callsign"], ctx["position"]
    return {
        "logDate": it.get("label", "").replace("[DATE]", ctx["local_date"]),
        "maydayVessel": f"This is {v}, {v}, {v}",
        "maydayCallsign": f"Callsign {c}",
        "maydayVesselCallsign": f"MAYDAY {v} {c}",
        "maydayGps": f"Report position {pos}",
        "panPanGps": f"Check GPS position {pos}",
    }.get(it.get("dynamic"), it.get("label", ""))


def render_items(items: list, ctx: dict) -> list:
    return [{"label": _label(it, ctx), "checked": bool(it.get("checked")), "flagged": bool(it.get("flagged")), "indent": bool(it.get("indent")) and n > 0}
            for n, it in enumerate(items)]


def _item_para(i: dict) -> Paragraph:
    if i.get("flagged"):
        return Paragraph("FLAGGED: " + escape(i["label"]), FLAG)
    return Paragraph(escape(i["label"]), DONE if i["checked"] else ITEM)


def _pdf_row(mark: str, i: dict) -> list:
    # Sub-items sit one column in, under their parent item.
    if i.get("indent"):
        return [Paragraph("", ITEM), Table([[Paragraph(mark, ITEM), _item_para(i)]], colWidths=[12 * mm, 150 * mm],
                                           style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)])]
    return [Paragraph(mark, ITEM), _item_para(i)]


def build_pdf(log: dict) -> bytes:
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
        rows = [_pdf_row(mark(n, i), i) for n, i in enumerate(lst["items"], 1)]
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
        f'<tr><td style="padding:8px 10px 8px 0;border-bottom:1px solid #e2e8f0;width:24px;vertical-align:top;font-weight:bold">{"&#10003;" if i["checked"] else "&#9744;"}</td>'
        f'<td style="padding:8px 0 8px {"24px" if i.get("indent") else "0"};border-bottom:1px solid #e2e8f0;font-size:15px;{"color:#b91c1c;font-weight:bold" if i.get("flagged") else "color:#0f172a"}">{"&#9873; " if i.get("flagged") else ""}{escape(i["label"])}</td></tr>'
        for i in items
    )


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
