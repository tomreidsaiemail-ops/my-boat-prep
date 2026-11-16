await page.context.add_cookies([{"name":"session_token","value":"test_session_pro_1","domain":"gemini-prototype.preview.emergentagent.com","path":"/","secure":True,"httpOnly":True,"sameSite":"None"}])
await page.set_viewport_size({"width": 390, "height": 844})
await page.goto("https://gemini-prototype.preview.emergentagent.com/", wait_until="networkidle")
await page.wait_for_timeout(2500)
T=lambda s: page.locator(f"[data-testid='{s}']")
async def txt():
    try: return (await T("training-step-text").inner_text(timeout=3000)).replace("\n"," ")
    except Exception as e: return "NO STEP TEXT "+str(e)[:80]
async def nxt(quiet=False):
    await T("training-next-btn").click(timeout=4000)
    await page.wait_for_timeout(400)
    if not quiet:
        c = await T("training-step-count").inner_text(timeout=2000) if await T("training-step-count").count() else "?"
        print("NOW", c, (await txt())[:400])
async def pick_list(lid):
    await page.evaluate("window.scrollTo(0,0)"); await page.wait_for_timeout(300)
    await T("list-selector").first.click(); await page.wait_for_timeout(400)
    await T(f"list-option-{lid}").click(); await page.wait_for_timeout(900)
async def levels():
    r = page.locator("[data-testid$='-full'][role=radio]")
    n = await r.count()
    for i in range(n):
        await r.nth(i).scroll_into_view_if_needed(); await r.nth(i).click(timeout=4000); await page.wait_for_timeout(150)
    print("levels picked:", n)
async def start_at(step_no):
    await T("app-menu-btn").click(); await page.wait_for_timeout(400)
    await T("app-menu-help-item").click(); await page.wait_for_timeout(300)
    await T("app-menu-help-model-vessel-item").click(); await page.wait_for_timeout(300)
    await page.locator("[data-testid^='app-menu-help-model-wizard-route-planning']").first.click()
    await page.wait_for_timeout(1500)
    for _ in range(step_no-1): await nxt(quiet=True)
    print("START", await T("training-step-count").inner_text(), (await txt())[:300])
async def dlg_text():
    return (await T("all-done-dialog").inner_text(timeout=4000)).replace("\n"," | ")
