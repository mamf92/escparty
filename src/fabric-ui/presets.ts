import { theme } from '../styles/theme';
import type { MaterialPreset } from './types';

export type PresetName = 'spandex' | 'felt' | 'sequin' | 'carbon';

export const PRESET_NAMES: PresetName[] = ['spandex', 'felt', 'sequin', 'carbon'];

/**
 * All four take their colours from the app's existing token set rather than
 * inventing a palette, so the concept can sit next to the current quiz screen.
 *
 * `sheenIntensity` is the field worth reading first. Fibres standing off a
 * surface scatter light back at grazing angles, which is why cloth carries a
 * soft rim that moulded plastic never does. Set it to zero on any of these and
 * they collapse into vacuum formed plastic, whatever the weave is doing.
 */
export const PRESETS: Record<PresetName, MaterialPreset> = {
    /**
     * Loose knit stretch fabric. Broad soft specular, fine knit, high stretch
     * response.
     */
    spandex: {
        baseColor: theme.colors.amethyst, // #A56DC6
        surface: 'woven',
        weaveScale: 60,
        weaveIntensity: 0.08,
        twill: 0,
        weaveAngle: 0,
        stretchAniso: 0.17,
        falloff: 0.065,
        tension: 0.78,
        specPower: 30,
        specIntensity: 0.18,
        specAniso: 0,
        specColor: theme.colors.magnolia, // #EEE8F0
        diffuseWrap: 0.5,
        ambient: 0.2,
        keyIntensity: 0.62,
        fillIntensity: 0.18,
        thinning: 0,
        ridgeIntensity: 0.2,
        ridgeFrequency: 4,
        sheenIntensity: 0.55,
        sheenPower: 2.6,
        sheenColor: theme.colors.pinkLavender, // #D5B8E6
        sequinTilt: 0,
        sequinDome: 0,
    },

    /**
     * Pressed wool felt. No weave at all, since felt is matted fibre rather
     * than an ordered thread structure. Almost no specular, a very wide
     * terminator, and the sheen doing nearly all of the work.
     */
    felt: {
        baseColor: '#7C4E97', // amethyst pulled toward darkpurple
        surface: 'felt',
        weaveScale: 210,
        weaveIntensity: 0.22,
        twill: 0,
        weaveAngle: 0,
        stretchAniso: 0.1,
        falloff: 0.085,
        tension: 0.42,
        specPower: 6,
        specIntensity: 0.03,
        specAniso: 0,
        specColor: theme.colors.magnolia,
        diffuseWrap: 0.75,
        ambient: 0.26,
        keyIntensity: 0.6,
        fillIntensity: 0.24,
        thinning: 0.15,
        ridgeIntensity: 0.12,
        ridgeFrequency: 8,
        sheenIntensity: 0.85,
        sheenPower: 1.9,
        sheenColor: '#C9A8DC',
        sequinTilt: 0,
        sequinDome: 0,
    },

    /**
     * Sequins. An offset grid of discs, each at its own angle, so one light
     * source lands on a scattered few at a time and the surface glitters as
     * the sheet or the camera moves.
     */
    sequin: {
        baseColor: theme.colors.brightpurple, // #C04BF2
        surface: 'sequin',
        weaveScale: 20,
        weaveIntensity: 1.5,
        twill: 0,
        weaveAngle: 0,
        stretchAniso: 0.05,
        falloff: 0.07,
        tension: 0.8,
        specPower: 46,
        specIntensity: 1.5,
        specAniso: 0,
        specColor: '#FFFFFF',
        diffuseWrap: 0.4,
        ambient: 0.16,
        keyIntensity: 0.5,
        fillIntensity: 0.16,
        thinning: 0.2,
        ridgeIntensity: 0.1,
        ridgeFrequency: 6,
        sheenIntensity: 0.3,
        sheenPower: 3.2,
        sheenColor: theme.colors.accentorange, // #FF9F1D
        sequinTilt: 1.7,
        sequinDome: 0.5,
    },

    /**
     * Woven carbon. Stiffer in every respect: narrow falloff, near linear
     * profile, low stretch response, and a tight highlight aligned to the warp
     * instead of a broad lobe.
     *
     * The base is the night token lifted a few points. Pure #141516 under this
     * little ambient light collapses to black and takes the twill relief with
     * it, which loses the point of the preset.
     */
    carbon: {
        baseColor: '#1E1F26',
        surface: 'woven',
        weaveScale: 20,
        weaveIntensity: 0.3,
        twill: 1,
        weaveAngle: Math.PI / 4,
        stretchAniso: 0.16,
        falloff: 0.045,
        tension: 0.96,
        specPower: 40,
        specIntensity: 0.5,
        specAniso: 0.6,
        specColor: '#BFC6D6',
        diffuseWrap: 0.12,
        ambient: 0.42,
        keyIntensity: 0.95,
        fillIntensity: 0.3,
        thinning: 0.25,
        ridgeIntensity: 0.16,
        ridgeFrequency: 62,
        sheenIntensity: 0.12,
        sheenPower: 4.0,
        sheenColor: '#8FA0C0',
        sequinTilt: 0,
        sequinDome: 0,
    },
};

/** Must match the surface dispatch order in the fragment shader. */
export const SURFACE_INDEX: Record<MaterialPreset['surface'], number> = {
    woven: 0,
    felt: 1,
    sequin: 2,
};

/**
 * Marker colours.
 *
 * The option rows themselves are never tinted. Everything about an option's
 * state is carried by its shape: raised at rest, pressed into the sheet when
 * held. Correctness is called out by a separate glyph in the left gutter, so
 * the two signals never compete.
 *
 * correctGreen was already defined in the theme and unused by the app, which
 * uses the much darker accentgreen. It is the cleaner of the two here.
 */
export const MARKER_COLOR = {
    correct: theme.colors.correctGreen, // #28a745
    wrong: theme.colors.incorrectRed, // #dc3545
} as const;
