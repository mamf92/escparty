#!/usr/bin/env python3
"""
ESCParty Calm — the automatable half of dna.json's `tests` array.

Judges a measurements file describing a rendered output. It does not render or
measure anything itself: producing `measurements.json` is the job of whatever
drew the output. This script only decides whether the result is still Calm.

Two tests in dna.json are deliberately absent here because no script can decide
them (`neighbour_tug` needs a live press, `squint_ladder` needs an eye). They
are printed as a manual checklist at the end.

Usage:
    python3 tools/check.py measurements.json

Exits non-zero if any automated check fails.

measurements.json shape — every key optional, and a missing key skips its check
rather than silently passing:

    {
      "accent_coverage_pct": 0.04,      // green + red as % of the surface
      "type_sizes_px": [15, 12],
      "tinted_control_states": [],      // names of any state that tints a control
      "outer_shadow_blurs_px": [5, 24, 64],
      "outer_shadow_alphas": {"dark": [0.52,0.33,0.17], "light": [0.05,0.028,0.014]},
      "face_gradient_span_pct": 0,      // largest linear-gradient span across a face
      "press_ms": 80,
      "release_ms": 420,
      "controls_not_direct_children": 0,
      "reduced_motion_transforms": ["none", "none"]
    }
"""

import argparse
import json
import sys

results = []


def check(name, condition, detail=""):
    results.append((name, "PASS" if condition else "FAIL", detail))


def main():
    ap = argparse.ArgumentParser(description="Run the ESCParty Calm self-check.")
    ap.add_argument("measurements", help="JSON file describing the rendered output")
    args = ap.parse_args()

    with open(args.measurements) as f:
        m = json.load(f)

    # accent_budget — colour is a verdict, not a theme.
    if "accent_coverage_pct" in m:
        v = m["accent_coverage_pct"]
        check("accent_budget", v < 0.1, f"green+red cover {v}% (limit 0.1%)")

    # type_count and type_ratio — elevation carries hierarchy, not type size.
    if "type_sizes_px" in m:
        sizes = sorted(set(m["type_sizes_px"]))
        check("type_count", len(sizes) <= 2, f"{len(sizes)} distinct sizes: {sizes}")
        if len(sizes) >= 2:
            ratio = max(sizes) / min(sizes)
            check("type_ratio", 1.2 <= ratio <= 1.4, f"ratio {ratio:.2f}:1 (want 1.2-1.4)")

    # no_tint — a lighter patch reads as nearer and fights the press.
    if "tinted_control_states" in m:
        t = m["tinted_control_states"]
        check("no_tint", len(t) == 0, f"tinted in: {t}" if t else "no state tints a control")

    # three_layers — one layer reads flat, two reads as moulded plastic.
    if "outer_shadow_blurs_px" in m:
        b = m["outer_shadow_blurs_px"]
        check("three_layers", b == [5, 24, 64], f"blurs {b} (want [5, 24, 64])")

    # shadow_dominance — on a dark ground a slope mostly turns AWAY from light.
    sa = m.get("outer_shadow_alphas")
    if sa and sa.get("dark") and sa.get("light"):
        ratios = [d / l for d, l in zip(sa["dark"], sa["light"]) if l]
        if ratios:
            worst = min(ratios)
            check("shadow_dominance", worst >= 8,
                  f"weakest dark:light ratio {worst:.1f}x (want >=8x)")

    # flat_crown — a gradient across the face reads as a dome.
    #
    # This is about how much the face VARIES, not whether a gradient exists.
    # The reference does carry a full-face linear-gradient, but it runs
    # rgba(255,255,255,0.048) to 0.042 — a delta of 0.006, which is flat in
    # everything but syntax. An earlier version of this check tested the
    # gradient's span and failed the reference itself.
    if "face_gradient_alpha_delta" in m:
        v = m["face_gradient_alpha_delta"]
        check("flat_crown", v <= 0.01, f"face alpha varies by {v} (limit 0.01)")

    # timing_ratio — lycra snaps back past rest; an ease-out lands dead.
    if "press_ms" in m and "release_ms" in m and m["press_ms"]:
        r = m["release_ms"] / m["press_ms"]
        check("timing_ratio", 4.5 <= r <= 5.5, f"release is {r:.2f}x the press (want 5x +/-0.5)")

    # sibling_controls — the neighbour tug needs direct siblings or it dies silently.
    if "controls_not_direct_children" in m:
        n = m["controls_not_direct_children"]
        check("sibling_controls", n == 0,
              f"{n} control(s) not a direct child of the pane" if n else "all controls are direct children")

    # reduced_motion — never move a surface for someone who asked you not to.
    if "reduced_motion_transforms" in m:
        tr = m["reduced_motion_transforms"]
        bad = [x for x in tr if x != "none"]
        check("reduced_motion", not bad, f"non-none transforms: {bad}" if bad else "all transforms none")

    if not results:
        print("No recognised keys in the measurements file — nothing was checked.", file=sys.stderr)
        return 2

    print()
    for name, status, detail in results:
        print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))

    failed = [r for r in results if r[1] == "FAIL"]
    print(f"\n{len(results) - len(failed)}/{len(results)} automated checks passed.")

    print("\nManual checks (dna.json tests with auto=false):")
    print("  - neighbour_tug: pressing a control moves both its immediate")
    print("    neighbours 2px toward it, exactly once per press.")
    print("  - squint_ladder: squint from three metres — the raised/rest/flush")
    print("    ladder is readable before any text is.")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
