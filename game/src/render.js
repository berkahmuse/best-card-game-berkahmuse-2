// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 table is scaled to fit the window and centred. Cards are drawn,
// not images: each element has its own colour and its own glyph, so a card is
// readable at thumbnail size. Animations live here too: a played card flies
// from the hand to the table, damage numbers float up, embers drift on a win.

import { CARD, ELEMENTS, FIELD, FONT, GAME, PALETTE } from './config.js';
import { cardText } from './cards.js';
import { EVENT_BURN, EVENT_DAMAGE, EVENT_HEAL, EVENT_PLAY, EVENT_SHIELD, EVENT_WIN, PHASE_AI, PHASE_OVER, PHASE_PLAYER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const HAND_Y = CARD.handY;
const FOE_CARD = { width: 54, height: 76 };
const END_TURN = { x: 1108, y: 636, width: 148, height: 56 };
const LOG_BOX = { x: 1004, y: 168, width: 252, height: 300 };

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

/** The hand's cards, fanned in a row centred on the table. With a full hand
 * the cards overlap so the player's panel at the left stays clear. */
export function handRect(index, count) {
  const avail = 700;
  const pitch = count <= 1 ? 0 : Math.min(CARD.width + CARD.gap, (avail - CARD.width) / (count - 1));
  const total = CARD.width + (count - 1) * pitch;
  const x = (FIELD.width - total) / 2 + index * pitch;
  return { x, y: HAND_Y, width: CARD.width, height: CARD.height };
}

export function endTurnRect() {
  return END_TURN;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const floaters = [];
  const flights = [];
  const particles = [];
  const shownLife = { you: GAME.startLife, foe: GAME.startLife };
  let shake = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.fillText(value, x, y);
  }

  function glyph(element, x, y, size, color) {
    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineWidth = Math.max(2, size * 0.08);
    context.beginPath();
    if (element === 'flame') {
      context.moveTo(x, y - size);
      context.bezierCurveTo(x + size * 0.9, y - size * 0.2, x + size * 0.6, y + size * 0.7, x, y + size * 0.8);
      context.bezierCurveTo(x - size * 0.6, y + size * 0.7, x - size * 0.9, y - size * 0.2, x, y - size);
    } else if (element === 'tide') {
      context.moveTo(x, y - size);
      context.bezierCurveTo(x + size * 0.8, y, x + size * 0.7, y + size * 0.8, x, y + size * 0.8);
      context.bezierCurveTo(x - size * 0.7, y + size * 0.8, x - size * 0.8, y, x, y - size);
    } else if (element === 'leaf') {
      context.moveTo(x - size, y + size * 0.6);
      context.quadraticCurveTo(x - size * 0.2, y - size, x + size, y - size * 0.6);
      context.quadraticCurveTo(x + size * 0.2, y + size, x - size, y + size * 0.6);
    } else {
      for (let corner = 0; corner < 6; corner += 1) {
        const angle = (Math.PI / 3) * corner - Math.PI / 2;
        const px = x + Math.cos(angle) * size;
        const py = y + Math.sin(angle) * size;
        if (corner === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
    }
    context.closePath();
    context.fill();
    if (element === 'leaf') {
      context.strokeStyle = 'rgba(12,26,20,0.55)';
      context.beginPath();
      context.moveTo(x - size * 0.7, y + size * 0.4);
      context.lineTo(x + size * 0.7, y - size * 0.4);
      context.stroke();
    }
  }

  function drawCardBack(x, y, width, height, small) {
    roundRect(context, x, y, width, height, small ? 7 : 12);
    context.fillStyle = '#123524';
    context.fill();
    context.strokeStyle = PALETTE.goldDark;
    context.lineWidth = 2;
    context.stroke();
    roundRect(context, x + 6, y + 6, width - 12, height - 12, small ? 5 : 9);
    context.strokeStyle = 'rgba(242,201,76,0.5)';
    context.lineWidth = 1.5;
    context.stroke();
    glyph('flame', x + width / 2, y + height / 2, Math.min(width, height) * 0.22, PALETTE.gold);
  }

  /** One card, face up. `scale` shrinks it for the played row; `dim` greys it out. */
  function drawCard(card, x, y, width, height, options) {
    const opts = options ?? {};
    const element = ELEMENTS[card.element];
    const s = width / CARD.width;
    roundRect(context, x, y, width, height, 12 * s);
    context.fillStyle = '#f7f2e4';
    context.fill();
    context.strokeStyle = element.dark;
    context.lineWidth = 2.5 * s;
    context.stroke();
    if (opts.dim) {
      context.fillStyle = 'rgba(12,26,20,0.45)';
      context.fill();
    }
    // Element band.
    context.save();
    roundRect(context, x, y, width, 40 * s, 12 * s);
    context.clip();
    context.fillStyle = element.color;
    context.fillRect(x, y, width, 40 * s);
    context.restore();
    text(ELEMENTS[card.element].name.toUpperCase(), x + 44 * s, y + 27 * s, 15 * s, '#ffffff', 'left', true);
    // Cost pip.
    context.beginPath();
    context.arc(x + 21 * s, y + 20 * s, 16 * s, 0, Math.PI * 2);
    context.fillStyle = PALETTE.gold;
    context.fill();
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 2 * s;
    context.stroke();
    text(String(card.cost), x + 21 * s, y + 27 * s, 19 * s, PALETTE.ink, 'center', true);
    // Big glyph.
    glyph(card.element, x + width / 2, y + 82 * s, 26 * s, element.color);
    // Name and rules.
    context.textBaseline = 'alphabetic';
    text(card.name, x + width / 2, y + 124 * s, 14 * s, PALETTE.ink, 'center', true);
    text(cardText(card), x + width / 2, y + 144 * s, 13 * s, '#3d4a42', 'center');
    if (opts.resonance) {
      text(`RESONANCE +${opts.resonance}`, x + width / 2, y + 162 * s, 12 * s, PALETTE.burn, 'center', true);
    } else if (card.flavour) {
      text(card.flavour, x + width / 2, y + 162 * s, 11 * s, '#7a8578', 'center');
    }
  }

  function drawLifeBar(x, y, width, life, shield, burn, label, alignRight) {
    const max = GAME.startLife;
    context.fillStyle = PALETTE.lifeBack;
    roundRect(context, x, y, width, 22, 6);
    context.fill();
    const fillWidth = Math.max(0, (life / max) * width);
    context.fillStyle = PALETTE.life;
    roundRect(context, x, y, fillWidth, 22, 6);
    context.fill();
    // The number sits inside the bar's right end, never over the name above.
    text(String(Math.max(0, life)), x + width - 10, y + 17, 17, '#ffffff', 'right', true);
    let extra = '';
    if (shield > 0) extra += `SHD ${shield}  `;
    if (burn > 0) extra += `BRN ${burn}`;
    if (extra) text(extra.trim(), alignRight ? x + width : x, y + 42, 16, shield > 0 ? PALETTE.shield : PALETTE.burn, alignRight ? 'right' : 'left', true);
  }

  function drawEmbers(x, y, count, label) {
    text(label, x, y, 16, PALETTE.muted, 'left', true);
    for (let index = 0; index < GAME.maxEmbers; index += 1) {
      context.beginPath();
      context.arc(x + 92 + index * 24, y - 5, 8, 0, Math.PI * 2);
      context.fillStyle = index < count ? PALETTE.ember : PALETTE.emberBack;
      context.fill();
      context.strokeStyle = '#1c241f';
      context.lineWidth = 1.5;
      context.stroke();
    }
  }

  function drawTable(state) {
    context.fillStyle = PALETTE.felt;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.feltDark;
    context.beginPath();
    context.ellipse(FIELD.width / 2, 330, 560, 210, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.rail;
    context.lineWidth = 10;
    context.strokeRect(5, 5, FIELD.width - 10, FIELD.height - 10);
    context.strokeStyle = 'rgba(242,201,76,0.35)';
    context.lineWidth = 2;
    context.strokeRect(18, 18, FIELD.width - 36, FIELD.height - 36);
  }

  function drawFoe(state, screen) {
    const foe = state.foe;
    text('THE WARDEN', 32, 40, 22, PALETTE.text, 'left', true);
    drawLifeBar(32, 52, 260, Math.round(shownLife.foe), foe.shield, foe.burn, 'LIFE', false);
    drawEmbers(32, 108, foe.embers, 'EMBERS');
    text(`Deck ${foe.deck.length}   Hand ${foe.hand.length}`, 32, 138, 15, PALETTE.muted, 'left');
    // Face-down hand, fanned across the top.
    const count = foe.hand.length;
    const total = count * FOE_CARD.width + (count - 1) * 8;
    const startX = (FIELD.width - total) / 2;
    for (let index = 0; index < count; index += 1) {
      drawCardBack(startX + index * (FOE_CARD.width + 8), 24, FOE_CARD.width, FOE_CARD.height, true);
    }
    if (screen === SCREEN_PLAY) {
      text(state.foeIntent ?? '', FIELD.width / 2, 138, 16, PALETTE.gold, 'center');
    }
  }

  function drawYou(state, screen, hover) {
    const you = state.you;
    text('YOU', 32, 600, 22, PALETTE.text, 'left', true);
    drawLifeBar(32, 612, 260, Math.round(shownLife.you), you.shield, you.burn, 'LIFE', false);
    drawEmbers(32, 676, you.embers, 'EMBERS');
    text(`Deck ${you.deck.length}   Discard ${you.discard.length}`, 32, 702, 15, PALETTE.muted, 'left');
    // Hand: the hovered card is drawn last, on top of its neighbours.
    const count = you.hand.length;
    for (let index = 0; index < count; index += 1) {
      if (index === hover) continue;
      const rect = handRect(index, count);
      const card = you.hand[index];
      const affordable = screen === SCREEN_PLAY && state.phase === PHASE_PLAYER && you.embers >= card.cost;
      drawCard(card, rect.x, rect.y, rect.width, rect.height, { dim: !affordable && screen === SCREEN_PLAY });
    }
    if (hover >= 0 && hover < count) {
      const rect = handRect(hover, count);
      const card = you.hand[hover];
      drawCard(card, rect.x, rect.y - CARD.hoverLift, rect.width, rect.height, {});
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      roundRect(context, rect.x - 2, rect.y - CARD.hoverLift - 2, rect.width + 4, rect.height + 4, 13);
      context.stroke();
      text(`[${hover + 1}]`, rect.x + rect.width / 2, rect.y - CARD.hoverLift - 10, 15, PALETTE.gold, 'center', true);
    }
    // End Turn button.
    const canEnd = screen === SCREEN_PLAY && state.phase === PHASE_PLAYER;
    context.fillStyle = canEnd ? PALETTE.gold : '#5a5138';
    roundRect(context, END_TURN.x, END_TURN.y, END_TURN.width, END_TURN.height, 10);
    context.fill();
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = 2;
    context.stroke();
    text(state.phase === PHASE_AI ? 'WARDEN…' : 'END TURN', END_TURN.x + END_TURN.width / 2, END_TURN.y + 36, 20, PALETTE.ink, 'center', true);
  }

  function drawCentre(state, screen) {
    const last = state.lastPlayed;
    text(`TURN ${Math.max(1, state.turn)}`, FIELD.width / 2, 168, 24, PALETTE.text, 'center', true);
    const status = state.result
      ? (state.result === 'win' ? 'You take the court!' : 'The Warden takes the court.')
      : state.phase === PHASE_AI ? 'The Warden is playing…' : 'Your move — play a card, then End Turn.';
    text(status, FIELD.width / 2, 194, 16, PALETTE.muted, 'center');
    // Last played card, centre stage.
    if (last) {
      const flying = flights.find((flight) => flight.card === last.card);
      if (!flying) {
        drawCard(last.card, 580, 216, CARD.width, CARD.height, { resonance: last.resonance || 0 });
        text(`${last.side.name} played`, 640, 424, 15, PALETTE.muted, 'center');
        text(last.card.name, 640, 446, 18, PALETTE.text, 'center', true);
      }
    }
    // Cards played this turn, as small colour chips in a row above the hand.
    const played = [...state.you.played, ...state.foe.played];
    if (played.length > 0) {
      const chip = 44;
      const total = played.length * (chip + 8) - 8;
      let x = (FIELD.width - total) / 2;
      text('Played:', x - 12, 482, 14, PALETTE.muted, 'right', true);
      for (const card of played) {
        const element = ELEMENTS[card.element];
        context.fillStyle = element.color;
        roundRect(context, x, 452, chip, chip, 8);
        context.fill();
        context.strokeStyle = element.dark;
        context.lineWidth = 2;
        context.stroke();
        text(element.letter, x + chip / 2, 480, 20, '#ffffff', 'center', true);
        x += chip + 8;
      }
    }
    // Log.
    context.fillStyle = 'rgba(10,20,14,0.85)';
    roundRect(context, LOG_BOX.x, LOG_BOX.y, LOG_BOX.width, LOG_BOX.height, 10);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1.5;
    context.stroke();
    text('TABLE TALK', LOG_BOX.x + 14, LOG_BOX.y + 24, 14, PALETTE.gold, 'left', true);
    const lines = state.log.slice(-11);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index].slice(0, 30), LOG_BOX.x + 14, LOG_BOX.y + 48 + index * 20, 13, PALETTE.text, 'left');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = 150 + lines.length * 34 + 84;
    const x = (FIELD.width - 620) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(8,18,12,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, 620, height, 16);
    context.fill();
    context.strokeStyle = accent ?? PALETTE.gold;
    context.lineWidth = 3;
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, accent ?? PALETTE.gold, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 128 + index * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.text, 'center', true);
  }

  function drawTitle(state, best) {
    drawTable(state);
    drawFoe(state, SCREEN_TITLE);
    drawYou(state, SCREEN_TITLE, -1);
    drawCentre(state, SCREEN_TITLE);
    drawPanel(
      'EMBER COURT',
      [
        'A duel of cards. Thirty life each, eight embers a turn.',
        'Play a card, then End Turn. Two of one element in a turn',
        'strike with Resonance +2. Burn keeps burning. Shield holds.',
        best > 0 ? `Best result: ${best === 1 ? 'a win' : `${best} wins`} in this browser.` : 'No wins yet in this browser — the Warden waits.',
      ],
      'Press Space or click to sit down',
      PALETTE.gold,
    );
  }

  function drawOver(state, best) {
    drawTable(state);
    drawFoe(state, SCREEN_OVER);
    drawYou(state, SCREEN_OVER, -1);
    drawCentre(state, SCREEN_OVER);
    const won = state.result === 'win';
    drawPanel(
      won ? 'VICTORY' : 'DEFEAT',
      won
        ? ['The Warden lays down its hand and bows.', `Your life: ${Math.max(0, state.you.life)}  •  Turns: ${state.turn}`, 'The court is yours. Play again?']
        : ['The Warden takes the last ember.', `The Warden's life: ${Math.max(0, state.foe.life)}  •  Turns: ${state.turn}`, 'Deal again and take it back.'],
      'Press Space or click to play again',
      won ? PALETTE.gold : PALETTE.life,
    );
  }

  function updateAnimations(dt) {
    for (const floater of floaters) {
      floater.y -= 42 * dt;
      floater.ttl -= dt;
    }
    for (let index = floaters.length - 1; index >= 0; index -= 1) {
      if (floaters[index].ttl <= 0) floaters.splice(index, 1);
    }
    for (const flight of flights) flight.t += dt * 2.2;
    for (let index = flights.length - 1; index >= 0; index -= 1) {
      if (flights[index].t >= 1) flights.splice(index, 1);
    }
    for (const particle of particles) {
      particle.y -= particle.speed * dt;
      particle.x += Math.sin(particle.y * 0.05) * 12 * dt;
      particle.ttl -= dt;
    }
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      if (particles[index].ttl <= 0) particles.splice(index, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 3);
  }

  /** Paint one frame: table, both sides, centre, then the screen's panel. */
  function draw(state, screen, viewState) {
    const dt = 1 / 60;
    updateAnimations(dt);
    if (viewState.snap) {
      // Screenshot scenes paint twice: jump the bars straight to the truth.
      shownLife.you = state.you.life;
      shownLife.foe = state.foe.life;
    }
    shownLife.you += (state.you.life - shownLife.you) * 0.12;
    shownLife.foe += (state.foe.life - shownLife.foe) * 0.12;
    if (Math.abs(state.you.life - shownLife.you) < 0.05) shownLife.you = state.you.life;
    if (Math.abs(state.foe.life - shownLife.foe) < 0.05) shownLife.foe = state.foe.life;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
    const shakeY = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    context.textBaseline = 'alphabetic';

    if (screen === SCREEN_TITLE) {
      drawTitle(state, viewState.best);
      return;
    }
    drawTable(state);
    drawFoe(state, screen);
    drawYou(state, screen, viewState.hover);
    drawCentre(state, screen);
    // Card flights.
    for (const flight of flights) {
      const t = Math.min(1, flight.t);
      const ease = 1 - (1 - t) * (1 - t);
      const x = flight.fromX + (flight.toX - flight.fromX) * ease;
      const y = flight.fromY + (flight.toY - flight.fromY) * ease - Math.sin(t * Math.PI) * 60;
      drawCard(flight.card, x, y, CARD.width, CARD.height, {});
    }
    // Floaters.
    for (const floater of floaters) {
      context.globalAlpha = Math.max(0, Math.min(1, floater.ttl / 0.6));
      text(floater.text, floater.x, floater.y, 30, floater.color, 'center', true);
      context.globalAlpha = 1;
    }
    // Win embers.
    for (const particle of particles) {
      context.globalAlpha = Math.max(0, Math.min(1, particle.ttl));
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The embers wait for you.'], 'Press P to resume', PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      drawOver(state, viewState.best);
    }
  }

  /** Turn world events into motion: flights, floaters, shake, win embers. */
  function notify(events, state) {
    for (const event of events) {
      if (event.kind === EVENT_PLAY) {
        const from = event.side === state.you
          ? { x: FIELD.width / 2 - CARD.width / 2, y: HAND_Y }
          : { x: FIELD.width / 2 - CARD.width / 2, y: 24 };
        flights.push({ card: event.card, fromX: from.x, fromY: from.y, toX: 580, toY: 216, t: 0 });
      } else if (event.kind === EVENT_DAMAGE) {
        const target = event.side === state.you ? { x: 160, y: 640 } : { x: 160, y: 80 };
        if (event.amount > 0) {
          floaters.push({ x: target.x, y: target.y, text: `-${event.amount}`, color: PALETTE.life, ttl: 1.1 });
          if (event.amount >= 7) shake = 1;
        }
        if (event.absorbed > 0) {
          floaters.push({ x: target.x + 90, y: target.y, text: `blocked ${event.absorbed}`, color: PALETTE.shield, ttl: 1.1 });
        }
      } else if (event.kind === EVENT_HEAL) {
        const at = event.side === state.you ? { x: 160, y: 640 } : { x: 160, y: 80 };
        floaters.push({ x: at.x, y: at.y, text: `+${event.amount}`, color: PALETTE.leaf, ttl: 1.1 });
      } else if (event.kind === EVENT_SHIELD) {
        const at = event.side === state.you ? { x: 160, y: 640 } : { x: 160, y: 80 };
        floaters.push({ x: at.x, y: at.y, text: `+${event.amount} shield`, color: PALETTE.shield, ttl: 1.1 });
      } else if (event.kind === EVENT_BURN && event.applied) {
        const at = event.side === state.you ? { x: 160, y: 640 } : { x: 160, y: 80 };
        floaters.push({ x: at.x, y: at.y, text: `burn ${event.amount}`, color: PALETTE.burn, ttl: 1.1 });
      } else if (event.kind === EVENT_WIN) {
        for (let index = 0; index < 60; index += 1) {
          particles.push({
            x: Math.random() * FIELD.width, y: FIELD.height + Math.random() * 80,
            speed: 60 + Math.random() * 90, size: 2 + Math.random() * 4,
            color: Math.random() > 0.5 ? PALETTE.gold : PALETTE.ember, ttl: 2.5 + Math.random(),
          });
        }
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, notify, view };
}
