"""Finds a boat's factory layouts on the web (Google Search grounding) and the builder's layout drawings behind them."""
import asyncio
import base64
import io
import json
import logging
import os
import re
from urllib.parse import urljoin, urlparse
import httpx
from PIL import Image
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

log = logging.getLogger(__name__)
SEARCH_MODELS = ("gemini-3-flash-preview", "gemini-2.5-flash")
VISION_MODEL = "gemini-2.5-flash"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept-Language": "en-NZ,en;q=0.9"}
PLAN_WORDS = re.compile(r"layout|plan|interior|accommodation|amenagement|am%c3%a9nagement|grundriss|lay-?out|deck|cabin|version|config|drawing|schem", re.I)
SKIP_WORDS = re.compile(r"logo|icon|sprite|avatar|flag|banner|favicon|badge|social|facebook|twitter|pixel|\.svg", re.I)
MAX_PAGES, MAX_IMAGES, MAX_BYTES = 8, 20, 6_000_000
_checks = asyncio.Semaphore(5)

RESEARCH_PROMPT = """Search the web for the builder's published interior layout drawings and specifications of the {boat} ({kind}).
List each factory interior layout configuration it was sold in (e.g. 2, 3 or 4 cabins, galley to port or starboard, owner's or charter version),
at most 4, most common first, and only configurations the sources confirm. If it was only built one way, give just that one.
For each give: label ("Layout A: " then 2 to 4 words naming what makes it different), a one-line summary of where things are
(galley, nav station, saloon, cabins, heads), galley side as the sources state it (port, starboard, centre, aft or forward; "" if not stated),
number of cabins and heads, source_urls (pages that show or describe this layout: builder brochure, owner's manual, boat test or listing pages)
and image_urls (direct links to images of the layout drawing, if any).
If the sources don't describe this boat's layout, reply {{"layouts": []}}.
Reply with strict JSON only: {{"layouts":[{{"label":"","summary":"","galley":"","cabins":0,"heads":0,"source_urls":[],"image_urls":[]}}]}}"""

VERIFY_PROMPT = """Is this picture a builder's top-down layout drawing (interior accommodation plan or deck plan, seen from above) of a {boat}?
The factory layouts are:
{layouts}
Reply with strict JSON only: {{"is_plan": true, "view": "interior" or "deck", "matches": "<exact layout label from the list, or empty>",
"confidence": 0.0-1.0, "bow": "left" or "right" or "up" or "down", "galley": "port" or "starboard" or "centre" or "" }}
"galley" is the boat's side (port = the boat's left when facing the bow), not the side of the picture. A photo of the boat, a profile/side view
or a drawing of a different boat is not a plan (is_plan false)."""


def _json(text: str) -> dict:
    m = re.search(r"\{.*\}", str(text), re.S)
    return json.loads(m.group(0)) if m else {}


def _grounded_sources(raw) -> list[dict]:
    try:
        meta = (raw.model_extra or {}).get("vertex_ai_grounding_metadata") or []
    except Exception:
        return []
    out = []
    for m in meta if isinstance(meta, list) else [meta]:
        for ch in (m or {}).get("groundingChunks") or []:
            web = ch.get("web") or {}
            if web.get("uri"):
                out.append({"uri": web["uri"], "title": web.get("title") or ""})
    return out


async def research(boat_name: str, kind: str, session: str) -> tuple[list[dict], list[dict]]:
    """Factory layouts found on the web plus the grounding sources; ([], []) when the web has nothing on this boat."""
    for model in SEARCH_MODELS:
        try:
            chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{session}-{model}",
                           system_message="You research boat builders' published layouts on the web and reply with strict JSON.")
            chat.with_model("gemini", model).with_tools([{"googleSearch": {}}])
            r = await asyncio.wait_for(chat.send_message_with_tools(UserMessage(text=RESEARCH_PROMPT.format(boat=boat_name, kind=kind))), 90)
            raw = _json(r.content).get("layouts") or []
            layouts = [{"label": str(v.get("label") or "").strip()[:80], "summary": str(v.get("summary") or "").strip()[:400],
                        "galley": str(v.get("galley") or "").strip().lower()[:20], "cabins": v.get("cabins"), "heads": v.get("heads"),
                        "source_urls": [u for u in v.get("source_urls") or [] if isinstance(u, str)][:6],
                        "image_urls": [u for u in v.get("image_urls") or [] if isinstance(u, str)][:6]}
                       for v in raw if isinstance(v, dict) and str(v.get("label") or "").strip()][:4]
            return layouts, _grounded_sources(r.raw)
        except Exception as e:
            log.warning(f"Layout research with {model} failed: {e}")
    raise RuntimeError("layout research failed")


async def _resolve(http: httpx.AsyncClient, url: str) -> str:
    """Grounding links are Google redirects; follow them to the real page."""
    if "grounding-api-redirect" not in url:
        return url
    try:
        r = await http.get(url, follow_redirects=False)
        return r.headers.get("location") or url
    except Exception:
        return url


def _page_images(html: str, base: str) -> list[str]:
    """Pictures on a source page, likely layout drawings first; every one is checked by eye later."""
    hits, rest = [], []
    for tag in re.findall(r"<img\b[^>]*>", html, re.I):
        alt = " ".join(re.findall(r'(?:alt|title)\s*=\s*"([^"]*)"', tag, re.I))
        for src in re.findall(r'(?:data-src|data-lazy-src|data-original|src)\s*=\s*"([^"]+)"', tag, re.I):
            if src.startswith("data:") or SKIP_WORDS.search(src):
                continue
            (hits if PLAN_WORDS.search(src) or PLAN_WORDS.search(alt) else rest).append(urljoin(base, src.replace("&amp;", "&")))
    for src in re.findall(r'<a\b[^>]*href\s*=\s*"([^"]+\.(?:jpe?g|png|webp))"', html, re.I):
        if not SKIP_WORDS.search(src):
            (hits if PLAN_WORDS.search(src) else rest).append(urljoin(base, src.replace("&amp;", "&")))
    return (list(dict.fromkeys(hits))[:6] + list(dict.fromkeys(rest))[:4])[:8]


async def _fetch_image(http: httpx.AsyncClient, url: str):
    try:
        r = await http.get(url, follow_redirects=True)
        if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/") or len(r.content) > MAX_BYTES:
            return None
        img = Image.open(io.BytesIO(r.content))
        if img.mode in ("RGBA", "LA", "P"):
            # Builder plans are often transparent PNGs; flatten onto white so the lines stay visible.
            img = img.convert("RGBA")
            bg = Image.new("RGB", img.size, "white")
            bg.paste(img, mask=img.split()[3])
            img = bg
        img = img.convert("RGB")
        if min(img.size) < 250:
            return None
        img.thumbnail((1600, 1600))
        out = io.BytesIO()
        img.save(out, "JPEG", quality=88)
        return out.getvalue()
    except Exception:
        return None


async def _page(http: httpx.AsyncClient, url: str) -> tuple[str, str, list[str]]:
    url = await _resolve(http, url)
    try:
        r = await http.get(url, follow_redirects=True)
        if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
            return str(r.url), "", []
        html = r.text[:1_500_000]
        title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        return str(r.url), (title.group(1).strip()[:120] if title else ""), _page_images(html, str(r.url))
    except Exception:
        return url, "", []


async def find_drawings(layouts: list[dict], sources: list[dict]) -> list[dict]:
    """Downloads candidate layout drawings from the source pages: [{bytes, url, page, page_title}]."""
    pages = list(dict.fromkeys([u for v in layouts for u in v["source_urls"]] + [s["uri"] for s in sources]))[:MAX_PAGES]
    direct = list(dict.fromkeys(u for v in layouts for u in v["image_urls"]))
    async with httpx.AsyncClient(timeout=12, headers=UA) as http:
        found = await asyncio.gather(*[_page(http, u) for u in pages])
        cands = [(u, None, "") for u in direct] + [(img, page, title) for page, title, imgs in found for img in imgs]
        seen, uniq = set(), []
        for c in cands:
            if c[0] not in seen and urlparse(c[0]).scheme in ("http", "https"):
                seen.add(c[0])
                uniq.append(c)
        uniq = uniq[:MAX_IMAGES]
        datas = await asyncio.gather(*[_fetch_image(http, u) for u, _, _ in uniq])
    return [{"bytes": d, "url": u, "page": p or u, "page_title": t} for (u, p, t), d in zip(uniq, datas) if d]


async def _verify_one(c: dict, boat_name: str, labels: str, session: str):
    async with _checks:
        return await _verify(c, boat_name, labels, session)


async def _verify(c: dict, boat_name: str, labels: str, session: str):
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session,
                       system_message="You check boat layout drawings and reply with strict JSON.").with_model("gemini", VISION_MODEL)
        reply = await asyncio.wait_for(chat.send_message(UserMessage(text=VERIFY_PROMPT.format(boat=boat_name, layouts=labels),
                                                                     file_contents=[ImageContent(image_base64=base64.b64encode(c["bytes"]).decode())])), 45)
        v = _json(reply)
        return {**c, **{k: v.get(k) for k in ("is_plan", "view", "matches", "confidence", "bow", "galley")}}
    except Exception as e:
        log.warning(f"Layout drawing check failed for {c['url']}: {e}")
        return None


async def verified_drawings(cands: list[dict], boat_name: str, layouts: list[dict], session: str) -> list[dict]:
    """Only real top-down plans of this boat, best first."""
    labels = "\n".join(f"- {v['label']}: {v['summary']}" for v in layouts) or "- (unknown)"
    checked = await asyncio.gather(*[_verify_one(c, boat_name, labels, f"{session}-v{n}") for n, c in enumerate(cands)])
    ok = [c for c in checked if c and c.get("is_plan") is True and float(c.get("confidence") or 0) >= 0.6]
    return sorted(ok, key=lambda c: (c.get("view") != "interior", -float(c.get("confidence") or 0)))


async def resolve_pages(urls: list[str]) -> dict:
    """Real page addresses for Google's grounding redirect links, for the source link shown to the skipper."""
    async with httpx.AsyncClient(timeout=8, headers=UA) as http:
        real = await asyncio.gather(*[_resolve(http, u) for u in urls])
    return {u: (r if "grounding-api-redirect" not in r else "") for u, r in zip(urls, real)}
