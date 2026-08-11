import { useEffect, useRef } from 'react';
import { folder, useControls } from 'leva';
import { DEFAULT_ACCENT, PRESETS } from './presets';

const spandex = PRESETS.spandex;

/**
 * The live debug panel.
 *
 * Selecting a material preset pushes a whole set of values back into the panel
 * rather than hiding them, so every number stays inspectable and tweakable
 * after the switch.
 */
export function useFabricControls() {
    const [values, set] = useControls(() => ({
        Material: folder({
            preset: { value: 'spandex', options: ['spandex', 'carbon'] },
            baseColor: spandex.baseColor,
            accentColor: DEFAULT_ACCENT,
            weaveScale: { value: spandex.weaveScale, min: 4, max: 140, step: 0.5 },
            weaveIntensity: { value: spandex.weaveIntensity, min: 0, max: 0.8, step: 0.005 },
            stretchAnisotropy: { value: spandex.stretchAniso, min: 0, max: 0.95, step: 0.01 },
            ridgeIntensity: { value: spandex.ridgeIntensity, min: 0, max: 1.2, step: 0.01 },
            ridgeFrequency: { value: spandex.ridgeFrequency, min: 4, max: 90, step: 1 },
            thinning: { value: spandex.thinning, min: 0, max: 2, step: 0.01 },
            specPower: { value: spandex.specPower, min: 2, max: 80, step: 1 },
            specIntensity: { value: spandex.specIntensity, min: 0, max: 1.5, step: 0.01 },
        }),

        Shape: folder({
            elevation: { value: 0.32, min: 0.02, max: 0.6, step: 0.005 },
            shapeWidth: { value: 1.51, min: 0.4, max: 1.7, step: 0.01 },
            shapeHeight: { value: 0.16, min: 0.06, max: 0.32, step: 0.005 },
            cornerRadius: { value: 0.08, min: 0, max: 0.32, step: 0.005 },
            falloff: { value: spandex.falloff, min: 0.02, max: 0.3, step: 0.005 },
            tension: { value: spandex.tension, min: 0, max: 1, step: 0.01 },
        }),

        Motion: folder({
            springFrequency: { value: 18.5, min: 3, max: 40, step: 0.5 },
            springDamping: { value: 0.47, min: 0.15, max: 1.2, step: 0.01 },
            pointerDimple: true,
        }),

        Scene: folder({
            lightPosition: { value: [-4.6, 4.4, 2.6] as [number, number, number], step: 0.1 },
            cameraTilt: { value: 15, min: 0, max: 50, step: 1 },
            showTray: false,
        }),
    }));

    // leva widens a select's value to string, so narrow it back here.
    const preset: PresetName = values.preset === 'carbon' ? 'carbon' : 'spandex';
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
            falloff: p.falloff,
            tension: p.tension,
        });
    }, [preset, set]);

    return { ...values, preset };
}

export type PresetName = 'spandex' | 'carbon';
export type FabricControls = ReturnType<typeof useFabricControls>;
