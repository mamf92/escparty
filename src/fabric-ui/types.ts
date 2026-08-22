/** Interaction states an option can be in, in the order the design table lists them. */
export type OptionState =
    | 'idle'
    | 'hover'
    | 'pressed'
    | 'selected'
    | 'correct'
    | 'incorrect';

export type FabricShape = 'rect' | 'circle' | 'check' | 'cross';

/**
 * One element on the sheet. This is the only description the shader gets: the
 * DOM layer owns interaction and state, and it edits this array.
 */
export interface FabricFeature {
    active: boolean;
    shape: FabricShape;
    /** Centre in plane units. */
    center: [number, number];
    /** Half extents in plane units. For a circle only x is read, as the radius. */
    halfSize: [number, number];
    /** Corner radius for `rect`. For `check` and `cross`, the stroke half thickness. */
    cornerRadius: number;
    /** Signed. Positive raises a protrusion, negative sinks an indent. */
    elevation: number;
    falloff: number;
    tension: number;
    /**
     * Sum this feature on top of the combined field rather than folding it into
     * the signed accumulation. Used by the pointer dimple so it deforms whatever
     * it is dragged across.
     */
    additive?: boolean;
    /** Linear space colour blended over the base colour across the plateau. */
    tint: [number, number, number];
    tintStrength: number;
    /**
     * Render as a hard untextured surface. Suppresses the weave and the tension
     * ridges across this feature's plateau and tightens its highlight.
     */
    matte?: boolean;
    /** Darkens the flat top only. Marks a surface as pressable. */
    topShade?: number;
    /** Set true for one frame's worth of state change to fire the shake. */
    shake?: boolean;
}

/**
 * A feature plateau projected to screen space, as a CSS affine matrix plus the
 * element's own unforeshortened box. The matrix carries all the tilt, yaw and
 * shear, so the DOM label lies on the panel instead of hovering over it.
 */
export interface ProjectedQuad {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    width: number;
    height: number;
}

export type SurfaceMode = 'woven' | 'felt' | 'sequin';

export interface MaterialPreset {
    baseColor: string;
    /** Which micro surface model the fragment shader runs. */
    surface: SurfaceMode;
    weaveScale: number;
    weaveIntensity: number;
    /** 0 plain knit, 1 two by two twill. */
    twill: number;
    /** Rotation of the weave, in radians. */
    weaveAngle: number;
    stretchAniso: number;
    falloff: number;
    tension: number;
    specPower: number;
    specIntensity: number;
    specAniso: number;
    specColor: string;
    diffuseWrap: number;
    ambient: number;
    keyIntensity: number;
    fillIntensity: number;
    thinning: number;
    ridgeIntensity: number;
    ridgeFrequency: number;
    /** Grazing angle sheen. The main thing separating cloth from plastic. */
    sheenIntensity: number;
    sheenPower: number;
    sheenColor: string;
    /** Sequin only. Spread of the per disc random tilt, and the dome across one. */
    sequinTilt: number;
    sequinDome: number;
}
