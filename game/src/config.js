// Every tuning number and colour for Ember Court, in one place.
// The table is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const GAME = {
  startLife: 30,
  startHand: 5,
  maxHand: 7,
  maxEmbers: 8,
  fatigueDamage: 2,
  resonanceBonus: 2,
  maxShield: 12,
};

export const CARD = { width: 120, height: 172, gap: 10, handY: 500, hoverLift: 26 };

export const PALETTE = {
  backdrop: '#0c1a14',
  felt: '#14532d',
  feltDark: '#0f3d21',
  feltLight: '#1a6b3a',
  rail: '#8a6d2f',
  gold: '#f2c94c',
  goldDark: '#b8912a',
  panel: '#12291c',
  panelEdge: '#2c4a38',
  text: '#f5efe0',
  muted: '#a8b8a4',
  ink: '#1c241f',
  life: '#e5534b',
  lifeBack: '#3a1512',
  ember: '#ff9f2e',
  emberBack: '#3a2410',
  shield: '#7fb3d5',
  burn: '#ff6b35',
  log: '#0a140e',
  // One colour and one shape per element, so suits are told apart by both.
  flame: '#e5534b',
  flameDark: '#8f2b24',
  tide: '#4fc3f7',
  tideDark: '#1d6f9e',
  leaf: '#7bc96f',
  leafDark: '#3d7a33',
  stone: '#c9a86a',
  stoneDark: '#7a6234',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best result is kept between visits (this browser only). */
export const BEST_KEY = 'ember-court.best';

/** The four elements. Each has a colour, a dark shade and a drawn glyph. */
export const ELEMENTS = {
  flame: { name: 'Flame', color: PALETTE.flame, dark: PALETTE.flameDark, letter: 'F' },
  tide: { name: 'Tide', color: PALETTE.tide, dark: PALETTE.tideDark, letter: 'T' },
  leaf: { name: 'Leaf', color: PALETTE.leaf, dark: PALETTE.leafDark, letter: 'L' },
  stone: { name: 'Stone', color: PALETTE.stone, dark: PALETTE.stoneDark, letter: 'S' },
};
