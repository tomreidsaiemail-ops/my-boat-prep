# Iteration 99: put Ship's Log folders on the it98 seed user (closed 2024 year folder > open passage folder > logs 1-3; log 4 in year). Run manual_it98_shipslog_seed.py first.
from pymongo import MongoClient
from dotenv import dotenv_values

E = dotenv_values("/app/backend/.env")
db = MongoClient(E["MONGO_URL"])[E["DB_NAME"]]
UID = "TEST_it98_log"
Y, P = 9000000000001, 9000000000002
logs = [
    {"id": Y, "label": "2024 Ship's Logs", "folder": "year", "year": "2024", "from": "2024-01-01", "open": False, "checked": False},
    {"id": P, "label": "Auckland - Russell - 1 Mar 2024 to 4 Mar 2024", "folder": "passage", "src": "Auckland", "dst": "Russell", "from": "2024-03-01", "to": "2024-03-04", "open": True, "checked": False, "in": Y},
    {"id": 1, "label": "TEST log A 2024 Mar", "checked": True, "log_date": "2024-03-01", "in": P},
    {"id": 2, "label": "TEST log B 2024 Mar", "checked": False, "log_date": "2024-03-02", "in": P},
    {"id": 3, "label": "TEST log C 2024 Mar", "checked": False, "log_date": "2024-03-04", "in": P},
    {"id": 4, "label": "TEST log D 2024 Nov", "checked": False, "log_date": "2024-11-10", "in": Y},
    {"id": 1735700000000, "label": "TEST log E 2025 stamp", "checked": False},
    {"id": 6, "label": "TEST log F 2025 Jun", "checked": False, "log_date": "2025-06-15"},
    {"id": 7, "label": "TEST log G undated", "checked": False},
]
print(db.user_boats.update_one({"owner_id": UID, "boat_id": "main"}, {"$set": {"data.shipsLog": logs}}).modified_count)
