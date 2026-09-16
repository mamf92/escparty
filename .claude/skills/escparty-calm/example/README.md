# Example — ESCParty Calm

The canonical proof that this record is complete enough to work from.

## `measurements.json`

Every value in this file was measured from the live app at commit `f82f676` — colour figures sampled from the rendered `.calm-ground` crop, CSS figures read from `lycra-surface.css` and `calm.css`. It is the reference describing itself in the shape `tools/check.py` consumes.

Run it:

```bash
python3 ../tools/check.py measurements.json
```

Expected: **10/10 automated checks pass, exit 0.** If the reference stops passing its own tests, either the source changed or a test is wrong — do not adjust the numbers to make it green without deciding which.

## What the reconstruct-and-diff step actually caught

Two passes, five gaps, all folded back into `dna.json`. The two worth knowing about:

**The chosen state.** The first rebuild used a *lift* for a chosen answer, because that is what the vendored stylesheet does. The shipped surface overrides it to hold the **sink** instead — a lift is far too close to the resting state to spot, and the sparkle twin shows a chosen answer sunk into the sheet. Both modes had to agree. This is now recorded as a shared cross-mode rule in `SKILL.md`.

**The test that failed the reference.** `flat_crown` originally checked whether a `linear-gradient` *spans* more than 20% of a control's face. Run against the reference's own values it failed — the reference does carry a full-face gradient. But it runs `rgba(255,255,255,0.048)` to `0.042`, a delta of 0.006: flat in everything but syntax. The rule that matters is how much the face *varies*, not whether a gradient exists. Rewritten to test delta against a 0.01 ceiling.

That second one is the whole argument for not skipping the rebuild. The test read perfectly well as prose, and it would have rejected every correct implementation of this style.

## What is not here

No worked screen was built for this folder. The reference images *are* the worked output — this style already ships in the app it was captured from, across three screens, which is stronger evidence than a synthetic demo would be. If a new surface is ever built in this language, add it here and note which archetype it uses.
