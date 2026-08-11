import { theme } from '../styles/theme';
import type { MaterialPreset } from './types';

/**
 * Both presets take their colours from the app's existing token set rather than
 * inventing a palette, so the concept can sit next to the current quiz screen.
 */
export const PRESETS: Record<'spandex' | 'carbon', MaterialPreset> = {
    /**
     * Loose knit stretch fabric. Broad soft specular, fine knit, generous
     * falloff, high stretch response.
     */
    spandex: {
        baseColor: theme.colors.amethyst, // #A56DC6
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
    },
};

/**
 * State colours, matching the existing OptionButton in src/components/Quiz.tsx.
 *
 * The one substitution is the correct state. The app uses accentgreen
 * (#007542), which is dark enough that it loses the slope shading entirely on a
 * lit membrane, so the demo uses the token set's bright accent instead.
 */
export const STATE_TINT = {
    selected: theme.colors.pinkLavender, // #D5B8E6, as in the app
    correct: theme.colors.accentmint, // #7AF5BF
    incorrect: theme.colors.incorrectRed, // #dc3545
} as const;

export const DEFAULT_ACCENT = STATE_TINT.correct;
