# Ember Court

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/berkahmuse/best-card-game-berkahmuse-2/rank.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/berkahmuse/best-card-game-berkahmuse-2/reward.svg)](https://make.fun/c/best-card-game-20261122-1826)

An original turn-based card duel for the [make.fun best card game bounty](https://make.fun/c/best-card-game-20261122-1826). You sit across the table from the Warden: thirty life each, eight embers a turn, and a deck of twenty-four original cards in four elements — Flame, Tide, Leaf and Stone.

## How it plays

- **Play a card, then End Turn.** Cards cost embers; embers refill each turn, two on the first turn and one more each turn after, up to eight.
- **Resonance:** play two cards of one element in a turn and the second hits +2 harder. Chains decide games.
- **Burn** keeps hurting at the start of the turn, straight through shield. **Shield** soaks damage first. **Heal** and **Draw** keep you in the fight.
- **The Warden reads back:** it telegraphs its mood ("something heavy is coming"), plays lethal when it sees it, and guards its wounds when it is low.
- Win by taking the Warden to zero life. Run out of cards and fatigue bites for 2.

## Controls

Mouse or keyboard: click a card (or press 1–7) to play it, **Space** or **E** to end your turn, **P** to pause, **R** to deal again.

## Play it

No build step, no network: serve `game/` with any static server and open `game/index.html` in a desktop browser.

```sh
node serve.ts --port 18081
# open http://localhost:18081
```

## Layout

- `game/` — the game itself: `index.html` plus `src/` modules (`config`, `cards`, `world`, `input`, `render`, `shots`, `main`).
- `screenshots/` — four renders of the real game: title, mid-duel, victory, defeat.
- `main.ts` — the hand-in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's library, unchanged.

MIT licensed.
