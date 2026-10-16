import asyncio
import html
import ipaddress
import re
import socket
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional
from urllib.parse import urljoin, urlparse, parse_qs
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from db import db
from auth import get_current_user, require_admin

router = APIRouter(prefix="/api")
Kind = Literal["youtube", "movies"]
MEDIA_LISTS = {"sailingYoutube": ("youtube", "Sailing YouTube Channels"), "sailingMovies": ("movies", "Sailing Movies")}
UAS = ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "MyBoatPrep/1.0 (https://myboatprep.com; link previews)"]
META_RES = [
    re.compile(r'<meta[^>]+(?:property|name)=["\'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["\'][^>]*content=["\']([^"\']+)', re.I),
    re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\'](?:og:image|twitter:image)', re.I),
]
YT_ID = re.compile(r"^[\w-]{11}$")


class MediaIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=1, max_length=1000)
    note: str = Field(default="", max_length=160)

    @field_validator("name", "note")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("url")
    @classmethod
    def check_url(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^https?://", v, re.I):
            v = f"https://{v}"
        p = urlparse(v)
        if p.scheme not in ("http", "https") or not p.hostname or "." not in p.hostname:
            raise ValueError("Please enter a valid web link")
        return v


class OrderIn(BaseModel):
    ids: List[str] = Field(max_length=500)


def youtube_video_thumb(url: str) -> Optional[str]:
    p = urlparse(url)
    host = (p.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    vid = None
    if host == "youtu.be":
        vid = p.path.strip("/").split("/")[0]
    elif host.endswith("youtube.com"):
        if p.path == "/watch":
            vid = parse_qs(p.query).get("v", [""])[0]
        elif p.path.startswith(("/shorts/", "/embed/", "/live/")):
            vid = p.path.split("/")[2]
    return f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg" if vid and YT_ID.match(vid) else None


async def is_public_host(host: str) -> bool:
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except OSError:
        return False
    return bool(infos) and all(ipaddress.ip_address(i[4][0]).is_global for i in infos)


async def find_thumbnail(url: str) -> Optional[str]:
    quick = youtube_video_thumb(url)
    if quick:
        return quick
    if not await is_public_host(urlparse(url).hostname):
        return None
    async with httpx.AsyncClient(follow_redirects=True, timeout=8, cookies={"CONSENT": "YES+1", "SOCS": "CAI"}) as client:
        for ua in UAS:
            try:
                r = await client.get(url, headers={"User-Agent": ua, "Accept-Language": "en-US,en;q=0.9"})
            except httpx.HTTPError:
                continue
            if r.status_code != 200:
                continue
            head = r.text[:400000]
            for rx in META_RES:
                m = rx.search(head)
                if m:
                    img = urljoin(str(r.url), html.unescape(m.group(1)).strip())
                    if img.startswith("https://") or img.startswith("http://"):
                        return img
    return None


async def load_media(kind: str) -> List[dict]:
    doc = await db.media_lists.find_one({"kind": kind}, {"_id": 0})
    return (doc or {}).get("items", [])


async def store(kind: str, items: List[dict], admin: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    await db.media_lists.update_one({"kind": kind}, {"$set": {"kind": kind, "items": items, "updated_at": now, "updated_by": admin["user_id"]}}, upsert=True)
    return {"items": items, "updated_at": now}


def ensure_unique(items: List[dict], name: str, except_id: Optional[str] = None):
    if any(i["id"] != except_id and i["name"].lower() == name.lower() for i in items):
        raise HTTPException(status_code=400, detail=f"{name} already exists")


@router.get("/media/{kind}")
async def get_media(kind: Kind, _: dict = Depends(get_current_user)):
    return {"items": await load_media(kind)}


@router.post("/admin/media/{kind}")
async def add_media(kind: Kind, payload: MediaIn, admin: dict = Depends(require_admin)):
    items = await load_media(kind)
    ensure_unique(items, payload.name)
    item = {"id": str(uuid.uuid4()), **payload.model_dump(), "thumbnail": await find_thumbnail(payload.url)}
    return await store(kind, [*items, item], admin)


@router.put("/admin/media/{kind}/order")
async def reorder_media(kind: Kind, payload: OrderIn, admin: dict = Depends(require_admin)):
    items = await load_media(kind)
    by_id = {i["id"]: i for i in items}
    if sorted(payload.ids) != sorted(by_id):
        raise HTTPException(status_code=400, detail="List changed, please refresh")
    return await store(kind, [by_id[i] for i in payload.ids], admin)


@router.put("/admin/media/{kind}/{item_id}")
async def edit_media(kind: Kind, item_id: str, payload: MediaIn, admin: dict = Depends(require_admin)):
    items = await load_media(kind)
    old = next((i for i in items if i["id"] == item_id), None)
    if not old:
        raise HTTPException(status_code=404, detail="Entry not found")
    ensure_unique(items, payload.name, item_id)
    thumb = old.get("thumbnail") if old["url"] == payload.url and old.get("thumbnail") else await find_thumbnail(payload.url)
    new = {**old, **payload.model_dump(), "thumbnail": thumb}
    return await store(kind, [new if i["id"] == item_id else i for i in items], admin)


@router.delete("/admin/media/{kind}/{item_id}")
async def delete_media(kind: Kind, item_id: str, admin: dict = Depends(require_admin)):
    items = await load_media(kind)
    return await store(kind, [i for i in items if i["id"] != item_id], admin)


def media_label(i: dict) -> str:
    note = f" - {i['note']}" if i.get("note") else ""
    return f"{i['name']}{note} ({i['url']})"


async def media_list_for_pdf(list_id: str) -> dict:
    kind, name = MEDIA_LISTS[list_id]
    return {"name": name, "items": [{"label": media_label(i), "checked": False, "flagged": False} for i in await load_media(kind)], "numbered": True}
