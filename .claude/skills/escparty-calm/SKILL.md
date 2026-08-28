---
name: escparty-calm
description: Build anything in the ESCParty Calm design language — the accessible, motion-free surface where controls push up through a dark violet sheet as stacked box shadows, and no colour appears except a green check and a red cross. Use whenever building or restyling an ESCParty screen, component, or page that should match the app's landing state, or when asked for the calm/accessible/quiet/default/non-sparkly version of an ESCParty surface. Also use when reviewing whether an existing ESCParty screen still matches Calm. This is the DEFAULT ESCParty language — reach for it unless sparkle is explicitly asked for. For the opt-in glittering WebGL sequin variant, use escparty-sparkle instead.
---

# ESCParty Calm

The landing surface for ESCParty. A dark violet sheet with controls pushed up through it as stacked box shadows, running entirely on the CPU, with no motion beyond the press itself.

Calm is not a fallback or a degraded mode. It is what everyone lands on, and that is a deliberate default rather than a modest one: its twin couples motion to the viewport, which is exactly what makes motion-sensitive people ill.

## How to use it

1. **Load `PROMPT.md` and attach `reference/calm-quiz-marked.png`.** That pair is the whole payload. The image carries what the words can't — attach it every time, not just the first.
2. **Never paste `dna.json` into a prompt.** It is the full record for humans and tooling, and it is deliberately larger than any model should read at once. `PROMPT.md` is compiled from it.
3. **Run `tools/check.py` against the output** before calling the work done.

```bash
python3 tools/check.py measurements.json
```

## What's here

| File | Role |
| --- | --- |
| `PROMPT.md` | The 2KB payload. This is what goes in a context window. |
| `dna.json` | The full record: every measured value, all 12 tests, and what is inferred rather than measured. |
| `reference/` | The original surface, captured at commit `f82f676`. Kept forever. |
| `example/` | A worked rebuild plus what it proved. |
| `tools/check.py` | The automatable tests. Exits non-zero on failure. |

## The one thing most likely to be lost

Pressing a control tugs its two immediate neighbours two pixels toward the dent. It is the only rule in the system where one control's state changes another's appearance, and it is what makes the surface read as one continuous sheet instead of a row of separate buttons.

It is also structurally fragile. The selector needs the controls to be direct siblings of the pane, so wrapping each one in its own row `div` destroys it silently — no error, no warning, just a sheet that has quietly gone dead. If a refactor ever introduces a row wrapper, the markers must be positioned out of the control rather than placed beside it.

## How this differs from its twin

Calm and Sparkle are not two skins of one renderer. They are two renderers over one content model, and they render from the same `OverlayItem[]`, so they can differ in *how* they say something but never in *what* they say.

| | Calm | Sparkle |
| --- | --- | --- |
| Surface | stacked box shadows, CSS | displaced height field, WebGL |
| Runs on | the CPU, no GPU work | the GPU, five field evaluations per pixel |
| Elevation | three discrete steps | continuous and signed, a 2.65x span |
| Motion | the press only | parallax at ±20°, chased not snapped |
| Brightness | mean HSV value 0.331 | 0.587 — 1.77x |
| Saturation | 0.70 | 0.70 — identical |

That last pair is the family bond worth protecting: **same hue, same saturation, roughly double the brightness.** If a change to either surface breaks that relationship, the two stop reading as one product.

Three rules are shared verbatim and must stay in sync across both:

- Light is fixed top-left on every surface, and is never flipped per component.
- A control's surface says only raised or pressed. Correctness is a separate glyph in the left gutter, in `#28a745` or `#dc3545`, and colour never appears anywhere else.
- A chosen answer holds the **sink**, not a lift. The vendored stylesheet reads selection as a lift, which is right for a toggle and wrong here; `calm.css` overrides it so both modes agree.

## If it starts drifting

Symptoms and their usual causes:

| What you see | Cause | Fix |
| --- | --- | --- |
| Reads as moulded plastic, not cloth | Shadow layers balanced with white | Restore the 10-12x dark dominance |
| Controls read as separate cards | The 18px gap widened past the shadow flank | Narrow it until neighbouring hems overlap |
| The sheet feels dead on press | Neighbour tug is not firing | Check the controls are direct siblings of the pane |
| A control face looks domed | A gradient crept across the crown | Corner radials only |
| The accent reads as a theme | Colour escaped the marker glyphs | Get green and red back under 0.1% |
| Release feels like a plastic button | The overshoot was eased out | Restore `cubic-bezier(.16,1.62,.32,1)` |
