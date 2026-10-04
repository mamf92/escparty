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
  spotShare: 0.45,
  spotStrength: [0.5, 0.5],
  maxSpots: 60,
};

/** The facets per row and column the ball is painted at. */
export const BALL_GRID = 24;
/** A facet's angular size, in radians. */
const FACET = 0.27;
/**
 * How fast the ball turns, in radians a second. Negative, so its front
 * moves left to right and the spots sweep the room the same way.
 */
export const SPIN = -0.12;
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

const facet = (latitude: number, longitude: number, phase: number) => {
  const row = Math.floor(latitude / FACET);
  const column = Math.floor(longitude / FACET);
  const a = (row + 0.5) * FACET;
  const o = (column + 0.5) * FACET - phase;
  return {
    normal: [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)] as Vec,
    key: hash(row, column),
  };
};

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
  /** Centre, as a share of the stage's width and height (may fall outside 0..1). */
  x: number;
  y: number;
  /** Diameter, as a share of the ball's diameter. */
  size: number;
  colour: Rgb;
  alpha: number;
};

/**
 * The spots the lit facets throw, for a ball hanging at `ballY` (a share of
 * the stage's height). They spread across the stage's width and about half
 * its height either side of the ball, as they do off a real one.
 */
export const ballSpots = (look: BallLook, lamp: Vec, phase: number, ballY: number): Spot[] => {
  const spots: Spot[] = [];
  for (let latitude = -1.35; latitude < 1.4; latitude += FACET) {
    for (let longitude = -1.5 + phase; longitude < 1.5 + phase; longitude += FACET) {
      const { normal: n, key } = facet(latitude, longitude, phase);
      const lit = dot(n, lamp);
      if (n[2] < 0.1 || lit < 0.2 || hash(key, 7.7) > look.spotShare) continue;
      // The lamp's ray, reflected off the facet, lands on the wall.
      const rx = -lamp[0] + 2 * lit * n[0];
      const ry = -lamp[1] + 2 * lit * n[1];
      const x = 0.5 + rx * 1.44;
      const y = ballY - ry * 0.52;
      if (x < -0.05 || x > 1.05 || y < -0.02 || y > 1.02) continue;
      spots.push({
        x,
        y,
        size: 0.03 + 0.06 * hash(key, 2.2),
        colour: look.spotColour ?? tintOf(look, key),
        alpha: Math.min(1, look.spotStrength[0] + look.spotStrength[1] * lit),
      });
      if (spots.length >= look.maxSpots) return spots;
    }
  }
  return spots;
};
