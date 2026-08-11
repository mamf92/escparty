# Fabric UI: Claude Code prompt

Paste everything below into Claude Code, run in the target repo.

---

## Goal

Build a standalone interactive demo called **Fabric UI**, a proof of concept for a UI style where interface elements push up through, or sink down into, a taut sheet of elastic fabric (spandex, or a stiffer carbon fiber weave) rather than sitting on a flat surface. It is adjacent to neumorphism, but the surface is a stretched membrane: it shows tension ridges sloping from each shape's edge down to a flat base plane, the weave visibly thins and spreads where the material is pulled, and it responds elastically to press and release.

The end state is a redesign concept for the quiz UI already in this repo. The deliverable is one real component from that app, rebuilt in this style, running in a dev server.

This is a prototype, not a production component library. Prioritize one shape that looks and feels genuinely right over a general API that looks mediocre everywhere.

---

## Phase 0: explore this repo first, then report back before writing code

1. Find the quiz UI. Identify the main interactive components: question card, answer option list, progress indicator, submit or next control, result or feedback state.
2. Pick **one** component to rebuild as the showcase. Prefer the answer option list, because it exercises the full state range: idle raised, hover, pressed, selected, correct, incorrect. If something else in this repo is a better fit, argue for it.
3. Note the component's real props, states and copy. The demo should use real content from the app, not lorem ipsum.
4. Note the existing design tokens: colors, type scale, radii, spacing. The fabric palette should derive from them, not be invented from scratch.
5. Report: which component, which states, which tokens, and whether this repo already has a React and Vite setup worth reusing.

Do not start Phase 1 until this summary is delivered.

---

## Tech stack

- React + TypeScript
- Vite dev server. Create a fresh app in a subfolder, `fabric-ui-demo/`, unless the repo already has a suitable React and Vite setup, in which case add to it.
- `@react-three/fiber` and `@react-three/drei` for the WebGL layer
- `leva` for a live debug panel
- Existing repo styling system for the DOM overlay layer if there is one, otherwise plain CSS modules. Do not add Tailwind if the repo does not already use it.

Suggested dependency floor, adjust upward to current versions:

```json
{
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "three": "^0.169.0",
  "@react-three/fiber": "^8.17.0",
  "@react-three/drei": "^9.114.0",
  "leva": "^0.9.35",
  "typescript": "^5.5.0",
  "vite": "^5.4.0"
}
```

Explicitly **not** used: `@react-three/cannon`, `@react-three/rapier`, any soft body or cloth solver, any CSS box-shadow neumorphism fallback.

---

## Core technique: read this fully before implementing

### Do not simulate cloth

No mass-spring systems, no Verlet integration, no XPBD, no particle grids with distance constraints, no collision. That is the wrong tool. The fabric here is always taut and pinned at its edges, and it is deformed only locally by shapes whose position and size are known in advance. A solver would be expensive, would settle unpredictably, would never produce the crisp flat plateau the design needs, and would make the press interaction feel mushy instead of snappy.

Instead the fabric is a **displaced height field evaluated analytically in a shader**.

### Structure

1. A single `PlaneGeometry` at roughly 192x192 segments, rendered with a custom `ShaderMaterial`.
2. A `features` array in TypeScript describing every UI element on the sheet: center, size, corner radius, shape type, target elevation, falloff width, tension. Uploaded to the shader as uniform arrays with a fixed `MAX_FEATURES` of 8.
3. Height at any point is the accumulation of each feature's contribution. **Elevation is signed.** Positive raises the shape into a protrusion, negative sinks it into an indent. This is what lets a selected answer read as pressed in while its neighbors stay raised.
4. The vertex shader displaces along the surface normal for silhouette. The fragment shader re-evaluates the same height function at four small offsets to derive per pixel normals via finite differences. Deriving normals per fragment rather than per vertex is what keeps the slope smooth without pushing the tessellation higher.

### Shape profile

Use a signed distance function per shape, rounded rect and circle to start. Given the SDF value `d`, negative inside:

- `d < -falloff`: flat plateau, contribution is the full elevation
- `-falloff < d < 0`: the slope band
- `d > 0`: flat base plane, contribution is zero

The profile across the slope band is the single most important curve in this project. A plain `smoothstep` reads as rubber or gel. Taut fabric has a nearly straight slope with tight knees at both ends, closer to a stretched catenary than an S curve. Add a `tension` parameter, 0 to 1, that blends the profile from a soft `smoothstep` at low tension toward a near linear ramp with sharp shoulders at high tension. Expose it in leva and make sure moving it visibly changes how tight the sheet reads.

Where features overlap, use a smooth maximum rather than a plain sum so two adjacent buttons do not stack into a single tall mound.

### Fabric shading

Lighting is Blinn-Phong style with a soft, wide specular lobe, not a glassy one. On top of that:

- **Weave normal perturbation.** A cheap procedural weave applied everywhere, including the undisturbed base plane, so the flat regions never read as bare plastic.
- **Anisotropic weave stretch.** Compute the height field gradient. In the slope band, scale the weave sampling coordinates anisotropically along the gradient direction so the threads visibly spread apart where the material is pulled. This is the physically correct cue and it is the single detail that most separates fabric from a soft plastic blob. Do not skip it.
- **Tension ridges.** A secondary noise pattern, radial or angular around the feature center, masked by the normalized gradient magnitude so it appears only where the slope is steepest, and fades to nothing on both the plateau and the base plane. These are a shading effect layered on geometry, not a separate simulation.
- **Thinning response.** At maximum stretch, raise specular intensity slightly and lighten the base color slightly, to sell material pulled thin. Keep it subtle. If it is obvious in a screenshot it is too strong.

### Material presets

Ship two, switchable from leva:

- **Spandex**: mid saturation base color from the repo's tokens, broad soft specular, fine knit weave, high stretch response, generous falloff.
- **Carbon fiber**: near black base, 2x2 twill weave pattern, tight anisotropic highlight aligned to the weave direction, much lower stretch response, narrow falloff so shapes read as stiffer and more mechanical.

---

## Labels, text and accessibility

Do not render quiz text as 3D geometry inside the fabric surface. Text on a displaced membrane is unreadable and drei's `Text` will fight the lighting.

Instead:

1. Use a static **orthographic** camera at a slight tilt, not straight top down, so the slope and highlights are visible. Orthographic keeps the screen space mapping from fabric coordinates to pixels a fixed affine transform, which makes the overlay trivial.
2. Layer a DOM overlay above the canvas containing real, focusable `<button>` elements positioned over each feature's plateau. Transparent background, real text, real focus rings, real keyboard handling.
3. The DOM layer owns interaction and state. The shader is a renderer of that state. Pointer and keyboard events on the DOM buttons drive the feature array, which drives the uniforms.

This gets crisp type, working tab order, screen reader support and no raycasting hit test logic, all at once. If a DOM overlay proves unworkable, fall back to r3f pointer events on the plane plus a JS mirror of the SDF, but try the overlay first.

---

## Interaction and motion

Per feature, an independent spring drives current elevation toward target elevation. Implement a critically underdamped spring in `useFrame`, or use `@react-spring/three`. Starting values: angular frequency around 14 rad/s, damping ratio around 0.55, so release settles with one small visible overshoot.

Do not use linear or ease-in-out tweening for release. This is the single most important detail for reading as fabric rather than as a plastic button.

State to elevation mapping for the quiz component:

| State | Target |
| --- | --- |
| Idle | resting elevation, roughly 0.15 units |
| Hover | resting plus a small lift, roughly 0.19 |
| Pressed | negative, a clear concave dimple, roughly -0.08 |
| Selected | held shallow indent, roughly -0.04, plus color shift |
| Correct | overshoot up to roughly 0.24 with a bright accent, then settle |
| Incorrect | deeper dimple, roughly -0.12, with a short horizontal shake on the feature center |

Optional stretch goal, only after the core feels right: while pressed, the pointer position adds a small secondary local dimple near the cursor, additive to and distinct from the button's own dimple, so dragging across the pressed fabric shows independent local deformation.

---

## Build order, with a working state at every checkpoint

**Phase 1: scaffold.** Vite, React, TypeScript, r3f. A `<Canvas>` with one key light and one soft fill, a flat plane with a solid material, orthographic camera at a slight tilt. Confirm it renders and hot reloads.

**Phase 2: static bump.** Custom shader material. One static, non interactive raised rounded rect using SDF plus profile, correct per fragment normals, basic lighting. Goal: it reads as a stretched membrane, not as a hard extruded box and not as a soft neumorphic blob.

**Phase 3: material feel.** Weave perturbation, anisotropic stretch, slope masked tension ridges, thinning response, both material presets. Add the full leva panel. Spend real time here. This phase decides whether the whole idea works.

**Phase 4: interactivity.** DOM overlay, per feature springs, the full state table above with one button.

**Phase 5: the real component.** Generalize the feature array to the component chosen in Phase 0. Render the actual answer options with actual copy, correct quiz logic, and indented selected states alongside raised unselected ones.

**Phase 6, optional.** Extra shapes: circle for a progress dot, wide rounded rect for a submit control, a permanently indented tray or well that other elements sit inside.

---

## Acceptance criteria

Phase 3 is done when:

- The raised shape has a visibly flat plateau on top, not a rounded dome.
- There is a continuous slope from plateau edge to base plane with shading that reads as taut fabric, with subtle highlight banding rather than a flat gradient.
- The weave texture is present and consistent across the entire surface including the undisturbed base plane.
- The weave visibly spreads along the direction of stretch in the slope band.
- Moving the leva tension and falloff controls changes tight versus loose smoothly and obviously.
- Switching to carbon fiber produces a clearly different, stiffer material, not just a color change.

The demo is done when:

- `npm install && npm run dev` produces a running demo with zero console errors and zero TypeScript errors.
- A real component from this repo's quiz UI is rendered in the new style with real content.
- Every state in the table above is reachable and visually distinct.
- Tab, Enter and Space operate the options correctly with a visible focus indicator.
- The leva panel exposes: elevation, shape size, corner radius, falloff width, tension, ridge intensity, weave scale, weave intensity, stretch anisotropy, base color, accent color, light position, material preset, spring frequency, spring damping.

---

## Constraints

- 60fps on a mid tier laptop with integrated graphics. The fragment shader does several height evaluations per pixel, so keep the height function cheap, keep the feature loop bounded and unrolled, and do not raise plane subdivision beyond what smooth displacement actually needs. Profile before adding detail.
- No em dashes anywhere: code, comments, UI copy, commit messages, docs.
- No AI or agent tool names in commit messages.
- Each sentence on its own line in any long Markdown file you write.
- Keep the demo self contained in its own folder so the rest of the repo is undisturbed.
- Add a short `README.md` in the demo folder covering how to run it, what the leva parameters do, and which repo component it reimplements.
