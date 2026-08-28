# Reference — ESCParty Sparkle

Captured 2026-08-28 from the live app at commit `f82f676`, route `/#/fabric-ui`, screen `quiz`, sparkle mode (opt-in, reached via the "Make it sparkle" toggle).

| File | What it shows |
| --- | --- |
| `sparkle-quiz-idle.png` | **The canonical reference.** The sequin membrane at rest with four plates raised out of it. Attach this one. |
| `sparkle-parallax-topleft.png` | Pointer driven to the top-left corner. |
| `sparkle-parallax-bottomright.png` | Pointer driven to the bottom-right corner. |

The two parallax frames are a **matched pair** and should be used together whenever the question is about motion rather than appearance. A single still of this surface is misleading: at rest the camera is dead-on, so a still shows none of the depth that arrives when the sheet tilts. The pair is the closest a static reference gets to showing what the style actually does.

Capture conditions: headless Chromium with SwiftShader software rendering, 900x1400 viewport, `deviceScaleFactor` 2. The canvas is 560x560 CSS at a `dpr` capped to 1.75, giving a 980x980 drawing buffer.

**Colour and coverage from these captures are trustworthy. Timing is not.** SwiftShader is a software rasteriser, so nothing about frame rate or GPU cost can be read from them, and none is recorded as measured anywhere in `dna.json`.

## Source of truth

The reference images are evidence. The style itself lives in:

- `src/fabric-ui/presets.ts` — the `sequin` preset, including the `sheenIntensity: 0` that is the weird move.
- `src/fabric-ui/useFabricControls.ts` — `MODES.sparkle`, and the rule that a system reduced-motion preference outranks the switch.
- `src/fabric-ui/shader/fabricMaterial.ts` and `field.glsl.ts` — the surface model and the height field.
- `src/fabric-ui/constants.ts` — layout and the state-to-elevation table.
- `src/fabric-ui/CameraRig.tsx` and `useParallax.ts` — the dead-on rest pose and the chase.

If any of those change, re-capture and re-run the reconstruct-and-diff step rather than editing `dna.json` by hand.
