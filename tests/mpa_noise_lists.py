# Create/delete the production-like private admin lists (iteration 60). Usage: python3 mpa_noise_lists.py create|delete
import os, sys, requests
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
H = {"Authorization": "Bearer test_session_admin_1"}
L = lambda s, ind=False: {"label": s, "indent": ind}
SYN = [L("1. Salt")] + [L(s, True) for s in ["Salt", "Table Salt", "Sea Salt", "Rock Salt", "Garlic Salt"]] + \
      [L("2. Tomatoes")] + [L(s, True) for s in ["Tinned Plum Tomatoes", "Fresh Cherry Tomatoes", "Tomato"]] + \
      [L("4. Pepper")] + [L(s, True) for s in ["Black Peppercorns", "Ground Black Pepper", "White Pepper"]]
NOISE = [L(s) for s in ["[0-9]+", "[0-9]/[0-9]", "(.*)", "[0-9]g", "[0-9]grams", "[0-9]grammes", "tbsp", "tsp", "fresh", "frozen", "tinned", "canned", "finely", "sliced", "diced", "dried", "of", "or", "pinch", "salted", "unsalted", "large", "small", ".*", "[a-z]+"]]
existing = requests.get(f"{B}/admin/template-lists", headers=H).json()
for d in existing:
    if d["name"].lower() in ("admin - food synonyms", "admin - food noise words"):
        print("delete", d["name"], requests.delete(f"{B}/admin/template-lists/{d['id'] if 'id' in d else d['list_id']}", headers=H).status_code)
if sys.argv[1] == "create":
    for n, items in (("Admin - Food Synonyms", SYN), ("Admin - Food Noise Words", NOISE)):
        r = requests.post(f"{B}/admin/template-lists", headers=H, json={"name": n, "items": items, "private": True})
        print("create", n, r.status_code)
    r = requests.get(f"{B}/mpa/rules", headers={"Authorization": "Bearer test_session_pro_1"}).json()
    print("rules:", len(r["synonyms"]), "syn,", len(r["noise"]), "noise; indents:", sum(1 for i in r["synonyms"] if i.get("indent")))
print("remaining:", [d["name"] for d in requests.get(f"{B}/admin/template-lists", headers=H).json()])
