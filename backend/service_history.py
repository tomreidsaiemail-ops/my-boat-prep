import asyncio
import logging
import re
from html import escape
from io import BytesIO
from typing import List, Literal, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from auth import require_premium
from db import db
from photos import get_object
from ship_log import META, TITLE

router = APIRouter(prefix="/api")

CELL = ParagraphStyle("c", fontName="Helvetica", fontSize=10, leading=13)
HEAD = ParagraphStyle("h", parent=CELL, fontName="Helvetica-Bold", textColor=colors.white)
FOOT = ParagraphStyle("f", parent=CELL, fontSize=8, textColor=colors.HexColor("#64748b"))
KINDS = {"engine": ("Engine Service History", "Engine hours"), "electrical": ("Electrical Service History", "Electrician")}
LONG_NOTES = 300


class ServiceEntry(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    hours: Optional[float] = None
    electrician: Optional[str] = Field(default=None, max_length=80)
    notes: str = Field(default="", max_length=2000)
    items: List[str] = Field(default=[], max_length=200)


class ServicePhoto(BaseModel):
    item: str = Field(max_length=1000)
    slot: Literal["Before", "After"]
    photo_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    note: str = Field(default="", max_length=80)


class ServicePdfIn(BaseModel):
    kind: Literal["engine", "electrical"]
    vessel: str = Field(default="", max_length=80)
    skipper: str = Field(default="", max_length=80)
    callsign: str = Field(default="", max_length=40)
    local_date: str = Field(default="", max_length=40)
    entries: List[ServiceEntry] = Field(default=[], max_length=1000)
    boat_id: str = Field(default="", max_length=80)
    photos: List[ServicePhoto] = Field(default=[], max_length=60)


def _d(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{d}/{m}/{y}"


def _who(kind: str, e: ServiceEntry, by: bool = False) -> str:
    if kind == "engine":
        return "" if e.hours is None else f"{e.hours:g} hrs"
    return f"{'by ' if by and e.electrician else ''}{e.electrician or ''}"


PHOTO_W = 82 * mm


def _photo_cell(data: bytes, slot: str, note: str) -> list:
    w, h = ImageReader(BytesIO(data)).getSize()
    scale = min(PHOTO_W / w, 70 * mm / h)
    return [Paragraph(f"<b>{slot}</b>", CELL), Image(BytesIO(data), width=w * scale, height=h * scale), Paragraph(escape(note), FOOT)]


def _photo_section(photos: list) -> list:
    """Each item's before and after photos side by side, with captions, after the history table."""
    by_item = {}
    for ph, data in photos:
        try:
            cell = _photo_cell(data, ph.slot, ph.note)
        except Exception:
            logging.getLogger(__name__).warning("service pdf photo %s is not a readable image", ph.photo_id)
            continue
        by_item.setdefault(ph.item, {})[ph.slot] = cell
    if not by_item:
        return []
    out = [Spacer(1, 14), Paragraph("PHOTOS", TITLE), Spacer(1, 4)]
    for item, slots in by_item.items():
        cells = [slots.get("Before", ""), slots.get("After", "")]
        tbl = Table([[c if c else "" for c in cells]], colWidths=[87 * mm, 87 * mm])
        tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#cbd5e1"))]))
        out.append(KeepTogether([Paragraph(f"<b>{escape(item)}</b>", CELL), Spacer(1, 3), tbl, Spacer(1, 8)]))
    return out


def build_service_pdf(p: ServicePdfIn, photos: list = ()) -> bytes:
    title, col = KINDS[p.kind]
    entries = sorted(p.entries, key=lambda e: e.date, reverse=True)
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"{title} - {p.vessel}", author="My Boat Prep")
    meta = Table([[Paragraph(f"<b>VESSEL:</b> {escape(p.vessel)}", META), Paragraph(f"<b>SKIPPER:</b> {escape(p.skipper)}", META)],
                  [Paragraph(f"<b>CALLSIGN:</b> {escape(p.callsign)}", META), Paragraph(f"<b>PRINTED:</b> {escape(p.local_date)}", META)]],
                 colWidths=[87 * mm, 87 * mm])
    meta.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.2, colors.black), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    last = f" · last service {_d(entries[0].date)}" + (f" ({_who(p.kind, entries[0], True)})" if _who(p.kind, entries[0]) else "") if entries else ""
    story = [Paragraph(escape(title.upper()), TITLE), Spacer(1, 4), meta, Spacer(1, 8),
             Paragraph(f"<b>{len(entries)} service{'s' if len(entries) != 1 else ''} logged</b>{escape(last)}", META), Spacer(1, 8)]
    if entries:
        rows = [[Paragraph(h, HEAD) for h in ("Date", col, "Work done", "Notes")]]
        spans = []
        for e in entries:
            long_notes = len(e.notes) > LONG_NOTES
            rows.append([Paragraph(_d(e.date), CELL), Paragraph(escape(_who(p.kind, e)), CELL),
                         Paragraph("<br/>".join(f"• {escape(i)}" for i in e.items) or "-", CELL), Paragraph("See below" if long_notes else escape(e.notes) or "-", CELL)])
            if long_notes:
                rows.append([Paragraph(f"<b>Notes:</b> {escape(e.notes)}", CELL), "", "", ""])
                spans.append(("SPAN", (0, len(rows) - 1), (-1, len(rows) - 1)))
        tbl = Table(rows, colWidths=[24 * mm, 30 * mm, 70 * mm, 50 * mm], repeatRows=1)
        tbl.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f2a44")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                 ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
                                 ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                                 ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), *spans]))
        story.append(tbl)
    else:
        story.append(Paragraph("No services logged yet.", CELL))
    if photos:
        story += _photo_section(photos)
    story += [Spacer(1, 14), Paragraph("Kept with My Boat Prep (myboatprep.com) from the skipper's own records.", FOOT)]
    doc.build(story)
    return buf.getvalue()


async def _load_photos(user_id: str, p: ServicePdfIn) -> list:
    if not p.photos or not p.boat_id:
        return []
    ids = [ph.photo_id for ph in p.photos]
    docs = {d["photo_id"]: d async for d in db.item_photos.find({"photo_id": {"$in": ids}, "owner_id": user_id, "boat_id": p.boat_id, "is_deleted": False}, {"_id": 0})}

    async def fetch(ph):
        doc = docs.get(ph.photo_id)
        if not doc:
            return None
        try:
            return ph, await asyncio.to_thread(get_object, doc["path"])
        except Exception:
            logging.getLogger(__name__).warning("service pdf photo %s not loaded", ph.photo_id)
            return None
    return [r for r in await asyncio.gather(*(fetch(ph) for ph in p.photos)) if r]


@router.post("/service-history/pdf")
async def service_history_pdf(payload: ServicePdfIn, user: dict = Depends(require_premium)):
    name = f"{KINDS[payload.kind][0]} - {payload.vessel or 'My Boat'}"
    ascii_name = re.sub(r"[^A-Za-z0-9 ._-]", "", name).strip() or "Service History"
    disposition = f"attachment; filename=\"{ascii_name}.pdf\"; filename*=UTF-8''{quote(name + '.pdf')}"
    photos = await _load_photos(user["user_id"], payload)
    return Response(build_service_pdf(payload, photos), media_type="application/pdf", headers={"Content-Disposition": disposition})
