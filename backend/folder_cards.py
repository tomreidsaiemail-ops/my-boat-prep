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
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.pdfgen import canvas
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
    out = [Paragraph(escape(c.name), NAME), Paragraph(escape(where or "Cupboard"), WHERE), Paragraph("&nbsp;", WHERE)]
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


class QrCard(BaseModel):
    url: str = Field(min_length=10, max_length=400, pattern=r"^https?://[^\s]+$")
    name: str = Field(min_length=1, max_length=120)
    parent: str = Field(default="", max_length=120)
    zone: str = Field(default="", max_length=80)
    hex: str = Field(default="", pattern=r"^(#[0-9A-Fa-f]{6})?$")


class QrCardsIn(BaseModel):
    vessel: str = Field(default="", max_length=120)
    cards: List[QrCard] = Field(min_length=1, max_length=300)


QR_W, QR_H, QR_COLS, QR_ROWS = 90 * mm, 54 * mm, 2, 5


def _fit(c, text: str, font: str, size: float, width: float, limit: int = 3) -> list:
    """Wraps text to the card's right-hand column, at most `limit` lines, ending in … when cut short."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        nxt = f"{cur} {w}".strip()
        if c.stringWidth(nxt, font, size) <= width or not cur:
            cur = nxt
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    if len(lines) > limit:
        lines = lines[:limit]
        while lines[-1] and c.stringWidth(lines[-1] + "…", font, size) > width:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + "…"
    return lines


def _qr_card(c, card: QrCard, x: float, y: float, vessel: str):
    pad = 4 * mm
    side = QR_H - 2 * pad
    widget = QrCodeWidget(card.url, barLevel="M")
    b = widget.getBounds()
    d = Drawing(side, side, transform=[side / (b[2] - b[0]), 0, 0, side / (b[3] - b[1]), 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, x + pad, y + pad)
    tx, tw = x + pad + side + 4 * mm, QR_W - side - 3 * pad - 4 * mm + pad
    top = y + QR_H - pad - 9 * mm
    if card.hex:
        c.setFillColor(colors.HexColor(card.hex))
        c.setStrokeColor(colors.HexColor("#334155"))
        c.roundRect(tx, top, 8 * mm, 8 * mm, 1.5 * mm, stroke=1, fill=1)
    ty = top - 5 * mm
    c.setFillColor(colors.HexColor("#0f2a4a"))
    for line in _fit(c, card.zone or "No zone yet", "Helvetica-Bold", 11, tw):
        c.setFont("Helvetica-Bold", 11)
        c.drawString(tx, ty, line)
        ty -= 13
    ty -= 3
    big = 14
    for line in _fit(c, card.name, "Helvetica-Bold", big, tw):
        c.setFont("Helvetica-Bold", big)
        c.drawString(tx, ty, line)
        ty -= big + 2
    c.setFillColor(colors.HexColor("#475569"))
    if card.parent:
        c.setFont("Helvetica", 8.5)
        c.drawString(tx, ty, _fit(c, f"in {card.parent}", "Helvetica", 8.5, tw)[0])
        ty -= 11
    c.setFillColor(colors.HexColor("#475569"))
    c.setFont("Helvetica-Oblique", 7)
    c.drawString(tx, y + pad, _fit(c, f"Scan to Magic Scan · {vessel}", "Helvetica-Oblique", 7, tw)[0])


def build_qr_pdf(p: QrCardsIn) -> bytes:
    """Ten 90 x 54 mm QR cards to an A4 page, with dashed cut lines, to laminate and put in each cupboard."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle("Cupboard QR cards")
    c.setAuthor("My Boat Prep")
    pw, ph = A4
    x0, y0 = (pw - QR_COLS * QR_W) / 2, (ph + QR_ROWS * QR_H) / 2
    per = QR_COLS * QR_ROWS
    for n, card in enumerate(p.cards):
        if n and n % per == 0:
            c.showPage()
        slot = n % per
        x, y = x0 + (slot % QR_COLS) * QR_W, y0 - (slot // QR_COLS + 1) * QR_H
        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.setDash(3, 3)
        c.setLineWidth(0.6)
        c.rect(x, y, QR_W, QR_H)
        c.setDash()
        _qr_card(c, card, x, y, p.vessel or "My Boat")
    c.save()
    return buf.getvalue()


@router.post("/inventory/qr-cards.pdf")
async def qr_cards_pdf(payload: QrCardsIn, user: dict = Depends(get_current_user)):
    return Response(content=build_qr_pdf(payload), media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="Cupboard QR cards.pdf"'})
