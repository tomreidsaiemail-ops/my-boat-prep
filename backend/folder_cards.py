from io import BytesIO
from html import escape
from typing import List
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Table, TableStyle
from auth import get_current_user

router = APIRouter(prefix="/api")

CARD_W, CARD_H = 95 * mm, 136 * mm
MAX_LINES = 22
NAME = ParagraphStyle("card_name", fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=colors.HexColor("#0f2a4a"))
WHERE = ParagraphStyle("card_where", fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#475569"))
LINE = ParagraphStyle("card_line", fontName="Helvetica", fontSize=9.5, leading=12)
FOOT = ParagraphStyle("card_foot", fontName="Helvetica-Oblique", fontSize=7.5, leading=9, textColor=colors.HexColor("#64748b"))


class CardItem(BaseModel):
    name: str = Field(max_length=200)
    qty: int = Field(default=1, ge=0, le=99999)
    removed: bool = False


class Card(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parent: str = Field(default="", max_length=120)
    zone: str = Field(default="", max_length=80)
    items: List[CardItem] = Field(default_factory=list, max_length=400)


class CardsIn(BaseModel):
    vessel: str = Field(default="", max_length=120)
    cards: List[Card] = Field(min_length=1, max_length=200)


def _card(c: Card, vessel: str) -> list:
    where = " · ".join(x for x in [f"Lives in: {c.parent}" if c.parent else "", f"Zone map: {c.zone}" if c.zone else ""] if x)
    out = [Paragraph(escape(c.name), NAME), Paragraph(escape(where or "Boat area"), WHERE), Paragraph("&nbsp;", WHERE)]
    shown, lines = [], 0
    for i in c.items:
        need = 1 + len(i.name) // 46
        if lines + need > MAX_LINES:
            break
        shown.append(i)
        lines += need
    for i in shown:
        out.append(Paragraph(f"&#9744;&nbsp; {escape(i.name)} <font color='#475569'>x{i.qty}</font>{' <i>(removed for now)</i>' if i.removed else ''}", LINE))
    if not c.items:
        out.append(Paragraph("Nothing listed yet.", LINE))
    if len(c.items) > len(shown):
        out.append(Paragraph(f"+ {len(c.items) - len(shown)} more in the My Boat Prep app", WHERE))
    out.append(Paragraph(f"{escape(vessel)} · My Boat Prep contents card", FOOT))
    return out


def build_cards_pdf(p: CardsIn) -> bytes:
    """Quarter-page cards, four to an A4 page, with dashed cut lines, to slip inside each folder or box."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=10 * mm, rightMargin=10 * mm, topMargin=10 * mm, bottomMargin=10 * mm,
                            title="Folder and box contents cards", author="My Boat Prep")
    cells = [_card(c, p.vessel or "My Boat") for c in p.cards]
    story = []
    for n in range(0, len(cells), 4):
        page = cells[n:n + 4] + [""] * (4 - len(cells[n:n + 4]))
        tbl = Table([page[:2], page[2:]], colWidths=[CARD_W] * 2, rowHeights=[CARD_H] * 2)
        tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#94a3b8"), None, (3, 3)),
                                 ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8)]))
        if story:
            story.append(PageBreak())
        story.append(tbl)
    doc.build(story)
    return buf.getvalue()


@router.post("/inventory/folder-cards.pdf")
async def folder_cards_pdf(payload: CardsIn, user: dict = Depends(get_current_user)):
    return Response(content=build_cards_pdf(payload), media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="Folder and box contents cards.pdf"'})
