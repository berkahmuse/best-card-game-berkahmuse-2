"""Interactive smoke test: start the game, play a card, end the turn, let the Warden answer."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto("http://localhost:18081/", wait_until="load")
    page.wait_for_timeout(500)
    page.keyboard.press("Space")  # start
    page.wait_for_timeout(400)
    st = page.evaluate("() => { const s = window.__emberCourt.world.state; return {screen: window.__emberCourt.screen(), phase: s.phase, embers: s.you.embers, hand: s.you.hand.map(c => [c.name, c.cost])}; }")
    print("after start:", st)
    afford = next((i for i, (_, cost) in enumerate(st["hand"]) if cost <= st["embers"]), None)
    print("affordable index:", afford)
    if afford is not None:
        page.keyboard.press(str(afford + 1))
        page.wait_for_timeout(400)
        st2 = page.evaluate("() => { const s = window.__emberCourt.world.state; return {embers: s.you.embers, hand: s.you.hand.length, played: s.you.played.map(c => c.name), log: s.log.slice(-2)}; }")
        print("after play:", st2)
    page.keyboard.press("Space")  # end turn
    page.wait_for_timeout(3500)  # let the Warden play
    st3 = page.evaluate("() => { const s = window.__emberCourt.world.state; return {phase: s.phase, turn: s.turn, youLife: s.you.life, foeLife: s.foe.life, embers: s.you.embers, log: s.log.slice(-4)}; }")
    print("after warden:", st3)
    print("pageerrors:", errs if errs else "none")
    browser.close()
