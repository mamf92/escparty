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

/** Blend width of the smooth maximum used where features overlap. */
uniform float uBlend;

struct Field {
  float h;      // sheet height
  vec3  tint;   // influence weighted feature colour
  float tintW;  // how strongly that colour applies, 0 on the bare sheet
};

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
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
  if (uShape[i] > 0.5) {
    d = length(rel) - uHalfSize[i].x;
  } else {
    d = sdRoundRect(rel, uHalfSize[i], min(uRadius[i], min(uHalfSize[i].x, uHalfSize[i].y)));
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

    // Squared, so the state colour stays on the plateau instead of bleeding
    // down the slope and flattening the relief that sells the shape.
    float tw = w * w * uTintStrength[i];
    tintAcc += uTint[i] * tw;
    tintW += tw;
  }

  Field f;
  f.h = hPos + hNeg + hAdd;
  f.tint = tintW > 1e-4 ? tintAcc / tintW : vec3(0.0);
  f.tintW = clamp(tintW, 0.0, 1.0);
  return f;
}
`;
