# Fabric UI

A proof of concept for a UI style where interface elements push up through, or sink down into, a taut sheet of elastic fabric.
It is adjacent to neumorphism, but the surface is a stretched membrane rather than a moulded plastic panel.
The sheet shows tension ridges sloping from each shape's edge down to a flat base plane, the weave visibly thins and spreads where the material is pulled, and it responds elastically to press and release.

This is a prototype, not a production component library.

## What it reimplements

The **answer option list** from the ESCParty quiz: `OptionsContainer` and `OptionButton` in `src/components/Quiz.tsx`.

That component was picked because it exercises the full state range, and because its real props map one to one onto the elevation table below.

| Real prop in `Quiz.tsx` | Demo state |
| --- | --- |
| default | idle |
| pointer over, or keyboard focus | hover |
| pointer held down | pressed |
| `$isSelected` | selected |
| `$isCorrect` | correct |
| `$isWrong` | incorrect |

Content is real.
Questions load through the app's own `loadQuizData('easy')` from `src/utils/QuizDataProvider.ts`, so the demo shows the same Eurovision questions the app does.
Colours derive from `src/styles/theme.ts` rather than being invented.

## Running it

```bash
npm install
npm run dev
```

Then open `http://localhost:5173/#/fabric-ui`.

There is nothing to install beyond the repo's own dependencies.
The route is lazy loaded, so `three`, `@react-three/fiber` and `leva` stay out of the app's main bundle and only this page pays for them.

Click an option, then Submit answer, to see selected, correct and incorrect.
Tab, Enter and Space operate the options with a visible focus ring.
Hold the pointer down anywhere on the sheet and drag to see the local pointer dimple.

## How it works

The fabric is **not** simulated.
There is no mass spring system, no Verlet integration, no cloth solver.
The sheet is always taut and pinned at its edges, and it is deformed only by shapes whose position and size are known in advance, so a solver would be expensive, would settle unpredictably, and would never produce the crisp flat plateau the design needs.

Instead the fabric is a displaced height field evaluated analytically in a shader.

1. A single `PlaneGeometry` at 192 by 192 segments, rendered with a custom `ShaderMaterial`.
2. A `features` array in TypeScript describes every element on the sheet, and is uploaded as uniform arrays with a fixed `MAX_FEATURES` of 8.
3. Height at a point is the accumulation of each feature's profile against its signed distance function.
   Elevation is signed, which is what lets a selected answer read as pressed in while its neighbours stay raised.
4. The vertex shader displaces along the surface normal for silhouette.
   The fragment shader re-evaluates the same height function at four small offsets to derive per pixel normals, which keeps the slope smooth without raising tessellation.

The slope profile is a linear ramp with soft knees at both ends, built from a smooth maximum against 0 and a smooth minimum against 1.
The knee width is what `tension` drives: wide knees give a soft rubbery S curve, narrow knees give a near straight slope with sharp shoulders.

Positive and negative contributions accumulate separately, so a raised option inside a sunken tray rests on the tray floor instead of cancelling against it.
Within each sign a smooth maximum stops two adjacent options from stacking into one tall mound.

Text is never rendered into the surface.
A DOM overlay of real `<button>` elements sits above the canvas, positioned each frame from the orthographic camera's projection of each plateau.
The DOM layer owns interaction and state, and the shader renders that state.
This gives crisp type, a working tab order, screen reader support, and no raycasting hit test logic.

Per feature, an independent critically underdamped spring drives current elevation toward target elevation.
Release is never tweened, since an ease-out lands dead and reads as a plastic button.

### Files

| File | Role |
| --- | --- |
| `shader/field.glsl.ts` | The height field, shared verbatim by both shader stages |
| `shader/fabricMaterial.ts` | Vertex and fragment shaders: lighting, weave, stretch, ridges |
| `FabricSurface.tsx` | Springs, uniform uploads, plateau projection for the overlay |
| `FabricQuizDemo.tsx` | Quiz logic, DOM overlay, page chrome |
| `CameraRig.tsx` | Orthographic camera fit and tilt |
| `constants.ts` | Layout of the sheet and the state to elevation table |
| `presets.ts` | The two material presets, derived from the app's tokens |
| `springs.ts` | Second order spring integration and the incorrect shake |

## The leva panel

### Material

| Control | What it does |
| --- | --- |
| `preset` | Switches between spandex and carbon fibre. Pushes a whole set of values back into the panel rather than hiding them, so everything stays tweakable after the switch. |
| `baseColor` | Colour of the undisturbed sheet. |
| `accentColor` | Colour of a correct answer's plateau. |
| `weaveScale` | Thread crossings per plane unit. Higher is a finer knit. Above roughly 40 the weave starts to alias on a 560px canvas. |
| `weaveIntensity` | Depth of the weave's normal perturbation. |
| `stretchAnisotropy` | How much the weave spreads along the direction of stretch. At 0 the threads keep an even grid across the slope, which reads as printed fabric rather than woven. Roughly, thread spacing in the slope band grows by `1 / (1 - stretchAnisotropy)`. |
| `ridgeIntensity` | Strength of the tension ridges that run down the slope. |
| `ridgeFrequency` | How many ridges per plane unit. |
| `thinning` | How much the sheet lightens, brightens its specular, and shallows its weave at maximum stretch. Subtle by design. |
| `specPower` | Tightness of the specular lobe. Low is a broad soft sheen, high is a narrow glint. |
| `specIntensity` | Strength of the specular. |

### Shape

| Control | What it does |
| --- | --- |
| `elevation` | Resting height of an idle option. Every other state is a multiple of this, so raising it scales the whole state table. |
| `shapeWidth`, `shapeHeight` | Half extents of an option's plateau. |
| `cornerRadius` | Corner radius of the rounded rectangle SDF. |
| `falloff` | Width of the slope band. Keep it well under `shapeHeight` or the slope eats the plateau and the shape becomes a dome. |
| `tension` | Blends the slope profile from a soft S curve at 0 to a near straight ramp with tight knees at 1. This is the control that decides whether the sheet reads as gel or as fabric. |

### Motion

| Control | What it does |
| --- | --- |
| `springFrequency` | Angular frequency of the elevation spring, in radians per second. |
| `springDamping` | Damping ratio. Below 1 the release overshoots once, which is what sells the elasticity. At 1 or above it settles flat. |
| `pointerDimple` | Whether holding the pointer down adds a local dimple that follows the cursor. It sums on top of the field rather than joining the signed accumulation, so it deforms whatever it is dragged across. |

### Scene

| Control | What it does |
| --- | --- |
| `lightPosition` | World position of the key light. Moving it toward one axis makes that thread direction dominate the weave. |
| `cameraTilt` | Degrees away from looking straight down the sheet's normal. At 0 the slopes are hard to read. |
| `showTray` | Whether the options sit inside a permanently sunken well. |

## Deliberate deviations from the brief

- **`@react-three/drei` is not installed.**
  With a custom `ShaderMaterial` and a manually fitted orthographic camera, not one symbol from it would be imported.
- **The demo has no countdown timer**, unlike the real component, which auto advances after 10 seconds.
  A timer would make the states impossible to inspect by hand.
- **Lights are shader uniforms, not r3f light nodes.**
  A raw `ShaderMaterial` does not consume three's light uniforms.
  `lightPosition` is still exposed in leva.
- **The correct state uses `accentmint` rather than the app's `accentgreen`.**
  `#007542` is dark enough that a lit membrane loses all its slope shading under it.

## Performance

The fragment shader evaluates the height function five times per pixel, over a bounded loop of 8 features.
Device pixel ratio is capped at 1.75 and the plane subdivision is kept to what smooth displacement actually needs.
Inactive feature slots take a uniform branch, which is coherent across the whole draw.
