# Design references

The boards the Bobby Socks design was chosen from, kept so a later change
to the look can start from them instead of from scratch. They are
references, not rules: `docs/design/design-system.md` is the rulebook, and
`src/design/` is what ships.

The live canvas, with all four boards side by side:
https://claude.ai/artifact/EDS4mmDKv2e1Mrc9KT3rCE

| File | Board | Status |
| --- | --- | --- |
| `calm.dc.html` | Calm (chosen) | Shipped: the dark pink stage, white cards, dark tiles, a still disco ball in muted pinks |
| `sparkle.dc.html` | Sparkle (chosen) | Shipped: the same screen on pink sequins, with a turning white and light pink ball whose spots sweep left to right |
| `pearl-neumorphism.dc.html` | Reference · Pearl neumorphism | Study: soft raised and pressed blush on white. Its depth is what the inside of a card uses today |
| `flat-pleats.dc.html` | Reference · Flat pleats | Study: flat black, white and pink blocks after the costumes' pleated skirts, no shadows |

Each board draws the "Build a quiz" screen, the one with the most kinds of
control on it. The files are design-canvas sources: they load the
canvas's `support.js` runtime, so open them on the canvas rather than
straight in a browser. Their colours are the canvas's own and are not
checked by `designGuard.test.ts`; when one of them is adopted, its colours
move into `src/design/tokens.css` first.
