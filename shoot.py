"""Take Ember Court screenshots: real renders of the game in headless Chromium."""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path.home() / "workspace/makefun-cardgame-20261122/engine-berkahmuse-2"
OUT = REPO / "screenshots"
SHOTS = json.loads((REPO / "shots.json").read_text())

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    for shot in SHOTS:
        page.goto(f"http://localhost:18081/{shot['query']}", wait_until="load")
        try:
            page.wait_for_function("window.__shotReady === true", timeout=15000)
        except Exception as exc:
            errors.append(f"{shot['name']}: __shotReady timeout: {exc}")
        page.screenshot(path=str(OUT / shot["name"]), type="jpeg", quality=88)
        print("shot", shot["name"], (OUT / shot["name"]).stat().st_size, "bytes")
    # Smoke test: plain load, no shot param, check the game boots and state exists.
    page.goto("http://localhost:18081/", wait_until="load")
    page.wait_for_timeout(1500)
    state = page.evaluate("() => { const g = window.__emberCourt; if (!g) return null; const s = g.world.state; return {phase: s.phase, youLife: s.you.life, foeLife: s.foe.life, youHand: s.you.hand.length, foeHand: s.foe.hand.length, turn: s.turn, embers: s.you.embers}; }")
    print("smoke:", state)
    browser.close()

print("errors:", errors if errors else "none")
