import { FIELD_GLSL } from './field.glsl';

export const FABRIC_VERTEX = /* glsl */ `
${FIELD_GLSL}

varying vec2 vPlane;
varying vec3 vWorldPos;

void main() {
  vec3 pos = position;
  // The plane's normal is constant +Z in local space, so displacing along the
  // normal is a displacement along Z.
  pos.z += fieldAt(pos.xy).h;

  vPlane = pos.xy;
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const FABRIC_FRAGMENT = /* glsl */ `
${FIELD_GLSL}

varying vec2 vPlane;
varying vec3 vWorldPos;

// three only exposes modelMatrix to the vertex stage, so the two matrices the
// fragment stage needs are uploaded explicitly.
uniform mat3 uModelMat3;
uniform mat3 uNormalMat;

uniform vec3  uBaseColor;
uniform vec3  uLightPos;
uniform vec3  uKeyColor;
uniform vec3  uSpecColor;
uniform float uKeyIntensity;
uniform float uFillIntensity;
uniform float uAmbient;
uniform float uSpecPower;
uniform float uSpecIntensity;
uniform float uSpecAniso;      // 0 isotropic lobe, 1 aligned to the weave
uniform float uDiffuseWrap;

uniform float uWeaveScale;
uniform float uWeaveIntensity;
uniform float uWeaveTwill;     // 0 plain knit, 1 two by two twill
uniform float uWeaveAngle;
uniform float uStretchAniso;
uniform float uRidgeIntensity;
uniform float uRidgeFrequency;
uniform float uThinning;
uniform float uGradRef;        // gradient magnitude that counts as full stretch
uniform float uNormalEps;

const float TAU = 6.28318530718;

/**
 * Micro normal of the weave, as a height gradient in weave space.
 *
 * Each unit cell carries one thread crossing. The over and under pattern
 * decides which of the two thread directions catches the light, and the
 * remaining direction is damped rather than removed so the under thread stays
 * faintly visible.
 */
vec2 weaveGradient(vec2 uv, float twillMix) {
  vec2 cell = floor(uv);
  float plain = mod(cell.x + cell.y, 2.0);
  float twill = step(2.0, mod(cell.x - cell.y + 4.0, 4.0));
  float over = mix(plain, twill, twillMix);

  // The under thread is damped rather than removed, so the crossing still reads
  // as two interlocking threads instead of a checkerboard of dashes.
  float warp = mix(1.0, 0.45, over);
  float weft = mix(0.45, 1.0, over);
  return vec2(warp * cos(TAU * uv.x), weft * cos(TAU * uv.y));
}

/** Irregular ridge derivative, used directly as a normal perturbation. */
float ridgeDerivative(float phase) {
  return cos(phase) * 0.6
       + cos(phase * 2.31 + 1.7) * 0.3
       + cos(phase * 4.73 + 0.4) * 0.12;
}

void main() {
  Field f = fieldAt(vPlane);

  // Central differences on the same height function give a smooth slope
  // without paying for more tessellation.
  float e = uNormalEps;
  float hxp = fieldAt(vPlane + vec2(e, 0.0)).h;
  float hxn = fieldAt(vPlane - vec2(e, 0.0)).h;
  float hyp = fieldAt(vPlane + vec2(0.0, e)).h;
  float hyn = fieldAt(vPlane - vec2(0.0, e)).h;
  vec2 grad = vec2(hxp - hxn, hyp - hyn) / (2.0 * e);

  float gradLen = length(grad);
  float stretchAmount = clamp(gradLen / max(uGradRef, 1e-4), 0.0, 1.0);
  vec2 dir = gradLen > 1e-5 ? grad / gradLen : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);

  // Anisotropic weave stretch, the detail that separates fabric from soft
  // plastic. Sampling the weave in a material coordinate that lags behind the
  // surface coordinate along the gradient makes each thread cover more surface,
  // so the threads spread apart exactly where the sheet is pulled.
  //
  // Along the gradient the material coordinate advances at
  //   d(material)/d(surface) = 1 - uStretchAniso
  // in the middle of the slope band, which is why the height is divided by the
  // reference gradient. The smoothstep kills the term where the gradient is too
  // small for its direction to be meaningful, such as the floor of the tray.
  float pull = uStretchAniso * f.h / max(uGradRef, 1e-4);
  vec2 material = vPlane - dir * pull * smoothstep(0.0, 0.3, stretchAmount);

  float ca = cos(uWeaveAngle);
  float sa = sin(uWeaveAngle);
  mat2 weaveRot = mat2(ca, -sa, sa, ca);
  vec2 weaveUv = (weaveRot * material) * uWeaveScale;

  float thin = stretchAmount * uThinning;

  // Threads pulled apart cover less area, so the weave relief shallows out
  // exactly where the sheet is stretched thinnest.
  // Matte features drop the weave entirely, so a marker glyph reads as a hard
  // untextured surface rather than as more fabric.
  float weaveAmp = uWeaveIntensity * (1.0 - 0.4 * thin) * (1.0 - f.matte);
  vec2 weave = weaveGradient(weaveUv, uWeaveTwill) * weaveAmp;

  // Tension ridges run down the slope, so their phase advances across the
  // contour. Masking on gradient magnitude fades them out on both the plateau
  // and the base plane with no extra bookkeeping.
  // Scaled by the reference gradient, so the ridges stay proportional to how
  // steep the slope actually is. As an absolute perturbation they vanished the
  // moment falloff got tight, since the slope's own gradient swamped them.
  float ridgeMask = smoothstep(0.12, 0.55, stretchAmount);
  float ridge = ridgeDerivative(dot(vPlane, perp) * uRidgeFrequency)
              * uRidgeIntensity * ridgeMask * uGradRef * (1.0 - f.matte);

  vec2 micro = weave + perp * ridge;
  vec3 nLocal = normalize(vec3(-(grad.x + micro.x), -(grad.y + micro.y), 1.0));
  vec3 N = normalize(uNormalMat * nLocal);

  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 H = normalize(L + V);

  // Wrapped diffuse. Fabric scatters, so the terminator is soft and the
  // unlit side never goes fully black.
  float wrap = uDiffuseWrap;
  float ndl = max((dot(N, L) + wrap) / (1.0 + wrap), 0.0);
  float diffuse = pow(ndl, 1.35) * uKeyIntensity;

  // Fill comes from the front and slightly opposite the key, never from below.
  // A fill with a negative Y lifts exactly the down facing slopes that carry the
  // contact shadow, which cancels the cue that makes a shape read as raised.
  vec3 fillDir = normalize(vec3(0.45, 0.2, 1.0));
  float fill = max((dot(N, fillDir) + 0.7) / 1.7, 0.0) * uFillIntensity;

  // A matte feature is not dull, it is smooth. Tighter and brighter highlight,
  // which is what separates a moulded plastic marker from woven cloth.
  float specPower = mix(uSpecPower, uSpecPower * 2.2, f.matte);
  float specIntensity = uSpecIntensity * (1.0 + 0.7 * thin) * mix(1.0, 2.0, f.matte);
  float specIso = pow(max(dot(N, H), 0.0), specPower);

  // Kajiya Kay style lobe for the twill, tight and aligned to the warp. The
  // thread direction has to be projected onto the tangent plane, otherwise it is
  // constant across an orthographic view and the highlight smears over the whole
  // sheet instead of following the weave.
  vec3 warpDir = normalize(uModelMat3 * vec3(ca, sa, 0.0));
  vec3 T = normalize(warpDir - N * dot(N, warpDir));
  float dotTH = dot(T, H);
  float specAni = pow(sqrt(max(1.0 - dotTH * dotTH, 0.0)), specPower * 2.0);
  float spec = mix(specIso, specAni, uSpecAniso) * specIntensity;

  vec3 base = mix(uBaseColor, f.tint, f.tintW);
  base += thin * 0.055;

  // Cheap contact shading so the sunken tray reads as a well rather than a
  // flat darker patch.
  float ao = 1.0 - 0.22 * clamp(-f.h / 0.12, 0.0, 1.0);

  vec3 color = base * (uAmbient + diffuse * uKeyColor + fill) * ao + spec * uSpecColor;

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;
