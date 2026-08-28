#!/usr/bin/env python3
"""
ESCParty Sparkle — the automatable half of dna.json's `tests` array.

Judges a measurements file describing a rendered output. It does not render or
measure anything itself. One test (`squint_glitter`) is deliberately absent
because no script can decide it; it is printed as a manual check at the end.

Usage:
    python3 tools/check.py measurements.json
    python3 tools/check.py measurements.json --calm-saturation 0.70

Exits non-zero if any automated check fails.

measurements.json shape — every key optional, and a missing key skips its check
rather than silently passing:

    {
      "mean_hsv_value": 0.587,
      "mean_saturation": 0.699,
      "near_white_pct": 0.5,            // specular coverage, TEXT EXCLUDED
      "sheen_intensity": 0.0,
      "camera_rest": {"tilt": 0, "yaw": 0},
      "overlay_matrix": [1, 0, 0, 1, 102.2, 163.8],   // a, b, c, d, e, f
      "elevation": {"idle": 1, "pressed": -0.85, "selected": -0.5333,
                    "correct": 1.6, "incorrect": -1.05},
      "falloff": 0.07,
      "plate_half_height": 0.17,
      "reduced_motion": {"parallax_enabled": false, "sequins_render": true},
      "tinted_plate_states": [],
      "marker_stroke_half_thickness": 0.0665,
      "marker_falloff": 0.0441
    }
"""

import argparse
import json
import sys

results = []


def check(name, condition, detail=""):
    results.append((name, "PASS" if condition else "FAIL", detail))


def main():
    ap = argparse.ArgumentParser(description="Run the ESCParty Sparkle self-check.")
    ap.add_argument("measurements", help="JSON file describing the rendered output")
    ap.add_argument("--calm-saturation", type=float, default=0.70,
                    help="The calm twin's measured saturation, which sparkle must match (default 0.70)")
    args = ap.parse_args()

    with open(args.measurements) as f:
        m = json.load(f)

    # sheet_brightness — sparkle is the same palette turned up, not a new one.
    if "mean_hsv_value" in m:
        v = m["mean_hsv_value"]
        check("sheet_brightness", 0.52 <= v <= 0.64, f"mean value {v} (want 0.52-0.64)")

    # saturation_match — the family bond: same hue, same saturation, ~2x brightness.
    if "mean_saturation" in m:
        s = m["mean_saturation"]
        check("saturation_match", abs(s - args.calm_saturation) <= 0.05,
              f"saturation {s} vs calm's {args.calm_saturation} (tolerance 0.05)")

    # glitter_budget — bounded at BOTH ends; too much reads as blown out.
    if "near_white_pct" in m:
        g = m["near_white_pct"]
        check("glitter_budget", 0.3 <= g <= 1.0, f"near-white {g}% (want 0.3-1.0%)")

    # sheen_zero — the weird move. Sequins are discs, not fibres.
    if "sheen_intensity" in m:
        sh = m["sheen_intensity"]
        check("sheen_zero", sh == 0, f"sheenIntensity is {sh} (must be exactly 0)")

    # camera_at_rest — all depth arrives from motion, none from a resting angle.
    cr = m.get("camera_rest")
    if cr:
        check("camera_at_rest_angles", cr.get("tilt") == 0 and cr.get("yaw") == 0,
              f"tilt {cr.get('tilt')}, yaw {cr.get('yaw')} (both must be 0)")
    om = m.get("overlay_matrix")
    if om and len(om) >= 4:
        a, b, c, d = om[:4]
        check("camera_at_rest_no_shear", b == 0 and c == 0,
              f"matrix shear terms b={b}, c={c} (both must be 0 at rest)")

    ev = m.get("elevation") or {}

    # press_deeper — reversing these reads as the press failing to take.
    if "pressed" in ev and "selected" in ev and ev["selected"]:
        r = ev["pressed"] / ev["selected"]
        check("press_deeper", 1.4 <= r <= 1.8,
              f"pressed is {r:.2f}x selected (want 1.4-1.8x, and deeper)")

    # elevation_span — the continuous field is the whole difference from calm.
    if ev:
        span = max(ev.values()) - min(ev.values())
        check("elevation_span", span >= 2.5, f"signed span {span:.2f}x base (want >=2.5x)")

    # falloff_ratio — past half the half-height the slope eats the plateau.
    if "falloff" in m and m.get("plate_half_height"):
        r = m["falloff"] / m["plate_half_height"]
        check("falloff_ratio", r < 0.5, f"falloff is {r:.2f} of the half-height (limit 0.5)")

    # reduced_motion — the OS preference outranks the sparkle switch entirely.
    rm = m.get("reduced_motion")
    if rm:
        ok = rm.get("parallax_enabled") is False and rm.get("sequins_render") is True
        check("reduced_motion", ok,
              f"parallax={rm.get('parallax_enabled')}, sequins={rm.get('sequins_render')} "
              "(want parallax off, sequins still rendering)")

    # no_tint — shared verbatim with the calm twin.
    if "tinted_plate_states" in m:
        t = m["tinted_plate_states"]
        check("no_tint", len(t) == 0, f"tinted in: {t}" if t else "no state tints a plate")

    # marker_stroke — below the slope band there is no flat top to hold colour.
    if "marker_stroke_half_thickness" in m and "marker_falloff" in m:
        st, fo = m["marker_stroke_half_thickness"], m["marker_falloff"]
        check("marker_stroke", st > fo, f"stroke {st} vs slope band {fo} (stroke must exceed it)")

    if not results:
        print("No recognised keys in the measurements file — nothing was checked.", file=sys.stderr)
        return 2

    print()
    for name, status, detail in results:
        print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))

    failed = [r for r in results if r[1] == "FAIL"]
    print(f"\n{len(results) - len(failed)}/{len(results)} automated checks passed.")

    print("\nManual check (dna.json test with auto=false):")
    print("  - squint_glitter: squint from three metres — the surface reads as")
    print("    glittering, not as a flat purple panel.")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
