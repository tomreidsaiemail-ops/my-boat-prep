import json
await page.set_viewport_size({"width": 1920, "height": 1080})
await page.context.add_cookies([{"name": "session_token", "value": "test_session_pro_1", "domain": "gemini-prototype.preview.emergentagent.com", "path": "/", "httpOnly": True, "secure": True, "sameSite": "None"}])
async def prov(route):
    body = json.loads(route.request.post_data or "{}")
    await route.fulfill(status=200, content_type="application/json", body=json.dumps({"amounts": {i: "1 pack" for i in body.get("items", [])}}))
await page.route("**/api/ai/mpa/provisions", prov)
try:
    await page.goto("https://gemini-prototype.preview.emergentagent.com/", wait_until="networkidle")
    await page.evaluate("localStorage.removeItem('mbp_mpa_rules')")
    await page.reload(wait_until="networkidle")
    await page.wait_for_selector('[data-testid="list-selector"]', timeout=15000)
    await page.select_option('[data-testid="list-selector"]', "custom_9000000000059")
    await page.click('[data-testid="mpa-open-btn"]')
    await page.wait_for_selector('[data-testid="mpa-dialog"]')
    await page.wait_for_timeout(1500)
    cb = page.locator('[data-testid="mpa-list-check-custom_9000000000059"]')
    if not await cb.is_checked():
        await cb.click()
    if await page.locator('[data-testid="mpa-aisles-check"]').is_checked():
        await page.click('[data-testid="mpa-aisles-check"]')
    await page.click('[data-testid="mpa-make-btn"]')
    try:
        await page.wait_for_selector('[data-testid="mpa-warnings-proceed-btn"]', timeout=5000)
        await page.click('[data-testid="mpa-warnings-proceed-btn"]')
    except Exception:
        print("no warnings dialog")
    await page.wait_for_timeout(3000)
    rows = await page.evaluate("""() => Array.from(document.querySelectorAll('[data-testid^="mpa-text-"]')).map(el => {
        const s = el.querySelector('[data-testid^="mpa-sub-"]'); const o = el.querySelector('[data-testid^="mpa-onboard-"]'); const p = el.querySelector('[data-testid^="mpa-prov-"]');
        return {text: el.innerText.replace(/\\n/g,' | '), sub: s ? s.getAttribute('title') : null, onboard: o ? o.getAttribute('title') : null, prov: !!p};
    })""")
    for r in rows: print(r)
    print("rules cached:", await page.evaluate("localStorage.getItem('mbp_mpa_rules')"))
    await page.screenshot(path=".screenshots/scenario.jpg", quality=40, full_page=False)
except Exception as e:
    print("ERROR", e)
