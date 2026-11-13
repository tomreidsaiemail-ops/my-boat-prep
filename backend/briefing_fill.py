"""Fill-in tags in Role Briefings (<VESSEL>, <CALLSIGN>, ...) and an optional <YOUTUBE:url> briefing video."""
import re
from html import escape
from urllib.parse import urlparse


def _dim(field: str):
    def get(b: dict) -> str:
        v = str(b.get(field) or "").strip()
        return f"{v} {'ft' if b.get('units') == 'ft' else 'm'}" if v else ""
    return get


def _field(field: str):
    return lambda b: str(b.get(field) or "").strip()


TAGS = {
    "VESSEL": _field("vessel"), "BOAT NAME": _field("vessel"), "CALLSIGN": _field("callsign"), "MMSI NUMBER": _field("mmsi"), "MMSI": _field("mmsi"),
    "SKIPPER": _field("skipper"), "SKIPPER PHONE": _field("skipper_phone"), "MAKE": _field("make"), "MODEL": _field("model"), "YEAR": _field("year_built"),
    "LENGTH": _dim("loa"), "BEAM": _dim("beam"), "DRAFT": _dim("draft"), "MAST HEIGHT": _dim("mast_height"),
    "HULL COLOUR": _field("hull_colour"), "HULL COLOR": _field("hull_colour"),
}
TAG = re.compile(r"<\s*([A-Za-z][A-Za-z ]*[A-Za-z])\s*>")
VIDEO = re.compile(r"<\s*YOUTUBE\s*:\s*([^>\s]+)\s*>", re.I)
VIDEO_CHOICES = {"watched": "I have watched the briefing video", "will_watch": "I will watch the briefing video before we leave",
                 "no_time": "I won't have time to watch the briefing video"}
VIDEO_SHORT = {"watched": "Watched video", "will_watch": "Will watch video", "no_time": "Won't watch video"}


def video_url(text: str) -> str:
    m = VIDEO.search(str(text or ""))
    if not m:
        return ""
    u = urlparse(m.group(1))
    host = (u.hostname or "").lower()
    ok = u.scheme in ("http", "https") and (host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com"))
    return m.group(1) if ok else ""


def fill(text: str, boat: dict) -> tuple[str, str]:
    """The briefing with the boat's details filled in (a blank detail keeps its tag) and the YouTube tag taken out, plus the video link."""
    boat = boat or {}
    url = video_url(text)

    def swap(m):
        get = TAGS.get(" ".join(m.group(1).upper().split()))
        return (get(boat) or m.group(0)) if get else m.group(0)
    out = TAG.sub(swap, VIDEO.sub("", str(text or "")))
    lines = [ln.rstrip() for ln in out.splitlines()]
    return "\n".join(ln for ln in lines if ln.strip() not in ("-", "")).strip(), url


def shown(text: str, boat: dict, choice: str = "") -> str:
    """Plain-text briefing for emails and the PDF: filled in, with the video link (and the crew member's answer) at the end."""
    t, url = fill(text, boat)
    if url:
        t += f"\n\nBriefing video: {url}"
        if choice in VIDEO_CHOICES:
            t += f"\n{VIDEO_CHOICES[choice]}"
    return t


def html_lines(text: str) -> str:
    """Escaped briefing text for an email, line breaks kept and the video link clickable."""
    return re.sub(r"(https?://[^\s<]+)", r'<a href="\1">\1</a>', escape(text)).replace("\n", "<br/>")
