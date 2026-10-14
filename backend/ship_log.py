from io import BytesIO
from html import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib import colors

TITLE = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=22, leading=26, spaceAfter=4)
META = ParagraphStyle("m", fontName="Helvetica", fontSize=10, leading=14)
ITEM = ParagraphStyle("i", fontName="Helvetica", fontSize=12, leading=16)
DONE = ParagraphStyle("d", parent=ITEM, textColor=colors.HexColor("#555555"))


def log_title(log: dict) -> str:
    return f"Ship's Log - {log['vessel']} ({log['callsign']}) - {log['local_date']}"


def render_items(items: list, local_date: str) -> list:
    out = []
    for it in items:
        label = it.get("label", "")
        if it.get("dynamic") == "logDate":
            label = label.replace("[DATE]", local_date)
        out.append({"label": label, "checked": bool(it.get("checked"))})
    return out


def build_pdf(log: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=log_title(log), author="My Boat Prep")
    meta = Table([[Paragraph(f"<b>VESSEL:</b> {escape(log['vessel'])}", META), Paragraph(f"<b>SKIPPER:</b> {escape(log['skipper'])}", META)],
                  [Paragraph(f"<b>CALLSIGN:</b> {escape(log['callsign'])}", META), Paragraph(f"<b>DATE:</b> {escape(log['local_date'])}", META)]],
                 colWidths=[87 * mm, 87 * mm])
    meta.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.2, colors.black), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    rows = [[Paragraph("[X]" if i["checked"] else "[  ]", ITEM), Paragraph(escape(i["label"]), DONE if i["checked"] else ITEM)] for i in log["items"]]
    story = [Paragraph("SHIP'S LOG", TITLE), Spacer(1, 4), meta, Spacer(1, 12)]
    if rows:
        tbl = Table(rows, colWidths=[12 * mm, 162 * mm])
        tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
                                 ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
        story.append(tbl)
    story += [Spacer(1, 24), Paragraph("Checked by (Skipper): ______________________________ &nbsp;&nbsp; Time: __________", META)]
    doc.build(story)
    return buf.getvalue()


def build_email_html(log: dict, pdf_url: str, from_name: str) -> str:
    rows = "".join(
        f'<tr><td style="padding:8px 10px 8px 0;border-bottom:1px solid #e2e8f0;width:24px;vertical-align:top;font-weight:bold">{"&#10003;" if i["checked"] else "&#9744;"}</td>'
        f'<td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:15px;color:#0f172a">{escape(i["label"])}</td></tr>'
        for i in log["items"]
    )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0f172a">'
        '<h1 style="margin:0 0 4px;font-size:22px">Ship\'s Log</h1>'
        f'<p style="margin:0 0 16px;font-size:14px;color:#475569">{escape(log["vessel"])} &middot; Callsign {escape(log["callsign"])} &middot; Skipper {escape(log["skipper"])} &middot; {escape(log["local_date"])}</p>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>'
        f'<p style="margin:24px 0"><a href="{escape(pdf_url)}" style="background:#0f172a;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Download Ship\'s Log PDF</a></p>'
        '<p style="font-size:13px;color:#475569">Print it and add it to the Ship\'s Log binder on board.</p>'
        f'<p style="font-size:12px;color:#888888">Sent by {escape(from_name)}. We never ask for your password or card details by email.</p>'
        '</td></tr></table>'
    )
