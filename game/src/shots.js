// The screenshot scenes behind ?shot=title|play|win|loss. Each one plays the
// real rules forward from a fresh world, steered by a simple autopilot that
// values damage, healing, shield and card draw the way the Warden does, so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. The win and loss scenes stage a table one lethal
// card from the end, then play that card for real.
import { GAME, STEP } from './config.js';
import { catalogue } from './cards.js';
import { PHASE_AI, PHASE_PLAYER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const PLAY_TURNS = 3;

/** The autopilot's value for one card in hand. */
function valueCard(side, card, foe) {
  const hurt = 0.2 + 0.8 * (1 - side.life / GAME.startLife);
  let value = card.damage + card.heal * 0.8 * hurt + card.shield * 0.7 + card.draw * 1.6 + card.burn * 1.2;
  if (foe.life - card.damage <= 0) value += 100;
  if (side.life <= 10 && (card.heal > 0 || card.shield > 0)) value += 6;
  if (side.played.some((played) => played.element === card.element)) value += GAME.resonanceBonus;
  return value - card.cost * 0.4;
}

function bestCard(world, side) {
  const foe = side === world.state.you ? world.state.foe : world.state.you;
  let best = -1;
  let bestValue = 0.5;
  for (let index = 0; index < side.hand.length; index += 1) {
    const card = side.hand[index];
    if (card.cost > side.embers) continue;
    const value = valueCard(side, card, foe);
    if (value > bestValue) {
      bestValue = value;
      best = index;
    }
  }
  return best;
}

/** Play one full turn for `side`: up to three cards, then hand over. */
function playTurn(world, side) {
  for (let plays = 0; plays < 3; plays += 1) {
    const choice = bestCard(world, side);
    if (choice === -1) break;
    world.playCard(side, choice);
    if (world.state.result) return;
  }
  if (side === world.state.you) {
    world.endTurn();
  }
}

/** Run the Warden's turn to its end, one card at a time. */
function runAiTurn(world) {
  for (let steps = 0; steps < 40 && world.state.phase === PHASE_AI && !world.state.result; steps += 1) {
    world.aiStep();
  }
}

function playScene(world) {
  for (let turn = 0; turn < PLAY_TURNS && !world.state.result; turn += 1) {
    playTurn(world, world.state.you);
    if (world.state.result) break;
    runAiTurn(world);
  }
  return world.state.result ? SCREEN_OVER : SCREEN_PLAY;
}

function winScene(world) {
  playScene(world);
  if (world.state.result) {
    if (world.state.result === 'win') return SCREEN_OVER;
    world.reset();
  }
  // Stage the table one lethal card from the end, then play it for real.
  const state = world.state;
  state.foe.life = 4;
  state.foe.shield = 0;
  state.you.life = 18;
  state.you.embers = 8;
  state.phase = PHASE_PLAYER;
  let lethal = state.you.hand.findIndex((card) => card.damage >= 4 && card.cost <= 8);
  if (lethal === -1) {
    const spark = catalogue().find((card) => card.id === 'cinder-fang');
    state.you.hand.push(spark);
    lethal = state.you.hand.length - 1;
  }
  world.playCard(state.you, lethal);
  return SCREEN_OVER;
}

function lossScene(world) {
  playScene(world);
  if (world.state.result) {
    if (world.state.result === 'loss') return SCREEN_OVER;
    world.reset();
  }
  // Stage the table one lethal card from the end, then let the Warden play it.
  const state = world.state;
  state.you.life = 3;
  state.you.shield = 0;
  state.foe.life = 22;
  state.foe.embers = 8;
  const spark = catalogue().find((card) => card.id === 'ember-spark');
  state.foe.hand.push(spark);
  world.endTurn();
  runAiTurn(world);
  return SCREEN_OVER;
}

/**
 * Set `world` to the named scene (title, play, win or loss; any other name is
 * title) and return the screen to draw over it and the best result to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    return { screen: playScene(world), best: 0 };
  }
  if (name === 'win') {
    return { screen: winScene(world), best: 1 };
  }
  if (name === 'loss') {
    return { screen: lossScene(world), best: 0 };
  }
  for (let index = 0; index < 5 / STEP; index += 1) world.step(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}
