# Iteration 99: inspect latest Ship's Log PDF (/tmp/it99_log.pdf) layout and email HTML folder rows for the it98 seed user
import sys, re
sys.path.insert(0, "/app/backend")
from pypdf import PdfReader
from pymongo import MongoClient
from dotenv import dotenv_values
from ship_log import build_email_html

r = PdfReader("/tmp/it99_log.pdf")
for p in r.pages:
    print(p.extract_text(extraction_mode="layout"))
E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
log = db.ship_logs.find_one({"owner_id": "TEST_it98_log"}, {"_id": 0}, sort=[("created_at", -1)])
html = build_email_html(log, "https://x/y.pdf", "My Boat Prep")
for row in re.findall(r"<tr>.*?</tr>", html):
    if "TEST log" in row or "Ship&#x27;s Logs" in row or "Ship's Logs" in row or "Auckland - Russell" in row:
        print(re.sub(r"\s+", " ", row)[:420])
        print()
