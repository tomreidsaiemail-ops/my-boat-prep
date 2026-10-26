from html import escape
from io import BytesIO
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from auth import require_premium
from ship_log import META, TITLE

router = APIRouter(prefix="/api")

CELL = ParagraphStyle("c", fontName="Helvetica", fontSize=10, leading=13)
HEAD = ParagraphStyle("h", parent=CELL, fontName="Helvetica-Bold", textColor=colors.white)
FOOT = ParagraphStyle("f", parent=CELL, fontSize=8, textColor=colors.HexColor("#64748b"))
KINDS = {"engine": ("Engine Service History", "Engine hours"), "electrical": ("Electrical Service History", "Electrician")}


class ServiceEntry(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    hours: Optional[float] = None
    electrician: Optional[str] = Field(default=None, max_length=80)
    notes: str = Field(default="", max_length=300)
    items: List[str] = Field(default=[], max_length=200)


class ServicePdfIn(BaseModel):
    kind: Literal["engine", "electrical"]
    vessel: str = Field(default="", max_length=80)
    skipper: str = Field(default="", max_length=80)
    callsign: str = Field(default="", max_length=40)
    local_date: str = Field(default="", max_length=40)
    entries: List[ServiceEntry] = Field(default=[], max_length=1000)


def _d(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{d}/{m}/{y}"


def _who(kind: str, e: ServiceEntry) -> str:
    if kind == "engine":
        return "" if e.hours is None else f"{e.hours:g} hrs"
    return e.electrician or ""


def build_service_pdf(p: ServicePdfIn) -> bytes:
    title, col = KINDS[p.kind]
    entries = sorted(p.entries, key=lambda e: e.date, reverse=True)
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"{title} - {p.vessel}", author="My Boat Prep")
    meta = Table([[Paragraph(f"<b>VESSEL:</b> {escape(p.vessel)}", META), Paragraph(f"<b>SKIPPER:</b> {escape(p.skipper)}", META)],
                  [Paragraph(f"<b>CALLSIGN:</b> {escape(p.callsign)}", META), Paragraph(f"<b>PRINTED:</b> {escape(p.local_date)}", META)]],
                 colWidths=[87 * mm, 87 * mm])
    meta.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.2, colors.black), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    last = f" · last service {_d(entries[0].date)}" + (f" ({_who(p.kind, entries[0])})" if _who(p.kind, entries[0]) else "") if entries else ""
    story = [Paragraph(escape(title.upper()), TITLE), Spacer(1, 4), meta, Spacer(1, 8),
             Paragraph(f"<b>{len(entries)} service{'s' if len(entries) != 1 else ''} logged</b>{escape(last)}", META), Spacer(1, 8)]
    if entries:
        rows = [[Paragraph(h, HEAD) for h in ("Date", col, "Work done", "Notes")]]
        rows += [[Paragraph(_d(e.date), CELL), Paragraph(escape(_who(p.kind, e)), CELL),
                  Paragraph("<br/>".join(f"• {escape(i)}" for i in e.items) or "-", CELL), Paragraph(escape(e.notes) or "-", CELL)] for e in entries]
        tbl = Table(rows, colWidths=[24 * mm, 30 * mm, 70 * mm, 50 * mm], repeatRows=1)
        tbl.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f2a44")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                 ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                                 ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                                 ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        story.append(tbl)
    else:
        story.append(Paragraph("No services logged yet.", CELL))
    story += [Spacer(1, 14), Paragraph("Kept with My Boat Prep (myboatprep.com) from the skipper's own records.", FOOT)]
    doc.build(story)
    return buf.getvalue()


@router.post("/service-history/pdf")
async def service_history_pdf(payload: ServicePdfIn, _: dict = Depends(require_premium)):
    name = f"{KINDS[payload.kind][0]} - {payload.vessel or 'My Boat'}".replace('"', "").replace("/", "-")
    return Response(build_service_pdf(payload), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'})
