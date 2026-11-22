// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, the Warden answers on a slow clock so its cards can be
// seen, and the renderer paints what is there. The game moves between four
// screens: title, play, paused and game over.
//
// ?seed=N fixes the deal. ?shot=title|play|win|loss (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_WIN, PHASE_AI, PHASE_PLAYER } from './world.js';
import { ACTION_CONFIRM, ACTION_END_TURN, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, endTurnRect, handRect, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
/** Milliseconds between the Warden's cards, so each one can be read. */
const AI_PACE_MS = 900;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  world.state.foeIntent = world.foeIntent();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, hover: -1, snap: true });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let wins = best;
  let accumulator = 0;
  let last = performance.now();
  let lastAiAt = 0;
  let hover = -1;

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    screen = SCREEN_PLAY;
    announce('Playing. Your turn — play a card, then end your turn.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.result === 'win') {
      wins += 1;
      saveBest(wins);
      renderer.notify([{ kind: EVENT_WIN }], world.state);
      announce(`You win! The Warden falls with ${world.state.you.life} life left.`);
    } else {
      announce(`You lose. The Warden stands with ${world.state.foe.life} life left.`);
    }
  }

  /** Pointer position in table coordinates, or null outside the table. */
  function pointerLogical() {
    const pointer = input.pointer();
    if (pointer.x < 0) return null;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const deviceX = pointer.x * ratio;
    const deviceY = pointer.y * ratio;
    const view = renderer.view;
    return {
      x: (deviceX - view.x) / view.scale,
      y: (deviceY - view.y) / view.scale,
    };
  }

  function hoverCard() {
    if (screen !== SCREEN_PLAY || world.state.phase !== PHASE_PLAYER) return -1;
    const at = pointerLogical();
    if (!at) return -1;
    const count = world.state.you.hand.length;
    for (let index = count - 1; index >= 0; index -= 1) {
      const rect = handRect(index, count);
      if (at.x >= rect.x && at.x <= rect.x + rect.width && at.y >= rect.y - 26 && at.y <= rect.y + rect.height) {
        return index;
      }
    }
    return -1;
  }

  function clickEndTurn() {
    const at = pointerLogical();
    if (!at) return false;
    const rect = endTurnRect();
    return at.x >= rect.x && at.x <= rect.x + rect.width && at.y >= rect.y && at.y <= rect.y + rect.height;
  }

  function playCard(index) {
    if (screen !== SCREEN_PLAY || world.state.phase !== PHASE_PLAYER) return;
    const card = world.state.you.hand[index];
    if (!card) return;
    if (!world.canPlay(world.state.you, card)) {
      announce(`${card.name} costs ${card.cost} embers — you have ${world.state.you.embers}.`);
      return;
    }
    const events = world.playCard(world.state.you, index);
    renderer.notify(events, world.state);
    announce(`You play ${card.name}.`);
    if (world.state.result) endGame();
  }

  function endTurn() {
    if (screen !== SCREEN_PLAY || world.state.phase !== PHASE_PLAYER) return;
    const events = world.endTurn();
    renderer.notify(events, world.state);
    lastAiAt = performance.now();
    announce('The Warden takes the table.');
  }

  function handleActions() {
    const actions = input.takeActions();
    const cardKey = input.takeCardKey();
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_PLAY) endTurn();
    else if (actions & ACTION_END_TURN && screen === SCREEN_PLAY) endTurn();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (cardKey >= 0) playCard(cardKey);
  }

  function handleClick() {
    if (!input.pointer().clicked) return;
    input.clearClick();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      startGame();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (clickEndTurn()) {
      endTurn();
      return;
    }
    const card = hoverCard();
    if (card >= 0) playCard(card);
  }

  function stepAi(now) {
    if (screen !== SCREEN_PLAY || world.state.phase !== PHASE_AI) return;
    if (now - lastAiAt < AI_PACE_MS) return;
    lastAiAt = now;
    const events = world.aiStep();
    renderer.notify(events, world.state);
    if (world.state.phase === PHASE_PLAYER) announce('Your turn — embers refilled.');
    if (world.state.result) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClick();
    hover = hoverCard();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      while (accumulator >= STEP) {
        world.step(STEP);
        accumulator -= STEP;
      }
      stepAi(now);
    } else {
      accumulator = 0;
    }
    world.state.foeIntent = world.foeIntent();
    renderer.draw(world.state, screen, { best: wins, hover });
  }

  // Leaving the tab pauses a running game rather than letting the Warden play unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A hook for smoke tests, never for the game itself.
  window.__emberCourt = { world, screen: () => screen };
  announce('Ember Court. Press Space or click to sit down.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
