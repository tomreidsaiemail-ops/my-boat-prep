# Local check: media list renders into ship-log PDF (bypasses email daily limit)
import asyncio, io, sys
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from media import media_list_for_pdf
from ship_log import build_pdf


async def main():
    lst = await media_list_for_pdf("sailingMovies")
    print(lst)
    log = {"log_id": "x", "vessel": "V", "skipper": "S", "callsign": "C", "local_date": "Mon", "created_at": "2026-01-19T00:00:00+00:00", "lists": [lst]}
    pdf = build_pdf(log)
    print(pdf[:8], len(pdf))
    try:
        from pypdf import PdfReader
        print(PdfReader(io.BytesIO(pdf)).pages[0].extract_text())
    except ImportError:
        print("pypdf missing")

asyncio.run(main())
