import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
    MAX_FEATURES,
    PLANE_HEIGHT,
    PLANE_SEGMENTS,
    PLANE_WIDTH,
    SHAKE_AMPLITUDE,
    SHAKE_DECAY,
    SHAKE_FREQUENCY,
} from './constants';
import { FABRIC_FRAGMENT, FABRIC_VERTEX } from './shader/fabricMaterial';
import { createSpring, shakeOffset, stepSpring, type Spring } from './springs';
import { applyQuad, type OverlayBridge } from './overlayBridge';
import { PRESETS, SURFACE_INDEX } from './presets';
import type { FabricFeature, FabricShape } from './types';
import type { FabricControls } from './useFabricControls';

interface FabricSurfaceProps {
    /** Slot indexed feature descriptors. `elevation` is the spring target. */
    features: FabricFeature[];
    controls: FabricControls;
    bridge: OverlayBridge;
}

/** Must match the shape dispatch order in the shader's featureProfile. */
const SHAPE_INDEX: Record<FabricShape, number> = { rect: 0, circle: 1, check: 2, cross: 3 };

const SHAKE_DURATION = 0.8;

export default function FabricSurface({ features, controls, bridge }: FabricSurfaceProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const { camera, size } = useThree();

    const springs = useRef<Spring[]>(
        Array.from({ length: MAX_FEATURES }, () => createSpring(0)),
    );
    const shakeClock = useRef<number[]>(new Array(MAX_FEATURES).fill(Infinity));
    const wasShaking = useRef<boolean[]>(new Array(MAX_FEATURES).fill(false));

    const uniforms = useMemo(
        () => ({
            uActive: { value: new Float32Array(MAX_FEATURES) },
            uCenter: { value: new Float32Array(MAX_FEATURES * 2) },
            uHalfSize: { value: new Float32Array(MAX_FEATURES * 2) },
            uRadius: { value: new Float32Array(MAX_FEATURES) },
            uShape: { value: new Float32Array(MAX_FEATURES) },
            uElevation: { value: new Float32Array(MAX_FEATURES) },
            uFalloff: { value: new Float32Array(MAX_FEATURES) },
            uTension: { value: new Float32Array(MAX_FEATURES) },
            uTint: { value: new Float32Array(MAX_FEATURES * 3) },
            uTintStrength: { value: new Float32Array(MAX_FEATURES) },
            uAdditive: { value: new Float32Array(MAX_FEATURES) },
            uMatte: { value: new Float32Array(MAX_FEATURES) },
            uTopShade: { value: new Float32Array(MAX_FEATURES) },
            uBlend: { value: 0.03 },

            uModelMat3: { value: new THREE.Matrix3() },
            uNormalMat: { value: new THREE.Matrix3() },

            uBaseColor: { value: new THREE.Color('#A56DC6') },
            uLightPos: { value: new THREE.Vector3(-1.7, 2.3, 2.7) },
            uKeyColor: { value: new THREE.Color('#FFFFFF') },
            uSpecColor: { value: new THREE.Color('#EEE8F0') },
            uKeyIntensity: { value: 0.8 },
            uFillIntensity: { value: 0.28 },
            uAmbient: { value: 0.3 },
            uSpecPower: { value: 16 },
            uSpecIntensity: { value: 0.34 },
            uSpecAniso: { value: 0 },
            uDiffuseWrap: { value: 0.55 },

            uWeaveScale: { value: 46 },
            uWeaveIntensity: { value: 0.13 },
            uWeaveTwill: { value: 0 },
            uWeaveAngle: { value: 0 },
            uStretchAniso: { value: 0.85 },
            uRidgeIntensity: { value: 0.09 },
            uRidgeFrequency: { value: 42 },
            uThinning: { value: 0.75 },
            uGradRef: { value: 1 },
            uNormalEps: { value: 0.006 },

            uSurfaceMode: { value: 0 },
            uSheenIntensity: { value: 0.55 },
            uSheenPower: { value: 2.6 },
            uSheenColor: { value: new THREE.Color('#D5B8E6') },
            uSequinTilt: { value: 0 },
            uSequinDome: { value: 0 },
        }),
        [],
    );

    // Scratch vectors, reused so the frame loop never allocates.
    const scratch = useMemo(
        () => ({
            v: new THREE.Vector3(),
            edgeA: new THREE.Vector3(),
            edgeB: new THREE.Vector3(),
            ray: new THREE.Vector3(),
            origin: new THREE.Vector3(),
        }),
        [],
    );

    useFrame((_, delta) => {
        const material = materialRef.current;
        if (!material) return;

        const u = material.uniforms;
        const {
            springFrequency,
            springDamping,
            baseColor,
            weaveScale,
            weaveIntensity,
            stretchAnisotropy,
            ridgeIntensity,
            ridgeFrequency,
            thinning,
            specPower,
            specIntensity,
            lightPosition,
            preset,
            elevation,
            falloff,
            sheen,
        } = controls;

        // Any feature can ask to shake. Detect the transition here so the
        // surface owns its own animation clocks.
        for (let i = 0; i < MAX_FEATURES; i++) {
            const wants = Boolean(features[i]?.shake);
            if (wants && !wasShaking.current[i]) shakeClock.current[i] = 0;
            wasShaking.current[i] = wants;
            if (shakeClock.current[i] < SHAKE_DURATION) shakeClock.current[i] += delta;
        }

        const activeArr = u.uActive.value as Float32Array;
        const centerArr = u.uCenter.value as Float32Array;
        const halfArr = u.uHalfSize.value as Float32Array;
        const radiusArr = u.uRadius.value as Float32Array;
        const shapeArr = u.uShape.value as Float32Array;
        const elevArr = u.uElevation.value as Float32Array;
        const falloffArr = u.uFalloff.value as Float32Array;
        const tensionArr = u.uTension.value as Float32Array;
        const tintArr = u.uTint.value as Float32Array;
        const tintWArr = u.uTintStrength.value as Float32Array;
        const additiveArr = u.uAdditive.value as Float32Array;
        const matteArr = u.uMatte.value as Float32Array;
        const shadeArr = u.uTopShade.value as Float32Array;

        for (let i = 0; i < MAX_FEATURES; i++) {
            const feature: FabricFeature | undefined = features[i];
            const spring = springs.current[i];

            if (!feature || !feature.active) {
                activeArr[i] = 0;
                // Keep integrating so a feature that comes back does not pop.
                spring.target = 0;
                stepSpring(spring, delta, springFrequency, springDamping);
                elevArr[i] = spring.value;
                continue;
            }

            spring.target = feature.elevation;
            stepSpring(spring, delta, springFrequency, springDamping);

            let cx = feature.center[0];
            const cy = feature.center[1];
            const clock = shakeClock.current[i];
            if (clock < SHAKE_DURATION) {
                cx += shakeOffset(clock, SHAKE_AMPLITUDE, SHAKE_FREQUENCY, SHAKE_DECAY);
            }

            activeArr[i] = 1;
            centerArr[i * 2] = cx;
            centerArr[i * 2 + 1] = cy;

            halfArr[i * 2] = feature.halfSize[0];
            halfArr[i * 2 + 1] = feature.halfSize[1];
            radiusArr[i] = feature.cornerRadius;
            shapeArr[i] = SHAPE_INDEX[feature.shape];
            elevArr[i] = spring.value;
            falloffArr[i] = feature.falloff;
            tensionArr[i] = feature.tension;
            tintArr[i * 3] = feature.tint[0];
            tintArr[i * 3 + 1] = feature.tint[1];
            tintArr[i * 3 + 2] = feature.tint[2];
            tintWArr[i] = feature.tintStrength;
            additiveArr[i] = feature.additive ? 1 : 0;
            matteArr[i] = feature.matte ? 1 : 0;
            shadeArr[i] = feature.topShade ?? 0;
        }

        // Material uniforms.
        const mesh = meshRef.current;
        if (mesh) {
            u.uModelMat3.value.setFromMatrix4(mesh.matrixWorld);
            u.uNormalMat.value.getNormalMatrix(mesh.matrixWorld);
        }
        u.uBaseColor.value.set(baseColor);
        u.uWeaveScale.value = weaveScale;
        u.uWeaveIntensity.value = weaveIntensity;
        u.uStretchAniso.value = stretchAnisotropy;
        u.uRidgeIntensity.value = ridgeIntensity;
        u.uRidgeFrequency.value = ridgeFrequency;
        u.uThinning.value = thinning;
        u.uSpecPower.value = specPower;
        u.uSpecIntensity.value = specIntensity;
        u.uLightPos.value.set(lightPosition[0], lightPosition[1], lightPosition[2]);

        // Everything the preset changes beyond the exposed sliders. Keeping
        // these here rather than in leva stops the panel from turning into a
        // wall of numbers that has nothing to do with the fabric idea.
        const look = PRESETS[preset];
        u.uWeaveTwill.value = look.twill;
        u.uWeaveAngle.value = look.weaveAngle;
        u.uSpecAniso.value = look.specAniso;
        u.uDiffuseWrap.value = look.diffuseWrap;
        u.uAmbient.value = look.ambient;
        u.uKeyIntensity.value = look.keyIntensity;
        u.uFillIntensity.value = look.fillIntensity;
        u.uSpecColor.value.set(look.specColor);
        u.uSurfaceMode.value = SURFACE_INDEX[look.surface];
        u.uSheenIntensity.value = sheen;
        u.uSheenPower.value = look.sheenPower;
        u.uSheenColor.value.set(look.sheenColor);
        u.uSequinTilt.value = look.sequinTilt;
        u.uSequinDome.value = look.sequinDome;

        // The steepest slope the current settings can produce. Used to
        // normalise the stretch and ridge masks so they stay put when the
        // elevation or falloff controls move.
        u.uGradRef.value = Math.max(elevation / Math.max(falloff, 0.02), 0.2);
        u.uNormalEps.value = Math.max(falloff * 0.05, 0.0025);

        // Project each plateau to screen space for the DOM overlay. With an
        // orthographic camera this is a fixed affine map, so a single project
        // per edge is exact.
        for (let i = 0; i < MAX_FEATURES; i++) {
            if (!bridge.elements[i]) continue;
            const feature = features[i];
            if (!feature) continue;

            const h = springs.current[i].value;

            const cx = centerArr[i * 2];
            const cy = centerArr[i * 2 + 1];
            const hw = feature.halfSize[0];
            const hh = feature.halfSize[1];

            // Centre plus the screen images of the plateau's own two axes.
            scratch.v.set(cx, cy, h).project(camera);
            scratch.edgeA.set(cx + hw, cy, h).project(camera);
            scratch.edgeB.set(cx, cy + hh, h).project(camera);

            const halfW = size.width * 0.5;
            const halfH = size.height * 0.5;
            const px = (scratch.v.x * 0.5 + 0.5) * size.width;
            const py = (-scratch.v.y * 0.5 + 0.5) * size.height;
            const ux = (scratch.edgeA.x - scratch.v.x) * halfW;
            const uy = -(scratch.edgeA.y - scratch.v.y) * halfH;
            const vx = (scratch.edgeB.x - scratch.v.x) * halfW;
            const vy = -(scratch.edgeB.y - scratch.v.y) * halfH;

            // The element keeps its unforeshortened size, so the matrix carries
            // every bit of the foreshortening and shear rather than sharing it
            // with the box model.
            const zoom = (camera as THREE.OrthographicCamera).zoom;
            const w = Math.max(2 * hw * zoom, 1);
            const hpx = Math.max(2 * hh * zoom, 1);

            const quad = bridge.quads[i];
            quad.a = (2 * ux) / w;
            quad.b = (2 * uy) / w;
            // Element y runs down the screen while plane y runs up it.
            quad.c = (-2 * vx) / hpx;
            quad.d = (-2 * vy) / hpx;
            quad.e = px - (quad.a * w) / 2 - (quad.c * hpx) / 2;
            quad.f = py - (quad.b * w) / 2 - (quad.d * hpx) / 2;
            quad.width = w;
            quad.height = hpx;
            applyQuad(bridge, i);
        }
    });

    return (
        <mesh ref={meshRef} frustumCulled={false}>
            <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT, PLANE_SEGMENTS, PLANE_SEGMENTS]} />
            <shaderMaterial
                ref={materialRef}
                vertexShader={FABRIC_VERTEX}
                fragmentShader={FABRIC_FRAGMENT}
                uniforms={uniforms}
            />
        </mesh>
    );
}
