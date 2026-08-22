import { useCallback, useEffect, useRef, useState } from 'react';
import { folder, useControls } from 'leva';
import { MARKER_COLOR, PRESETS, PRESET_NAMES, type PresetName } from './presets';

const spandex = PRESETS.spandex;

/**
 * The two modes the demo ships.
 *
 * Sparkle is opt in, and not because it is merely the fancier option. Parallax
 * is viewport coupled motion, which is exactly what makes motion sensitive
 * people ill, and the operating system already publishes that preference
 * through prefers-reduced-motion. So the calm mode is what everyone lands on,
 * and a system level reduced motion setting outranks the switch entirely.
 */
const MODES = {
    calm: {
        preset: 'felt' as PresetName,
        parallax: false,
        parallaxStrength: 9,
        cameraTilt: 13,
        cameraYaw: 7,
        springDamping: 0.78,
        topShade: 0.22,
    },
    sparkle: {
        preset: 'sequin' as PresetName,
        parallax: true,
        parallaxStrength: 20,
        cameraTilt: 0,
        cameraYaw: 0,
        springDamping: 0.47,
        topShade: 0.26,
    },
} as const;

function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The live debug panel.
 *
 * Selecting a material preset, or flipping the sparkle switch, pushes a whole
 * set of values back into the panel rather than hiding them, so every number
 * stays inspectable and tweakable after the switch.
 */
export function useFabricControls() {
    const [sparkle, setSparkleState] = useState(false);
    const reduced = useRef(prefersReducedMotion());

    const [values, set] = useControls(() => ({
        Material: folder({
            preset: { value: 'felt', options: PRESET_NAMES },
            baseColor: spandex.baseColor,
            accentColor: MARKER_COLOR.correct,
            wrongColor: MARKER_COLOR.wrong,
            weaveScale: { value: spandex.weaveScale, min: 4, max: 140, step: 0.5 },
            weaveIntensity: { value: spandex.weaveIntensity, min: 0, max: 2, step: 0.005 },
            stretchAnisotropy: { value: spandex.stretchAniso, min: 0, max: 0.95, step: 0.01 },
            ridgeIntensity: { value: spandex.ridgeIntensity, min: 0, max: 1.2, step: 0.01 },
            ridgeFrequency: { value: spandex.ridgeFrequency, min: 4, max: 90, step: 1 },
            thinning: { value: spandex.thinning, min: 0, max: 2, step: 0.01 },
            specPower: { value: spandex.specPower, min: 2, max: 80, step: 1 },
            specIntensity: { value: spandex.specIntensity, min: 0, max: 2, step: 0.01 },
            sheen: { value: spandex.sheenIntensity, min: 0, max: 1.5, step: 0.01 },
        }),

        Shape: folder({
            elevation: { value: 0.3, min: 0.02, max: 0.6, step: 0.005 },
            shapeWidth: { value: 1.51, min: 0.4, max: 1.7, step: 0.01 },
            shapeHeight: { value: 0.17, min: 0.06, max: 0.32, step: 0.005 },
            cornerRadius: { value: 0.08, min: 0, max: 0.32, step: 0.005 },
            falloff: { value: spandex.falloff, min: 0.02, max: 0.3, step: 0.005 },
            tension: { value: spandex.tension, min: 0, max: 1, step: 0.01 },
            topShade: { value: 0.22, min: 0, max: 0.5, step: 0.005 },
        }),

        Motion: folder({
            springFrequency: { value: 18.5, min: 3, max: 40, step: 0.5 },
            springDamping: { value: 0.78, min: 0.15, max: 1.2, step: 0.01 },
        }),

        Scene: folder({
            lightPosition: { value: [-4.6, 4.4, 2.6] as [number, number, number], step: 0.1 },
            cameraTilt: { value: 13, min: 0, max: 35, step: 1 },
            cameraYaw: { value: 7, min: -35, max: 35, step: 1 },
            parallax: false,
            parallaxStrength: { value: 9, min: 0, max: 25, step: 0.5 },
        }),
    }));

    // leva widens a select's value to string, so narrow it back here.
    const preset: PresetName = (PRESET_NAMES as string[]).includes(values.preset)
        ? (values.preset as PresetName)
        : 'felt';

    const applied = useRef<PresetName | null>(null);

    useEffect(() => {
        if (applied.current === preset) return;
        applied.current = preset;

        const p = PRESETS[preset];
        set({
            baseColor: p.baseColor,
            weaveScale: p.weaveScale,
            weaveIntensity: p.weaveIntensity,
            stretchAnisotropy: p.stretchAniso,
            ridgeIntensity: p.ridgeIntensity,
            ridgeFrequency: p.ridgeFrequency,
            thinning: p.thinning,
            specPower: p.specPower,
            specIntensity: p.specIntensity,
            sheen: p.sheenIntensity,
            falloff: p.falloff,
            tension: p.tension,
        });
    }, [preset, set]);

    const setSparkle = useCallback(
        (on: boolean) => {
            const mode = MODES[on ? 'sparkle' : 'calm'];
            setSparkleState(on);
            applied.current = null; // let the preset effect push the material through
            set({
                preset: mode.preset,
                // A system level reduced motion preference outranks the switch.
                parallax: mode.parallax && !reduced.current,
                parallaxStrength: mode.parallaxStrength,
                cameraTilt: mode.cameraTilt,
                cameraYaw: mode.cameraYaw,
                springDamping: mode.springDamping,
                topShade: mode.topShade,
            });
        },
        [set],
    );

    return { values: { ...values, preset, sparkle }, setSparkle };
}

export type FabricControls = ReturnType<typeof useFabricControls>['values'];
