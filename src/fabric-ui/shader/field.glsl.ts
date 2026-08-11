import { MAX_FEATURES } from '../constants';

/**
 * The height field, shared verbatim by the vertex and fragment stages.
 *
 * The membrane is never simulated. Every UI element is an analytic signed
 * distance function, and the sheet height at a point is the accumulation of
 * each element's profile evaluated against that SDF. The vertex stage uses it
 * for silhouette, the fragment stage re-evaluates it at four offsets to build
 * per pixel normals.
 */
export const FIELD_GLSL = /* glsl */ `
#define MAX_FEATURES ${MAX_FEATURES}

uniform float uActive[MAX_FEATURES];
uniform vec2  uCenter[MAX_FEATURES];
uniform vec2  uHalfSize[MAX_FEATURES];
uniform float uRadius[MAX_FEATURES];
uniform float uShape[MAX_FEATURES];      // 0.0 rounded rect, 1.0 circle
uniform float uElevation[MAX_FEATURES];  // signed: positive raises, negative sinks
uniform float uFalloff[MAX_FEATURES];
uniform float uTension[MAX_FEATURES];
uniform vec3  uTint[MAX_FEATURES];
uniform float uTintStrength[MAX_FEATURES];
/**
 * Features that sum on top of the combined field instead of joining the signed
 * accumulation. The pointer dimple needs this: routed through the smooth
 * minimum it would simply lose to any deeper indent it sits inside.
 */
uniform float uAdditive[MAX_FEATURES];
/**
 * Features rendered as a hard untextured surface. The weave and the tension
 * ridges are suppressed across their plateau, so a marker glyph reads as a
 * solid object sitting in the fabric rather than as more fabric.
 */
uniform float uMatte[MAX_FEATURES];
/**
 * Darkens a feature's flat top only, leaving its sloped sides alone.
 *
 * This is what marks a surface as pressable. A raised panel with a plain top is
 * information, a raised panel with a darker plate on it is a control, and the
 * distinction costs no colour, so it never competes with the correct and wrong
 * markers.
 */
uniform float uTopShade[MAX_FEATURES];

/** Blend width of the smooth maximum used where features overlap. */
uniform float uBlend;

struct Field {
  float h;      // sheet height
  vec3  tint;   // influence weighted feature colour
  float tintW;  // how strongly that colour applies, 0 on the bare sheet
  float matte;  // how much to suppress the woven surface detail
  float shade;  // darkening applied to the flat top only
};

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

/** Distance to a line segment. The building block for a round capped stroke. */
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

/**
 * Check mark, drawn as a two segment polyline of capsules.
 *
 * Capsules rather than rounded boxes, because the roundness of a Material style
 * icon is in its stroke: semicircular caps and a naturally filleted join where
 * the two strokes meet. Filleting the corners of a box does not get there.
 *
 * The t argument is the stroke half thickness, and also the cap radius. It has
 * to stay clear of the slope band, or the stroke is all slope with no flat top
 * left for the colour to sit on.
 */
float sdCheck(vec2 p, vec2 b, float t) {
  vec2 s = max(b - t, vec2(1e-3));
  vec2 a1 = vec2(-s.x, s.y * 0.05);
  vec2 a2 = vec2(-s.x * 0.28, -s.y);
  vec2 a3 = vec2(s.x, s.y * 0.85);
  return min(sdSegment(p, a1, a2), sdSegment(p, a2, a3)) - t;
}

/** Cross, two crossed capsules. Same round cap treatment as the check. */
float sdCross(vec2 p, vec2 b, float t) {
  vec2 s = max(b - t, vec2(1e-3));
  return min(
    sdSegment(p, vec2(-s.x, -s.y), vec2(s.x, s.y)),
    sdSegment(p, vec2(-s.x, s.y), vec2(s.x, -s.y))
  ) - t;
}

/**
 * Quadratic smooth maximum. Exact when the arguments differ by more than k, so
 * it never lifts the flat base plane the way an exponential blend would.
 */
float smaxK(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

float sminK(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

/**
 * The slope profile, and the single most important curve in this project.
 *
 * t is the SDF remapped so t <= 0 is the flat base plane and t >= 1 is the flat
 * plateau. Clamping t with soft knees of width k gives a straight ramp between
 * the two with a rounded shoulder at each end. Large k reads as gel, small k
 * reads as a sheet under tension, which is exactly the axis the tension
 * control needs to travel along.
 */
float tautRamp(float t, float k) {
  return sminK(smaxK(t, 0.0, k), 1.0, k);
}

/** Normalised 0 to 1 profile weight of one feature at a plane position. */
float featureProfile(int i, vec2 p) {
  vec2 rel = p - uCenter[i];
  float d;
  if (uShape[i] < 0.5) {
    d = sdRoundRect(rel, uHalfSize[i], min(uRadius[i], min(uHalfSize[i].x, uHalfSize[i].y)));
  } else if (uShape[i] < 1.5) {
    d = length(rel) - uHalfSize[i].x;
  } else if (uShape[i] < 2.5) {
    // For glyph shapes uRadius carries the stroke half thickness.
    d = sdCheck(rel, uHalfSize[i], uRadius[i]);
  } else {
    d = sdCross(rel, uHalfSize[i], uRadius[i]);
  }
  float k = mix(0.85, 0.02, clamp(uTension[i], 0.0, 1.0));
  float t = -d / max(uFalloff[i], 1e-4);
  return tautRamp(t, k);
}

Field fieldAt(vec2 p) {
  float hPos = 0.0;
  float hNeg = 0.0;
  float hAdd = 0.0;
  vec3  tintAcc = vec3(0.0);
  float tintW = 0.0;
  float matte = 0.0;
  float shade = 0.0;

  for (int i = 0; i < MAX_FEATURES; i++) {
    if (uActive[i] < 0.5) continue;

    float w = featureProfile(i, p);
    if (w <= 0.0) continue;

    float c = w * uElevation[i];
    // Positive and negative contributions are combined separately, so a raised
    // option inside a sunken tray sits on the tray floor instead of cancelling
    // against it. Within each sign a smooth maximum keeps two adjacent options
    // from stacking into one tall mound.
    if (uAdditive[i] > 0.5) {
      hAdd += c;
    } else if (c > 0.0) {
      hPos = smaxK(hPos, c, uBlend);
    } else if (c < 0.0) {
      hNeg = sminK(hNeg, c, uBlend);
    }

    // Colour belongs to the top face only. A broader mask lets it run down the
    // extruded sides, which reads as a glow bleeding off the glyph rather than
    // as a flat coloured cap. The window is a few pixels wide, enough to stay
    // antialiased without smearing.
    float tw = smoothstep(0.62, 0.95, w) * uTintStrength[i];
    tintAcc += uTint[i] * tw;
    tintW += tw;

    // The matte flag is the opposite case. It covers the sides too, since the
    // whole glyph is one hard object, and fades the weave back in at the toe.
    matte = max(matte, w * uMatte[i]);
    // Same top face window as the tint, so the plate stops where the slope
    // begins rather than smearing down the side.
    shade = max(shade, smoothstep(0.62, 0.95, w) * uTopShade[i]);
  }

  Field f;
  f.h = hPos + hNeg + hAdd;
  f.tint = tintW > 1e-4 ? tintAcc / tintW : vec3(0.0);
  f.tintW = clamp(tintW, 0.0, 1.0);
  f.matte = clamp(matte, 0.0, 1.0);
  f.shade = clamp(shade, 0.0, 1.0);
  return f;
}
`;
