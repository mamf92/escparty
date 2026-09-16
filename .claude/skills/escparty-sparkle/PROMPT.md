# ESCParty Sparkle

**Reference: `reference/sparkle-quiz-idle.png` — attach it.**

**A magenta sequin sheet, dead flat to the eye until you move it, when a few hundred discs catch one light and the whole surface tilts.**

**The one break in the system:** the sequin surface sets **sheen to exactly zero** — the term this material system calls the thing separating cloth from plastic (spandex 0.55, felt 0.85). Sequins are hard discs, not fibres. Restore the sheen and the sheet becomes glittery velvet: softer, and no longer this style. It will look like an oversight. It is not.

## Moves
1. Specular is the material: intensity 1.5 (8.3x the knit preset), 50-power lobe.
2. Under 1% is actually glitter; measured 0.4-0.5%.
3. Dead-on at rest: tilt/yaw 0, all depth from motion.
4. Pressed sits 1.59x deeper than selected; one bounce on release.
5. Signed continuous elevation, +1.6x to -1.05x.

## Never
- Parallax under OS reduced motion, ever.
- Restore sheen.
- Tint a plate. Shape says raised/pressed, colour says right/wrong.
- A resting camera tilt or yaw.
- Snap the camera; chase +/-20 deg at 6/s so it lags and has mass.
- Pressed shallower than selected.
- Elevation quantised.
- A baked normal map.
- A marker stroke thinner than the slope band.
- Sparkle as the landing state.

## Palette, type, layouts
Sheet #C04BF2 ~93%. White glitter ~0.5%. Type #EEE8F0 ~0.9%. #28a745/#dc3545 ~0.02% each, gutter glyphs only. #FF9F1D toggle only. Open Sans 13.6/700 over 11.2/400.
Layouts: `prompt-and-options`, `labelled-choice-list`, `ranked-ladder`.

## Self-check
- [ ] HSV value 0.52-0.64, sat 0.70 +/-0.05
- [ ] Near-white 0.3-1.0%
- [ ] sheenIntensity exactly 0
- [ ] At rest tilt/yaw 0, no shear
- [ ] Pressed 1.4-1.8x deeper than selected
- [ ] Reduced motion: parallax off
- [ ] Squint at 3m: glittering, not flat

Before returning any output, run every test in the self-check. Name each test and its result. If any fails, repair the output and run them again. Never return output with a failing test and a note explaining it away.
