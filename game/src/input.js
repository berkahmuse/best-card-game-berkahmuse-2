// Keyboard and pointer input. Held keys are not needed here: a card game is
// clicks and one-shot presses. Presses are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_END_TURN = 2;
export const ACTION_PAUSE = 4;
export const ACTION_RESTART = 8;

const CONFIRM = new Set(['Space', 'Enter']);
const END_TURN = new Set(['KeyE']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const CARD_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7']);

export function createInput(canvas) {
  let actions = 0;
  let cardKey = -1;
  let pointer = { x: -1, y: -1, clicked: false, down: false };

  window.addEventListener('keydown', (event) => {
    if (CARD_KEYS.has(event.code)) {
      if (!event.repeat) cardKey = Number(event.code.slice(5)) - 1;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (END_TURN.has(event.code)) {
      if (!event.repeat) actions |= ACTION_END_TURN;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else {
      return;
    }
    event.preventDefault();
  });

  function readPointer(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener('pointermove', (event) => {
    const at = readPointer(event);
    pointer.x = at.x;
    pointer.y = at.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const at = readPointer(event);
    pointer.x = at.x;
    pointer.y = at.y;
    pointer.down = true;
    pointer.clicked = true;
  });
  canvas.addEventListener('pointerup', () => {
    pointer.down = false;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.x = -1;
    pointer.y = -1;
  });

  return {
    /** The pointer in canvas pixels, plus whether it just clicked. */
    pointer() {
      return pointer;
    },
    /** Clear a consumed click so it fires once. */
    clearClick() {
      pointer.clicked = false;
    },
    /** The card key (0-based) pressed since the last call, or -1. */
    takeCardKey() {
      const taken = cardKey;
      cardKey = -1;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
