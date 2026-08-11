/**
 * Shared geometry and layout constants for the Fabric UI demo.
 *
 * All positions are in "fabric plane" units. The membrane is a plane in local
 * XY with its normal along +Z, so a feature at (x, y) sits at plane coordinate
 * (x, y) and the height field displaces it along Z.
 */

/** Uniform array size in the shader. Fixed so the feature loop can be unrolled. */
export const MAX_FEATURES = 8;

/** Fixed slot per feature so uniform writes never need to reorder. */
export const SLOT = {
    questionCard: 0,
    tray: 1,
    option: 2, // occupies slots 2, 3, 4, 5
    submit: 6,
    pointer: 7,
} as const;

export const OPTION_COUNT = 4;

/**
 * The plane overfills the visible frame so its edges never enter shot when the
 * camera is tilted.
 */
export const PLANE_WIDTH = 5.6;
export const PLANE_HEIGHT = 5.4;

/**
 * Tessellation. Only the silhouette needs geometry, since fragment normals are
 * derived analytically, so this is deliberately modest.
 */
export const PLANE_SEGMENTS = 192;

/** Half extents of the area the camera frames. */
export const DESIGN_HALF_WIDTH = 2.0;
export const DESIGN_HALF_HEIGHT = 1.98;

/** Static layout of the quiz surface, in plane units. */
export const LAYOUT = {
    questionCard: { center: [0, 1.4] as [number, number], halfSize: [1.62, 0.34] as [number, number], radius: 0.14 },
    tray: { center: [0, 0] as [number, number], halfSize: [1.72, 0.99] as [number, number], radius: 0.2 },
    /** Option row centres, top to bottom. */
    optionRowY: [0.66, 0.22, -0.22, -0.66],
    submit: { center: [0, -1.44] as [number, number], halfSize: [1.3, 0.26] as [number, number], radius: 0.13 },
} as const;

/**
 * Elevation targets per interaction state, as multiples of the leva `elevation`
 * control. Ratios come from the design table: idle 0.15, hover 0.19,
 * pressed -0.08, selected -0.04, correct 0.24, incorrect -0.12.
 */
export const STATE_ELEVATION = {
    idle: 1,
    hover: 1.2667,
    pressed: -0.5333,
    selected: -0.2667,
    correct: 1.6,
    incorrect: -0.8,
} as const;

/** Depth of the permanently sunken tray the options sit inside. */
export const TRAY_ELEVATION_RATIO = -0.4;
/** Resting height of the question card, lower than an option so it reads as backdrop. */
export const CARD_ELEVATION_RATIO = 0.6667;
/** Local dimple that follows the pointer while an option is held down. */
export const POINTER_DIMPLE_RATIO = -0.6;
export const POINTER_DIMPLE_RADIUS = 0.16;

/** Horizontal shake applied to an incorrect option, in plane units. */
export const SHAKE_AMPLITUDE = 0.055;
export const SHAKE_FREQUENCY = 26;
export const SHAKE_DECAY = 7.5;
