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
    SLOT,
    OPTION_COUNT,
} from './constants';
import { FABRIC_FRAGMENT, FABRIC_VERTEX } from './shader/fabricMaterial';
import { createSpring, shakeOffset, stepSpring, type Spring } from './springs';
import { applyRect, type OverlayBridge } from './overlayBridge';
import { PRESETS } from './presets';
import type { FabricFeature, FabricShape, OptionState } from './types';
import type { FabricControls } from './useFabricControls';

export interface PointerState {
    /** Plane coordinates of the pointer, updated by the surface itself. */
    inside: boolean;
    down: boolean;
    /** Canvas relative pixels, written by the DOM layer. */
    px: number;
    py: number;
}

interface FabricSurfaceProps {
    /** Slot indexed feature descriptors. `elevation` is the spring target. */
    features: FabricFeature[];
    /** Current state of each option, used to fire the incorrect shake. */
    optionStates: OptionState[];
    controls: FabricControls;
    bridge: OverlayBridge;
    pointer: React.RefObject<PointerState>;
}

/**
 * Height of a feature's plateau, mirroring how the shader accumulates signed
 * contributions: positive and negative parts are combined separately, so a
 * raised option inside a sunken tray rests on the tray floor.
 */
function plateauHeight(own: number, floor: number): number {
    return Math.max(own, 0) + Math.min(own < 0 ? own : 0, floor);
}

/** Must match the shape dispatch order in the shader's featureProfile. */
const SHAPE_INDEX: Record<FabricShape, number> = { rect: 0, circle: 1, check: 2, cross: 3 };

const SHAKE_DURATION = 0.8;

export default function FabricSurface({
    features,
    optionStates,
    controls,
    bridge,
    pointer,
}: FabricSurfaceProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const { camera, size } = useThree();

    const springs = useRef<Spring[]>(
        Array.from({ length: MAX_FEATURES }, () => createSpring(0)),
    );
    const shakeClock = useRef<number[]>(new Array(OPTION_COUNT).fill(Infinity));
    const lastStates = useRef<OptionState[]>(new Array(OPTION_COUNT).fill('idle'));

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
            pointerDimple,
        } = controls;

        // Incorrect answers shake horizontally. Detect the transition here so
        // the surface owns its own animation clocks.
        for (let i = 0; i < OPTION_COUNT; i++) {
            const state = optionStates[i] ?? 'idle';
            if (state === 'incorrect' && lastStates.current[i] !== 'incorrect') {
                shakeClock.current[i] = 0;
            }
            lastStates.current[i] = state;
            if (shakeClock.current[i] < SHAKE_DURATION) {
                shakeClock.current[i] += delta;
            }
        }

        // Pointer position in plane coordinates, for the local dimple.
        let pointerX = 0;
        let pointerY = 0;
        const p = pointer.current;
        const dimpleActive = Boolean(pointerDimple && p?.inside && p.down);
        if (p && dimpleActive) {
            const ndcX = (p.px / size.width) * 2 - 1;
            const ndcY = -(p.py / size.height) * 2 + 1;
            scratch.origin.set(ndcX, ndcY, -1).unproject(camera);
            camera.getWorldDirection(scratch.ray);
            if (Math.abs(scratch.ray.z) > 1e-6) {
                const t = -scratch.origin.z / scratch.ray.z;
                pointerX = scratch.origin.x + scratch.ray.x * t;
                pointerY = scratch.origin.y + scratch.ray.y * t;
            }
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
            const optionIndex = i - SLOT.option;
            if (optionIndex >= 0 && optionIndex < OPTION_COUNT) {
                const clock = shakeClock.current[optionIndex];
                if (clock < SHAKE_DURATION) {
                    cx += shakeOffset(clock, SHAKE_AMPLITUDE, SHAKE_FREQUENCY, SHAKE_DECAY);
                }
            }

            if (i === SLOT.pointer) {
                cx = pointerX;
                activeArr[i] = dimpleActive ? 1 : 0;
                centerArr[i * 2] = cx;
                centerArr[i * 2 + 1] = pointerY;
            } else {
                activeArr[i] = 1;
                centerArr[i * 2] = cx;
                centerArr[i * 2 + 1] = cy;
            }

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

        // The steepest slope the current settings can produce. Used to
        // normalise the stretch and ridge masks so they stay put when the
        // elevation or falloff controls move.
        u.uGradRef.value = Math.max(elevation / Math.max(falloff, 0.02), 0.2);
        u.uNormalEps.value = Math.max(falloff * 0.05, 0.0025);

        // Project each plateau to screen space for the DOM overlay. With an
        // orthographic camera this is a fixed affine map, so a single project
        // per edge is exact.
        const trayFloor = features[SLOT.tray]?.active ? springs.current[SLOT.tray].value : 0;
        for (let i = 0; i < MAX_FEATURES; i++) {
            if (!bridge.elements[i]) continue;
            const feature = features[i];
            if (!feature) continue;

            const insideTray =
                trayFloor < 0 && i >= SLOT.option && i < SLOT.option + OPTION_COUNT;
            const h = plateauHeight(springs.current[i].value, insideTray ? trayFloor : 0);

            const cx = centerArr[i * 2];
            const cy = centerArr[i * 2 + 1];
            const hw = feature.halfSize[0];
            const hh = feature.halfSize[1];

            scratch.v.set(cx, cy, h).project(camera);
            scratch.edgeA.set(cx + hw, cy, h).project(camera);
            scratch.edgeB.set(cx, cy + hh, h).project(camera);

            const rect = bridge.rects[i];
            rect.x = (scratch.v.x * 0.5 + 0.5) * size.width;
            rect.y = (-scratch.v.y * 0.5 + 0.5) * size.height;
            rect.width = Math.abs(scratch.edgeA.x - scratch.v.x) * size.width;
            rect.height = Math.abs(scratch.edgeB.y - scratch.v.y) * size.height;
            applyRect(bridge, i);
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
