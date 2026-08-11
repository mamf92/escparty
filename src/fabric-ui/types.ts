/** Interaction states an option can be in, in the order the design table lists them. */
export type OptionState =
    | 'idle'
    | 'hover'
    | 'pressed'
    | 'selected'
    | 'correct'
    | 'incorrect';

export type FabricShape = 'rect' | 'circle';

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
}

/** Screen space rectangle of a feature plateau, used to place the DOM overlay. */
export interface ProjectedRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MaterialPreset {
    baseColor: string;
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
}
