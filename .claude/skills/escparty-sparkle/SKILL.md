---
name: escparty-sparkle
description: Build anything in the ESCParty Sparkle design language — the opt-in glittering variant where a bright magenta sequin membrane is rendered as a real displaced height field in WebGL, dead-on at rest and tilting with device or pointer parallax. Use whenever asked for the sparkly, glittery, sequin, party, Eurovision, or "make it sparkle" version of an ESCParty screen or component, or when working on the fabric-ui membrane, the sequin shader, or the sparkle toggle. Sparkle is OPT-IN and never the landing state — for the default accessible surface, and for anything where reduced motion matters, use escparty-calm instead.
---

# ESCParty Sparkle

The opt-in surface. A bright magenta sequin membrane rendered as a real displaced height field in WebGL — dead flat to the eye at rest, tilting with device orientation or pointer as you move.

Sparkle is deliberately never the landing state. Parallax is viewport-coupled motion, and the operating system already publishes a preference about that, so a system-level `prefers-reduced-motion` setting outranks the sparkle switch entirely: the surface still swaps, the parallax stays off.

## How to use it

1. **Load `PROMPT.md` and attach `reference/sparkle-quiz-idle.png`.** That pair is the whole payload. The image carries what the words can't — attach it every time.
2. **Never paste `dna.json` into a prompt.** It is the full record for humans and tooling. `PROMPT.md` is compiled from it.
3. **Run `tools/check.py` against the output** before calling the work done.

```bash
python3 tools/check.py measurements.json
```

`reference/sparkle-parallax-topleft.png` and `-bottomright.png` are a matched pair from opposite pointer positions. Use them together when the question is about motion rather than appearance — a single still cannot show what this surface actually does.

## What's here

| File | Role |
| --- | --- |
| `PROMPT.md` | The 2KB payload. This is what goes in a context window. |
| `dna.json` | The full record: measured values, all 12 tests, and what is inferred rather than measured. |
| `reference/` | The original surface at commit `f82f676`, including the parallax pair. |
| `example/` | A worked rebuild plus what it proved — and what a static rebuild cannot prove. |
| `tools/check.py` | The automatable tests. Exits non-zero on failure. |

## The one thing most likely to be "fixed"

The sequin preset sets `sheenIntensity` to **exactly zero** — the single term the surrounding material system describes as the thing that separates cloth from moulded plastic. Every sibling preset leans on it (spandex 0.55, felt 0.85, carbon 0.12).

This is not an oversight. Sheen models fibres standing off a surface and scattering light at grazing angles; sequins are not fibres, they are hundreds of hard reflective discs, and lighting them like cloth is simply wrong. Restore the sheen and the sheet becomes glittery velvet — softer, prettier, and no longer Eurovision. Tension ridges, stretch anisotropy and thinning are all zeroed alongside it for the same reason.

It will keep looking like a missing value, and there is a real loose thread inviting the fix: the preset still carries a `sheenColor` of `#FF9F1D` that never renders, because the intensity it would multiply is zero. **Leave both alone.** If that dead colour is ever cleaned up, delete it rather than giving it an intensity.

## How this differs from its twin

Calm and Sparkle are not two skins of one renderer. They are two renderers over one content model, and both render from the same `OverlayItem[]`, so they can differ in *how* they say something but never in *what* they say.

| | Sparkle | Calm |
| --- | --- | --- |
| Surface | displaced height field, WebGL | stacked box shadows, CSS |
| Runs on | the GPU, five field evaluations per pixel | the CPU, no GPU work |
| Elevation | continuous and signed, a 2.65x span | three discrete steps |
| Motion | parallax at ±20°, chased not snapped | the press only |
| Camera | dead-on; motion supplies the depth | not applicable |
| Brightness | mean HSV value 0.587 | 0.331 |
| Saturation | 0.70 | 0.70 — identical |

The family bond worth protecting: **same hue, same saturation, roughly double the brightness.** Sparkle is not a different palette, it is the same palette turned up. If a change breaks that relationship, the two stop reading as one product.

Three rules are shared verbatim and must stay in sync across both:

- Light is fixed top-left on every surface, and is never flipped per component.
- A plate's surface says only raised or pressed. Correctness is a separate glyph in the left gutter, in `#28a745` or `#dc3545`, and colour never appears anywhere else on the sheet.
- A chosen answer holds the **sink**, not a lift — the membrane shows a chosen answer sunk into the sheet, and `calm.css` was overridden to match it, not the other way round.

## If it starts drifting

| What you see | Cause | Fix |
| --- | --- | --- |
| Reads as glittery velvet, softer than it should | Sheen was restored | Set `sheenIntensity` back to 0 |
| A soft overall shimmer instead of discrete glints | The spec lobe was broadened | Restore `specPower` 50; a broad lobe lights every disc at once |
| Blown out rather than sequinned | Glitter chased past its budget | Get near-white back under 1% of the canvas |
| Depth looks drawn on rather than felt | The camera was given a resting angle | Return tilt and yaw to 0 |
| The sheet feels glued to the cursor | Camera bound directly to the input | Restore the 6/s exponential chase |
| The press reads as failing to take | `pressed` made shallower than `selected` | Pressed must be the deepest point |
| Plates became domes | `falloff` grew past half the plate half-height | Bring it back under 0.5 |
| Marker glyphs have no flat coloured top | Stroke thinner than the slope band | Thicken the stroke, not the colour mask |
