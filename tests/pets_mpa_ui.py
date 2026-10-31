import json
await page.set_viewport_size({"width": 390, "height": 844})
await page.context.add_cookies([{"name": "session_token", "value": "test_session_pro_1", "domain": "gemini-prototype.preview.emergentagent.com", "path": "/", "httpOnly": True, "secure": True, "sameSite": "None"}])
calls = {"prov": [], "aisles": 0}
toasts = []
async def prov(route):
    body = json.loads(route.request.post_data or "{}")
    calls["prov"].append(body)
    pets = [{"name": "Dry dog food", "amount": "3 kg", "for": "Biscuit"}, {"name": "Poo bags", "amount": "1 roll", "for": "Biscuit"},
            {"name": "Cat litter", "amount": "5 L", "for": "Mog"}] if body.get("pets") else []
    await route.fulfill(status=200, content_type="application/json", body=json.dumps({"amounts": {i: "1 pack" for i in body.get("items", [])}, "pets": pets, "drafts_left": 10}))
async def aisles(route):
    calls["aisles"] += 1
    body = json.loads(route.request.post_data or "{}")
    await route.fulfill(status=200, content_type="application/json", body=json.dumps({"aisles": {i: "Pantry" for i in body.get("items", [])}, "drafts_left": 10}))
await page.route("**/api/ai/mpa/provisions", prov)
await page.route("**/api/ai/mpa/aisles", aisles)
LIST = "tpl_b1aef01b43"

async def open_mpa():
    await page.click('[data-testid="list-selector"]')
    await page.wait_for_timeout(400)
    await page.click(f'[data-testid="list-option-{LIST}"]', force=True)
    await page.wait_for_timeout(800)
    await page.click('[data-testid="mpa-open-btn"]')
    await page.wait_for_selector('[data-testid="mpa-dialog"]')
    await page.wait_for_timeout(800)
    cb = page.locator(f'[data-testid="mpa-list-check-{LIST}"]')
    if not await cb.is_checked():
        await cb.click()

async def make():
    await page.click('[data-testid="mpa-make-btn"]')
    try:
        await page.wait_for_selector('[data-testid="mpa-warnings-proceed-btn"]', timeout=3000)
        await page.click('[data-testid="mpa-warnings-proceed-btn"]')
    except Exception:
        pass
    await page.wait_for_selector('[data-testid="mpa-dialog"]', state="detached", timeout=20000)
    await page.wait_for_timeout(2500)

async def mpa_rows():
    d = await page.evaluate("fetch('/api/me/boat',{credentials:'include'}).then(r=>r.json())")
    lid = [l["id"] for l in d["registry"] if l.get("kind") == "mpa"]
    return d["data"].get(lid[0], []) if lid else []

async def toast_text():
    return " | ".join(await page.locator('[data-sonner-toast]').all_inner_texts())

try:
    await page.goto("https://gemini-prototype.preview.emergentagent.com/", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="list-selector"]', timeout=20000)
    # A: pets on, aisles on
    await open_mpa()
    print("A pets label:", await page.inner_text('[data-testid="mpa-pets"]'), "| checked:", await page.locator('[data-testid="mpa-pets-check"]').is_checked())
    print("A aisles checked:", await page.locator('[data-testid="mpa-aisles-check"]').is_checked())
    await page.screenshot(path=".screenshots/mpa_dialog_pets.jpg", quality=40, full_page=False)
    await make()
    print("A prov calls:", len(calls["prov"]), json.dumps(calls["prov"]))
    rows = await mpa_rows()
    print("A total rows:", len(rows))
    for r in rows[-6:]: print("   A", r.get("indent"), r["label"])
    heads = [r["label"] for r in rows if not r.get("indent")]
    print("A headings:", heads)
    await page.wait_for_timeout(500)
    await page.get_by_text("For the pets (Biscuit, Mog)").first.scroll_into_view_if_needed()
    await page.screenshot(path=".screenshots/mpa_list_pets.jpg", quality=40, full_page=False)
    # B: aisles off
    calls["prov"].clear()
    await open_mpa()
    await page.click('[data-testid="mpa-aisles-check"]')
    await make()
    rows = await mpa_rows()
    print("B prov calls:", len(calls["prov"]), "headings:", [r["label"] for r in rows if not r.get("indent")])
    print("B last:", [r["label"] for r in rows[-4:]])
    # C: pets unticked -> no call, no pet section
    calls["prov"].clear()
    await open_mpa()
    await page.click('[data-testid="mpa-pets-check"]')
    print("C pets checked:", await page.locator('[data-testid="mpa-pets-check"]').is_checked())
    await make()
    rows = await mpa_rows()
    print("C prov calls:", len(calls["prov"]), "has pet section:", any("For the pets" in r["label"] for r in rows), "rows:", len(rows))
    # D: offline
    calls["prov"].clear()
    await open_mpa()
    await page.context.set_offline(True)
    await page.wait_for_timeout(1500)
    await page.click('[data-testid="mpa-make-btn"]')
    try:
        await page.wait_for_selector('[data-testid="mpa-warnings-proceed-btn"]', timeout=3000)
        await page.click('[data-testid="mpa-warnings-proceed-btn"]')
    except Exception:
        pass
    await page.wait_for_timeout(1500)
    print("D toasts:", await toast_text())
    print("D prov calls:", len(calls["prov"]))
    await page.context.set_offline(False)
    await page.wait_for_timeout(3000)
except Exception as e:
    print("ERROR", e)
    await page.screenshot(path=".screenshots/mpa_err.jpg", quality=40, full_page=False)
