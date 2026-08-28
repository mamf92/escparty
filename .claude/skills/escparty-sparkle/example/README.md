# Example — ESCParty Sparkle

The canonical proof that this record is complete enough to work from.

## `measurements.json`

Every value was measured from the live app at commit `f82f676` — colour sampled from the rendered 560x560 canvas, shader and layout figures read from `presets.ts`, `constants.ts` and `useFabricControls.ts`, and the overlay matrix read straight off the live DOM. It is the reference describing itself in the shape `tools/check.py` consumes.

Run it:

```bash
python3 ../tools/check.py measurements.json
```

Expected: **12/12 automated checks pass, exit 0.** If the reference stops passing its own tests, either the source changed or a test is wrong — decide which before adjusting anything.

One value in there is derived rather than sampled, and is labelled as such in the file: `near_white_pct` of 0.44%. Total near-white measured 1.323% on the sparkle canvas and 0.887% on calm, which has no glitter at all; the difference is attributed to specular, assuming the shared white type contributes equally to both. It very nearly does.

## What the reconstruct-and-diff step actually caught

Two passes, six gaps, all folded back into `dna.json`. The three worth knowing about:

**The weird move got "fixed".** The first rebuild quietly restored a little sheen, because zero looked like an oversight. That is exactly the failure this record exists to prevent, and it happened on the very first attempt. `weird_move.why` now says so explicitly, and names the dead `sheenColor: #FF9F1D` as the loose thread that invites it.

**Glitter was wildly overdone.** The rebuild read "sequins" as "lots of sparkle" and produced roughly 6% near-white coverage. The measured figure is under 1%. `glitter_budget` is now a bounded test with a ceiling as well as a floor, because too much reads as blown out rather than sequinned.

**The camera got a resting angle.** The rebuild tilted the camera so the plates would look three-dimensional in a still — which is precisely the pose sparkle abandoned. Depth here arrives from motion, and a fixed yaw means looking at a phone from an angle nobody is holding it at. Promoted to its own signature.

## What a static rebuild could not prove

Three things were verified by re-reading the source and comparing the two live parallax captures, **not** by rebuilding them: the parallax chase, the spring, and the incorrect-answer shake. This is recorded honestly in `dna.json` under `reconstruction.gaps_found` rather than presented as a completed diff.

A genuinely complete reconstruction of this style needs a running WebGL context, not a screenshot. If one is ever built, put it here.
