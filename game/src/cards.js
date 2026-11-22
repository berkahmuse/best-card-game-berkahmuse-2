// The card catalogue: 24 original cards, six per element. A card is one line of
// rules: what it costs in embers, how hard it hits, and what else it does.
// damage / heal / shield / draw / burn are all plain numbers the renderer
// prints on the card, so a card is readable at thumbnail size.

export const ELEMENT_FLAME = 'flame';
export const ELEMENT_TIDE = 'tide';
export const ELEMENT_LEAF = 'leaf';
export const ELEMENT_STONE = 'stone';

// id, name, element, cost, damage, heal, shield, draw, burn, flavour
const DEFS = [
  // Flame — raw damage, and burn that keeps hurting.
  ['ember-spark', 'Ember Spark', ELEMENT_FLAME, 1, 3, 0, 0, 0, 0, 'A first spark.'],
  ['cinder-fang', 'Cinder Fang', ELEMENT_FLAME, 2, 5, 0, 0, 0, 0, 'Bites hot.'],
  ['wildfire', 'Wildfire', ELEMENT_FLAME, 3, 6, 0, 0, 0, 2, 'It keeps burning.'],
  ['phoenix-dive', 'Phoenix Dive', ELEMENT_FLAME, 4, 8, 0, 0, 0, 0, 'Down in a blaze.'],
  ['ashen-rain', 'Ashen Rain', ELEMENT_FLAME, 5, 7, 0, 0, 0, 3, 'Ash falls all day.'],
  ['inferno-crown', 'Inferno Crown', ELEMENT_FLAME, 6, 11, 0, 0, 0, 0, 'The court bows.'],
  // Tide — damage that draws you deeper into your deck.
  ['ripple', 'Ripple', ELEMENT_TIDE, 1, 2, 0, 0, 1, 0, 'Small waves grow.'],
  ['deep-current', 'Deep Current', ELEMENT_TIDE, 2, 4, 0, 0, 1, 0, 'Pull them under.'],
  ['frostbind', 'Frostbind', ELEMENT_TIDE, 2, 3, 0, 3, 0, 0, 'Cold holds the line.'],
  ['tidal-wave', 'Tidal Wave', ELEMENT_TIDE, 4, 7, 0, 0, 1, 0, 'The sea arrives.'],
  ['still-pool', 'Still Pool', ELEMENT_TIDE, 1, 0, 3, 0, 1, 0, 'Breathe deep.'],
  ['maelstrom', 'Maelstrom', ELEMENT_TIDE, 5, 9, 0, 0, 0, 0, 'All spins down.'],
  // Leaf — mend yourself, then bite back.
  ['sprout', 'Sprout', ELEMENT_LEAF, 1, 0, 4, 0, 0, 0, 'Heal 4. New growth.'],
  ['thorn-whip', 'Thorn Whip', ELEMENT_LEAF, 2, 3, 2, 0, 0, 0, 'Thorns answer.'],
  ['grove-guard', 'Grove Guard', ELEMENT_LEAF, 2, 0, 2, 4, 0, 0, 'Root and stone.'],
  ['bloom-burst', 'Bloom Burst', ELEMENT_LEAF, 3, 5, 3, 0, 0, 0, 'Petals like knives.'],
  ['ancient-oak', 'Ancient Oak', ELEMENT_LEAF, 4, 0, 3, 7, 0, 0, 'Unmoved.'],
  ['overgrowth', 'Overgrowth', ELEMENT_LEAF, 5, 6, 5, 0, 0, 0, 'The court overgrows.'],
  // Stone — stand firm, then answer in kind.
  ['pebble-guard', 'Pebble Guard', ELEMENT_STONE, 1, 0, 0, 5, 0, 0, 'Small, solid.'],
  ['granite-fist', 'Granite Fist', ELEMENT_STONE, 2, 4, 0, 2, 0, 0, 'A fist of rock.'],
  ['quake-slam', 'Quake Slam', ELEMENT_STONE, 3, 5, 0, 3, 0, 0, 'The floor jumps.'],
  ['mountain-wall', 'Mountain Wall', ELEMENT_STONE, 3, 0, 0, 9, 0, 0, 'Nothing passes.'],
  ['boulder-drop', 'Boulder Drop', ELEMENT_STONE, 4, 8, 0, 0, 0, 0, 'Look up. Too late.'],
  ['titans-roar', "Titan's Roar", ELEMENT_STONE, 6, 9, 0, 5, 0, 0, 'The mountain speaks.'],
];

/** The whole catalogue, as fresh card objects (never shared between games). */
export function catalogue() {
  return DEFS.map(([id, name, element, cost, damage, heal, shield, draw, burn, flavour]) => ({
    id, name, element, cost, damage, heal, shield, draw, burn, flavour,
    uid: 0,
  }));
}

let nextUid = 1;

/** A full deck: two copies of every card, each copy its own object. */
export function buildDeck() {
  const deck = [];
  for (let copy = 0; copy < 2; copy += 1) {
    for (const card of catalogue()) {
      card.uid = nextUid;
      nextUid += 1;
      deck.push(card);
    }
  }
  return deck;
}

/** One line of rules text for a card, built from its numbers. */
export function cardText(card) {
  const parts = [];
  if (card.damage > 0) parts.push(`Deal ${card.damage}`);
  if (card.heal > 0) parts.push(`Heal ${card.heal}`);
  if (card.shield > 0) parts.push(`Shield ${card.shield}`);
  if (card.draw > 0) parts.push(`Draw ${card.draw}`);
  if (card.burn > 0) parts.push(`Burn ${card.burn}`);
  return parts.join(', ');
}
