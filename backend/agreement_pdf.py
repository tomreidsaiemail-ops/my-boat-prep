from io import BytesIO
from html import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from ship_log import ITEM, META, TITLE

H2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, leading=17, spaceBefore=10, spaceAfter=4)
SMALL = ParagraphStyle("s", parent=ITEM, fontSize=10, leading=13)
GOOD = ParagraphStyle("g", parent=ITEM, fontName="Helvetica-Bold", textColor=colors.HexColor("#047857"))
WARN = ParagraphStyle("w", parent=ITEM, fontName="Helvetica-Bold", textColor=colors.HexColor("#b45309"))


def _day(iso: str) -> str:
    return f"{iso[8:10]}/{iso[5:7]}/{iso[:4]} {iso[11:16]} UTC"


def _lines(text: str) -> str:
    return escape(text).replace("\n", "<br/>")


def build_agreement_pdf(a: dict) -> bytes:
    """a: vessel, skipper, crew_name, crew_email, roles [(role, briefing)], terms [{label, indent}], boat_terms, stops [(name, ticked)], agreement."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"Boat Terms and Conditions Agreement - {a['crew_name']}", author="My Boat Prep")
    rec = a.get("agreement") or {}
    meta = Table([[Paragraph(f"<b>VESSEL:</b> {escape(a['vessel'])}", META), Paragraph(f"<b>SKIPPER:</b> {escape(a['skipper'])}", META)],
                  [Paragraph(f"<b>CREW MEMBER:</b> {escape(a['crew_name'])}", META), Paragraph(f"<b>EMAIL:</b> {escape(a['crew_email'])}", META)]],
                 colWidths=[87 * mm, 87 * mm])
    meta.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.2, colors.black), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    status = (Paragraph(f"Read and accepted on {_day(rec['accepted_at'])}", GOOD) if rec.get("accepted_at")
              else Paragraph("Not accepted yet", WARN))
    story = [Paragraph("BOAT TERMS AND CONDITIONS AGREEMENT", TITLE), Spacer(1, 4), meta, Spacer(1, 8), status]
    story.append(Paragraph("Standard terms", H2))
    story += [Paragraph(("&nbsp;&nbsp;&nbsp;&nbsp;" if t.get("indent") else "") + f"&bull; {escape(t['label'])}", ITEM) for t in a["terms"]] or [Paragraph("None", SMALL)]
    if a["boat_terms"].strip():
        story.append(Paragraph(f"{escape(a['vessel'])}'s terms", H2))
        story += [Paragraph(f"&bull; {escape(ln.strip())}", ITEM) for ln in a["boat_terms"].splitlines() if ln.strip()]
    story.append(Paragraph("Role briefing", H2))
    if a["roles"]:
        story += [Paragraph(f"<b>{escape(r)}</b><br/>{_lines(b) if b else '<i>No briefing from the skipper yet.</i>'}", ITEM) for r, b in a["roles"]]
    else:
        story.append(Paragraph("No role given yet.", SMALL))
    # Only the stops this crew member walked through; stops left out of their walkthrough aren't mentioned.
    story.append(Paragraph("Boat Walk Through", H2))
    if a["stops"]:
        rows = [[Paragraph("[X]", ITEM), Paragraph(escape(name), ITEM)] for name in a["stops"]]
        tbl = Table(rows, colWidths=[12 * mm, 162 * mm])
        tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
                                 ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        story += [Paragraph(f"{len(a['stops'])} {'stop' if len(a['stops']) == 1 else 'stops'} walked through", SMALL), Spacer(1, 4), tbl]
    else:
        story.append(Paragraph("No stops walked through yet.", SMALL))
    doc.build(story)
    return buf.getvalue()
