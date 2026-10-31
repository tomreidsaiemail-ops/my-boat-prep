import asyncio
import re
from typing import List
import httpx

# YouTube addresses in generated list lines (videos, shorts, channels, playlists, youtu.be), with or without https://
YT_URL = re.compile(r"(?<![\w.])((?:https?://)?(?:www\.|m\.|music\.)?(?:youtube\.com/[^\s<>()\[\]]+|youtu\.be/[^\s<>()\[\]]+))", re.I)
TRAIL = ".,;:!?'\""
ASKS_YOUTUBE = re.compile(r"you\s?tube|youtu\.be", re.I)
OEMBED = "https://www.youtube.com/oembed"


def wants_youtube(*texts: str) -> bool:
    return any(ASKS_YOUTUBE.search(t or "") for t in texts)


def find_urls(line: str) -> List[str]:
    return [m.rstrip(TRAIL) for m in YT_URL.findall(line)]


def _full(url: str) -> str:
    return url if url.lower().startswith(("http://", "https://")) else f"https://{url}"


async def _exists(client: httpx.AsyncClient, url: str) -> bool:
    """True unless YouTube says the video or page doesn't exist; network trouble counts as found so nothing good is lost."""
    full = _full(url)
    try:
        if re.search(r"youtu\.be/|/watch\?|/shorts/|/live/|/embed/", full, re.I):
            r = await client.get(OEMBED, params={"url": full, "format": "json"})
            return r.status_code not in (400, 404)
        r = await client.get(full, headers={"Accept-Language": "en"})
        return r.status_code != 404
    except httpx.HTTPError:
        return True


async def check_links(lines: List[str]) -> dict:
    """Every YouTube link in the lines, checked once each; returns how many were checked and which lines have missing ones."""
    urls = list(dict.fromkeys(u for line in lines for u in find_urls(line)))
    if not urls:
        return {"checked": 0, "bad": []}
    gate = asyncio.Semaphore(8)
    async with httpx.AsyncClient(timeout=6, follow_redirects=True, cookies={"CONSENT": "YES+1", "SOCS": "CAI"}) as client:
        async def one(u):
            async with gate:
                return u, await _exists(client, u)
        found = dict(await asyncio.gather(*(one(u) for u in urls)))
    bad = [{"line": i, "url": u} for i, line in enumerate(lines) for u in find_urls(line) if not found[u]]
    return {"checked": len(urls), "bad": bad}
