// Ember Court's rules and state, with no drawing and no browser in it: two
// duelists, each with life, shield, burn, embers, a deck and a hand. One side
// plays cards, the other answers. step() advances the clock the renderer
// needs; playCard() resolves one card and reports what happened as events,
// so the caller can animate without the world knowing about screens.

import { GAME } from './config.js';
import { buildDeck, cardText } from './cards.js';
import { shuffle } from './random.js';

export const PHASE_PLAYER = 'player';
export const PHASE_AI = 'ai';
export const PHASE_OVER = 'over';

export const EVENT_PLAY = 'play';
export const EVENT_DAMAGE = 'damage';
export const EVENT_HEAL = 'heal';
export const EVENT_SHIELD = 'shield';
export const EVENT_DRAW = 'draw';
export const EVENT_BURN = 'burn';
export const EVENT_TURN = 'turn';
export const EVENT_WIN = 'win';
export const EVENT_LOSS = 'loss';
export const EVENT_FATIGUE = 'fatigue';

function makeSide(name, random) {
  const deck = shuffle(buildDeck(), random);
  return {
    name, life: GAME.startLife, shield: 0, burn: 0, embers: 0,
    deck, hand: [], discard: [], played: [],
  };
}

export function createWorld(random) {
  const state = {
    turn: 0,
    phase: PHASE_PLAYER,
    result: null,
    you: null,
    foe: null,
    log: [],
    lastPlayed: null,
    aiWait: 0,
  };

  function logLine(line) {
    state.log.push(line);
    if (state.log.length > 40) state.log.shift();
  }

  function reset() {
    state.turn = 0;
    state.phase = PHASE_PLAYER;
    state.result = null;
    state.you = makeSide('You', random);
    state.foe = makeSide('The Warden', random);
    state.log = [];
    state.lastPlayed = null;
    state.aiWait = 0;
    drawCards(state.you, GAME.startHand);
    drawCards(state.foe, GAME.startHand);
    logLine('The court is seated. Your move.');
    startTurn(state.you);
  }

  /** Draw `count` cards, taking fatigue when the deck runs dry. */
  function drawCards(side, count) {
    const events = [];
    for (let index = 0; index < count; index += 1) {
      if (side.hand.length >= GAME.maxHand) break;
      if (side.deck.length === 0) {
        if (side.discard.length === 0) {
          side.life -= GAME.fatigueDamage;
          events.push({ kind: EVENT_FATIGUE, side, amount: GAME.fatigueDamage });
          logLine(`${side.name} out of cards — fatigue ${GAME.fatigueDamage}.`);
          checkEnd();
          continue;
        }
        side.deck = shuffle(side.discard.splice(0), random);
        logLine(`${side.name} reshuffle${side === state.you ? '' : 's'} the discard.`);
      }
      const card = side.deck.pop();
      side.hand.push(card);
      events.push({ kind: EVENT_DRAW, side, card });
    }
    return events;
  }

  /** Burn ticks at the start of your turn, straight through shield. */
  function burnTick(side) {
    if (side.burn <= 0) return [];
    const amount = side.burn;
    side.life -= amount;
    side.burn -= 1;
    logLine(`${side.name} burn${side === state.you ? '' : 's'} for ${amount}.`);
    const events = [{ kind: EVENT_BURN, side, amount }];
    checkEnd();
    return events;
  }

  function startTurn(side) {
    if (state.result) return [];
    state.turn += side === state.you ? 1 : 0;
    // Two embers on the first turn, one more each turn after, up to eight:
    // a fresh hand almost always holds something playable.
    side.embers = Math.min(state.turn + 1, GAME.maxEmbers);
    side.played = [];
    const events = burnTick(side);
    if (state.result) return events;
    events.push(...drawCards(side, 1));
    events.push({ kind: EVENT_TURN, side });
    return events;
  }

  function other(side) {
    return side === state.you ? state.foe : state.you;
  }

  function checkEnd() {
    if (state.result) return;
    if (state.foe.life <= 0 && state.you.life <= 0) {
      state.result = state.you.life >= state.foe.life ? 'win' : 'loss';
    } else if (state.foe.life <= 0) {
      state.result = 'win';
    } else if (state.you.life <= 0) {
      state.result = 'loss';
    }
    if (state.result) {
      state.phase = PHASE_OVER;
      logLine(state.result === 'win' ? 'The Warden falls!' : 'The Warden takes the court.');
    }
  }

  /** Damage first eats shield, then life. Returns what actually landed. */
  function applyDamage(target, amount) {
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    const dealt = amount - absorbed;
    target.life -= dealt;
    return { absorbed, dealt };
  }

  function canPlay(side, card) {
    return !state.result && state.phase === (side === state.you ? PHASE_PLAYER : PHASE_AI)
      && side.embers >= card.cost;
  }

  /**
   * Resolve one card from `side`'s hand. Resonance: a second card of an element
   * already played this turn hits +2 harder. Returns the events it caused.
   */
  function playCard(side, handIndex) {
    const events = [];
    const card = side.hand[handIndex];
    if (!card || !canPlay(side, card)) return events;
    const target = other(side);
    const sameElement = side.played.some((played) => played.element === card.element);
    const resonance = sameElement ? GAME.resonanceBonus : 0;
    side.embers -= card.cost;
    side.hand.splice(handIndex, 1);
    side.discard.push(card);
    side.played.push(card);
    state.lastPlayed = { card, side, resonance };
    events.push({ kind: EVENT_PLAY, side, card, resonance });
    logLine(`${side.name === 'You' ? 'You' : 'Warden'}: ${card.name} — ${cardText(card).split(', ')[0]}${resonance ? ` (Res. +${resonance})` : ''}.`);

    if (card.damage > 0) {
      const amount = card.damage + resonance;
      const { absorbed, dealt } = applyDamage(target, amount);
      events.push({ kind: EVENT_DAMAGE, side: target, amount: dealt, absorbed, resonance });
      if (absorbed > 0) logLine(`Shield soaks ${absorbed}.`);
    }
    if (card.burn > 0) {
      target.burn += card.burn;
      events.push({ kind: EVENT_BURN, side: target, amount: card.burn, applied: true });
    }
    if (card.heal > 0) {
      const healed = Math.min(card.heal, GAME.startLife - side.life);
      side.life += healed;
      events.push({ kind: EVENT_HEAL, side, amount: healed });
    }
    if (card.shield > 0) {
      const gained = Math.min(card.shield, GAME.maxShield - side.shield);
      side.shield += gained;
      events.push({ kind: EVENT_SHIELD, side, amount: gained });
    }
    if (card.draw > 0) events.push(...drawCards(side, card.draw));
    checkEnd();
    return events;
  }

  /** Value one card in hand for the Warden: damage, survival and card flow. */
  function cardValue(side, card) {
    const target = other(side);
    // Healing is worth little at full life, everything when hurt.
    const hurt = 0.2 + 0.8 * (1 - side.life / GAME.startLife);
    let value = card.damage * 1.0 + card.heal * 0.8 * hurt + card.shield * 0.7
      + card.draw * 1.6 + card.burn * 1.2;
    if (target.life - card.damage <= 0) value += 100;
    if (side.life <= 10 && (card.heal > 0 || card.shield > 0)) value += 6;
    if (side.played.some((played) => played.element === card.element)) value += GAME.resonanceBonus;
    if (card.cost > side.embers) value = -1;
    return value - card.cost * 0.4;
  }

  /** The Warden's best affordable card, or -1 when it passes. */
  function aiChoose() {
    const side = state.foe;
    let best = -1;
    let bestValue = 0.5;
    for (let index = 0; index < side.hand.length; index += 1) {
      const value = cardValue(side, side.hand[index]);
      if (value > bestValue) {
        bestValue = value;
        best = index;
      }
    }
    return best;
  }

  /** One Warden step: play one card, or end its turn and hand back to you. */
  function aiStep() {
    if (state.result || state.phase !== PHASE_AI) return [];
    const choice = aiChoose();
    if (choice === -1) {
      state.phase = PHASE_PLAYER;
      startTurn(state.you);
      logLine('Your turn — embers refilled.');
      return [{ kind: EVENT_TURN, side: state.you }];
    }
    return playCard(state.foe, choice);
  }

  /** End your turn: the Warden answers, one card at a time. */
  function endTurn() {
    if (state.result || state.phase !== PHASE_PLAYER) return [];
    state.phase = PHASE_AI;
    logLine('The Warden takes the table…');
    return startTurn(state.foe);
  }

  /** The Warden's mood, readable from its hand: a hint, not a spoiler. */
  function foeIntent() {
    if (state.result) return '';
    const hand = state.foe.hand;
    if (hand.length === 0) return 'The Warden holds nothing.';
    const heavy = hand.some((card) => card.cost >= 5);
    const healing = hand.some((card) => card.heal > 0 || card.shield >= 7);
    if (state.foe.life <= 8 && healing) return 'The Warden guards its wounds…';
    if (heavy) return 'The Warden grins — something heavy is coming.';
    if (state.foe.embers >= 4) return 'The Warden counts its embers.';
    return 'The Warden watches your hand.';
  }

  /** Advance the clock the renderer needs; nothing here moves the game. */
  function step(dt) {
    if (state.aiWait > 0) state.aiWait = Math.max(0, state.aiWait - dt);
    return [];
  }

  reset();
  return { state, reset, drawCards, startTurn, canPlay, playCard, aiChoose, aiStep, endTurn, foeIntent, step, logLine };
}
