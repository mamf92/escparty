/*
 * The disco ball over the stage, and the spots of light it throws
 * (docs/design/design-system.md, "Themes and the stage"). Pure maths, so it can be
 * tested without a canvas: Stage.tsx paints what these return.
 *
 * The ball is a sphere of flat mirror facets on a latitude/longitude grid.
 * Each facet is lit by a lamp (in Sparkle, wherever the pointer is) and
 * throws one spot of light into the room, where the lamp's ray reflects
 * off it. Turning the ball (`phase`) moves both together.
 */

export type Rgb = readonly [number, number, number];

export type BallLook = {
  /** Facet colours: most, some and a few of the mirrors. */
  tints: readonly [Rgb, Rgb, Rgb];
  /** Where the tints change over, as a share of the facets. */
  mix: readonly [number, number];
  /** How bright a facet is in the shade, and how bright and tight its highlight is. */
  ambient: number;
  shine: number;
  sharpness: number;
  /** Share of lit facets that throw a spot, and how strong it is. */
  spotShare: number;
  spotStrength: readonly [number, number];
  /** One colour for every spot, or each spot in its facet's tint. */
  spotColour?: Rgb;
  maxSpots: number;
};

/** Calm: a still ball in muted, dusty pinks, throwing a few faint spots. */
export const CALM_BALL: BallLook = {
  tints: [[196, 146, 170], [168, 104, 138], [222, 190, 205]],
  mix: [0.5, 0.85],
  ambient: 0.5,
  shine: 0.45,
  sharpness: 40,
  spotShare: 0.22,
  spotStrength: [0.18, 0.2],
  spotColour: [230, 170, 200],
  maxSpots: 24,
};

/** Sparkle: white and light pink mirrors, a few hot pink, throwing bright spots. */
export const SPARKLE_BALL: BallLook = {
  tints: [[236, 232, 240], [255, 196, 222], [255, 120, 190]],
  mix: [0.55, 0.88],
  ambient: 0.32,
  shine: 1.2,
  sharpness: 24,
  spotShare: 0.6,
  spotStrength: [0.5, 0.5],
  maxSpots: 60,
};

/** The facets per row and column the ball is painted at. */
export const BALL_GRID = 24;
/**
 * The facets around the ball's equator, and so a facet's angular size: a
 * whole number of them fits a full turn, so the ball's pattern lines up
 * again each time it comes round instead of reshuffling.
 */
const AROUND = 24;
const FACET = (Math.PI * 2) / AROUND;
/**
 * How fast the ball turns, in radians a second. Positive, so it turns
 * clockwise seen from above: its front moves right to left and the spots
 * sweep the room the same way.
 */
export const SPIN = 0.12;
/** Where the lamp sits when nothing points at the stage: up and to the left. */
export const RESTING_LIGHT = { x: -0.45, y: -0.7 } as const;

type Vec = [number, number, number];

const hash = (a: number, b: number) => {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The lamp's direction, from where the pointer is (-1..1 across the stage). */
export const lampDirection = (x: number, y: number): Vec => {
  const v: Vec = [x * 1.2, -y * 1.2 + 0.3, 1];
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
};

/** The facet in a latitude row and a longitude column (counted from the ball's own zero). */
const facetAt = (row: number, column: number, phase: number) => {
  const wrapped = ((column % AROUND) + AROUND) % AROUND;
  const a = (row + 0.5) * FACET;
  const o = (column + 0.5) * FACET - phase;
  return {
    normal: [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)] as Vec,
    latitude: a,
    /** How far round from the front it faces (negative: towards the left). */
    longitude: o,
    // The column counted around the ball, so a full turn is the same facet.
    column: wrapped,
    key: hash(row, wrapped),
  };
};

const facet = (latitude: number, longitude: number, phase: number) =>
  facetAt(Math.floor(latitude / FACET), Math.floor(longitude / FACET), phase);

const tintOf = (look: BallLook, key: number) =>
  key < look.mix[0] ? look.tints[0] : key < look.mix[1] ? look.tints[1] : look.tints[2];

/**
 * The ball as a BALL_GRID × BALL_GRID grid of colours, row by row; `null`
 * where a cell falls outside the sphere.
 */
export const ballCells = (look: BallLook, lamp: Vec, phase: number): (Rgb | null)[] => {
  const cells: (Rgb | null)[] = [];
  for (let j = 0; j < BALL_GRID; j += 1) {
    for (let i = 0; i < BALL_GRID; i += 1) {
      const x = ((i + 0.5) / BALL_GRID) * 2 - 1;
      const y = 1 - ((j + 0.5) / BALL_GRID) * 2;
      const r2 = x * x + y * y;
      if (r2 > 1) {
        cells.push(null);
        continue;
      }
      const z = Math.sqrt(1 - r2);
      const { normal: n, key } = facet(Math.asin(y), Math.atan2(x, z) + phase, phase);
      const diffuse = Math.max(0, dot(n, lamp));
      const mirror: Vec = [2 * n[2] * n[0], 2 * n[2] * n[1], 2 * n[2] * n[2] - 1];
      const highlight = Math.pow(Math.max(0, dot(mirror, lamp)), look.sharpness) * look.shine;
      const rim = 0.6 + 0.4 * z;
      const jitter = 0.85 + 0.3 * hash(key, 3.1);
      const tint = tintOf(look, key);
      cells.push(tint.map(c => Math.min(255, Math.round(c * (look.ambient + 0.6 * diffuse) * jitter * rim + 245 * highlight))) as unknown as Rgb);
    }
  }
  return cells;
};

export type Spot = {
  /** Centre, in pixels from the stage's top left (may fall off the stage). */
  x: number;
  y: number;
  /** The square mirror's spot, foreshortened: its width and height in pixels. */
  width: number;
  height: number;
  /** A slight lean in radians, from the facet's tilt towards the wall. */
  rotation: number;
  colour: Rgb;
  alpha: number;
  /** The facet that throws it: its latitude row and longitude column on the ball. */
  row: number;
  column: number;
};

/** The stage and the ball on it, in pixels. */
export type StageView = {
  width: number;
  height: number;
  /** The ball's centre (it hangs on the stage's middle line) and radius. */
  centreY: number;
  radius: number;
};

/** Of the ball's radius, how far a spot fades out before it would reach the ball. */
const FADE_BAND = 0.9;

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * The spots the lit facets throw. Each facet throws one square spot, at
 * the place its own mirror image of the ball would sit on a wall: a bigger
 * copy of the ball's facet grid. So the spots line up in rows, one for each
 * latitude row of facets (a row's spots share one y, whatever the lamp),
 * and slide across the stage as the ball turns, in step with its rotation.
 * A spot is the facet's shape foreshortened by how far round it faces, so
 * it is squarish at the front and a slim strip at the edges. Spots never
 * reach the ball: one that would fades out and goes, and Stage.tsx clips
 * the ball's disc as well.
 *
 * The lamp picks which facets are lit and nudges the whole pattern a
 * little (rows stay aligned).
 */
export const ballSpots = (look: BallLook, lamp: Vec, phase: number, view: StageView): Spot[] => {
  const spots: Spot[] = [];
  const centreX = view.width / 2;
  // How far from the middle a facet facing sideways lands.
  const reach = Math.min(view.width * 0.62, view.height * 0.8);
  const nudgeX = -lamp[0] * reach * 0.2;
  // Rows fan out into the room above the ball and the room below it, each
  // by its own spread, so the spots fill the whole stage wherever the ball hangs.
  const up = view.centreY * 0.95;
  const down = (view.height - view.centreY) * 0.95;
  const nudgeY = -lamp[1] * Math.min(up, down) * 0.08;
  const first = Math.floor((phase - Math.PI / 2) / FACET);
  const last = Math.ceil((phase + Math.PI / 2) / FACET);
  const rows = AROUND / 4;
  for (let row = -rows; row < rows; row += 1) {
    for (let column = first; column <= last; column += 1) {
      const { normal: n, latitude, longitude, key, column: wrapped } = facetAt(row, column, phase);
      const lit = dot(n, lamp);
      if (n[2] < 0.15 || lit <= 0 || hash(key, 7.7) > look.spotShare) continue;
      // Each facet's spot is its mirror's size on the wall, squashed where it faces away.
      const side = reach * FACET * (0.26 + 0.12 * hash(key, 2.2));
      const width = side * Math.max(Math.cos(longitude), 0.2);
      const height = side * Math.max(Math.cos(latitude), 0.35);
      const x = centreX + nudgeX + reach * Math.cos(latitude) * Math.sin(longitude);
      const y = view.centreY + nudgeY - (latitude > 0 ? up : down) * Math.sin(latitude);
      // Keep clear of the ball, fading out on the way (a spot's soft edge reaches 0.65 of its size).
      const clear = Math.hypot(x - centreX, y - view.centreY) - view.radius - 0.65 * Math.hypot(width, height);
      const room = smooth(0, FADE_BAND * view.radius, clear);
      if (room <= 0) continue;
      if (x + width < 0 || x - width > view.width || y + height < 0 || y - height > view.height) continue;
      spots.push({
        x,
        y,
        width,
        height,
        rotation: 0.3 * Math.sin(latitude) * Math.sin(longitude),
        colour: look.spotColour ?? tintOf(look, key),
        alpha: Math.min(1, (look.spotStrength[0] + look.spotStrength[1] * Math.max(0, lit)) * smooth(0, 0.3, lit)) * room * smooth(0.15, 0.5, n[2]),
        row,
        column: wrapped,
      });
      if (spots.length >= look.maxSpots) return spots;
    }
  }
  return spots;
};
