/**
 * Shared geometry and layout constants for the Fabric UI demo.
 *
 * All positions are in "fabric plane" units. The membrane is a plane in local
 * XY with its normal along +Z, so a feature at (x, y) sits at plane coordinate
 * (x, y) and the height field displaces it along Z.
 */

/** Uniform array size in the shader. Fixed so the feature loop can be unrolled. */
export const MAX_FEATURES = 10;

/** Fixed slot per feature so uniform writes never need to reorder. */
export const SLOT = {
    questionCard: 0,
    tray: 1,
    option: 2, // occupies slots 2, 3, 4, 5
    submit: 6,
    pointer: 7,
    correctMarker: 8,
    wrongMarker: 9,
} as const;

export const OPTION_COUNT = 4;

/**
 * The plane overfills the visible frame so its edges never enter shot when the
 * camera is tilted.
 */
export const PLANE_WIDTH = 5.2;
export const PLANE_HEIGHT = 5.2;

/**
 * Tessellation. Only the silhouette needs geometry, since fragment normals are
 * derived analytically.
 *
 * The membrane itself is happy at 192. The marker glyphs are not: they are
 * small, hard edged and tall, so at 192 their slope band was narrower than a
 * single quad and the displacement tore the silhouette into spikes.
 *
 * 384 gives visibly cleaner glyph edges under magnification, but measured a
 * consistent 20 percent slower in paired runs, and its worst reading was close
 * enough to 60fps to be uncomfortable. At 1:1 the difference does not show, so
 * 288 is the better trade.
 */
export const PLANE_SEGMENTS = 288;

/** Half extents of the area the camera frames. */
export const DESIGN_HALF_WIDTH = 2.0;
export const DESIGN_HALF_HEIGHT = 1.98;

/**
 * The content column is offset to the right of centre, which leaves a gutter on
 * the left for the correct and wrong marker glyphs.
 */
export const COLUMN_X = 0.24;

/** Static layout of the quiz surface, in plane units. */
export const LAYOUT = {
    questionCard: { center: [COLUMN_X, 1.4] as [number, number], halfSize: [1.54, 0.34] as [number, number], radius: 0.14 },
    tray: { center: [COLUMN_X, 0] as [number, number], halfSize: [1.62, 0.99] as [number, number], radius: 0.2 },
    /** Option row centres, top to bottom. */
    optionRowY: [0.66, 0.22, -0.22, -0.66],
    submit: { center: [COLUMN_X, -1.44] as [number, number], halfSize: [1.24, 0.26] as [number, number], radius: 0.13 },
} as const;

/**
 * Marker glyphs that call out the correct and the wrong answer.
 *
 * They sit in the left gutter rather than colouring the option itself, so the
 * option's own shape stays the only thing saying whether it is raised or
 * pressed. Position tracks the option width so the gutter never collides.
 */
export const MARKER = {
    halfSize: [0.21, 0.175] as [number, number],
    /** Clearance between the marker and the left edge of an option. */
    gap: 0.05,
    /** Multiple of `elevation`. Above 1 so a marker stands proud of an option. */
    elevationRatio: 1.15,
    /**
     * Stroke half thickness, as a multiple of the smaller half extent, and also
     * the radius of the round caps. Has to stay well clear of the slope band or
     * the stroke is all slope with no flat top for the colour to sit on.
     */
    strokeRatio: 0.38,
    /** Multiple of `falloff`. Tight, so the glyph reads as a hard edged object. */
    falloffRatio: 0.63,
} as const;

/**
 * Elevation targets per interaction state, as multiples of the leva `elevation`
 * control.
 *
 * `selected` is the resting pushed in depth, and `pressed` sits deeper than it.
 * Holding an option therefore drives it past where it will end up, and letting
 * go settles it back onto the full depth with one small bounce. Making
 * `pressed` the deepest point and `selected` shallower did the opposite: the
 * option sank on click and then rose to a half depth, which read as the press
 * failing to take.
 */
export const STATE_ELEVATION = {
    idle: 1,
    hover: 1.2667,
    pressed: -0.85,
    selected: -0.5333,
    correct: 1.6,
    incorrect: -1.05,
} as const;

/**
 * Depth of the optional sunken tray the options sit inside.
 *
 * Must stay shallower than the shallowest sunken state, which is `selected` at
 * -0.2667. Negative contributions combine with a smooth minimum, so a tray
 * deeper than a selected option swallows it flush into the tray floor and it
 * loses all of its relief.
 */
export const TRAY_ELEVATION_RATIO = -0.18;
/**
 * The question card is debossed, not raised.
 *
 * The rule the demo settles on is that elevation means interactive: raised is
 * something you can press, debossed is a label pressed into the material, and
 * flat is the ground. Giving a non interactive surface a coloured cap like the
 * marker glyphs was the other option, but then colour stops meaning "result"
 * and the check and cross lose their punch.
 */
export const CARD_ELEVATION_RATIO = -0.32;
/** Local dimple that follows the pointer while an option is held down. */
export const POINTER_DIMPLE_RATIO = -0.6;
export const POINTER_DIMPLE_RADIUS = 0.16;

/** Horizontal shake applied to an incorrect option, in plane units. */
export const SHAKE_AMPLITUDE = 0.055;
export const SHAKE_FREQUENCY = 26;
export const SHAKE_DECAY = 7.5;
