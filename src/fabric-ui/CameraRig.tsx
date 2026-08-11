import { useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DESIGN_HALF_HEIGHT, DESIGN_HALF_WIDTH } from './constants';
import type { ParallaxOffset } from './useParallax';

const DISTANCE = 8;
/** Exponential smoothing rate for the parallax, in reciprocal seconds. */
const FOLLOW = 6;

interface CameraRigProps {
    /** Degrees the camera drops below the sheet's normal. */
    tilt: number;
    /** Degrees the camera swings to the left of the sheet's normal. */
    yaw: number;
    /** Live parallax offsets, added on top of the base pose. */
    parallax: RefObject<ParallaxOffset>;
}

/**
 * Static orthographic camera at a slight tilt, with parallax on top.
 *
 * Orthographic is not a style choice here. It keeps the map from plane
 * coordinates to pixels a fixed affine transform, which is what lets the DOM
 * overlay sit exactly on top of each plateau with one projection per frame and
 * no perspective correction.
 */
export default function CameraRig({ tilt, yaw, parallax }: CameraRigProps) {
    const { camera, size } = useThree();
    const current = useRef({ tilt: 0, yaw: 0 });

    useFrame((_, delta) => {
        if (!(camera instanceof THREE.OrthographicCamera)) return;

        // Chase the parallax rather than snapping to it, so the sheet lags the
        // device very slightly and reads as having mass.
        const k = 1 - Math.exp(-FOLLOW * Math.min(delta, 0.1));
        current.current.tilt += ((parallax.current?.tilt ?? 0) - current.current.tilt) * k;
        current.current.yaw += ((parallax.current?.yaw ?? 0) - current.current.yaw) * k;

        const t = THREE.MathUtils.degToRad(tilt + current.current.tilt);
        const y = THREE.MathUtils.degToRad(yaw + current.current.yaw);

        // Negative Y, so the near edge of the sheet is the bottom of the screen.
        //
        // This is what makes a raised element read as raised. From here each
        // shape's near slope expands down the screen into a visible band while
        // its far slope hides behind the plateau, which is what a protrusion
        // looks like. From +Y the reverse happens, and the visible band sits
        // above every element, which the eye reads as a dent.
        //
        // It also decouples elevation from tilt. From +Y the near slope folds
        // under itself once tan(tilt) exceeds falloff / elevation, so raising
        // one control forced you to lower the other. From -Y the near slope
        // widens monotonically at every tilt.
        //
        // Yaw swings the camera left the same way tilt drops it below. Off both
        // axes each shape shows two side faces instead of one, which reads as
        // depth far more strongly than shading alone.
        camera.position.set(
            -Math.sin(y) * Math.cos(t) * DISTANCE,
            -Math.sin(t) * DISTANCE,
            Math.cos(y) * Math.cos(t) * DISTANCE,
        );
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 0, 0);

        // Fit the design area. Each axis is foreshortened by the angle that
        // rotates around the other one. Fitted on the base pose only, so the
        // frame does not breathe as the parallax moves.
        const baseT = THREE.MathUtils.degToRad(tilt);
        const baseY = THREE.MathUtils.degToRad(yaw);
        const zoomX = size.width / (2 * DESIGN_HALF_WIDTH * Math.cos(baseY));
        const zoomY = size.height / (2 * DESIGN_HALF_HEIGHT * Math.cos(baseT));
        camera.zoom = Math.min(zoomX, zoomY);

        camera.near = 0.1;
        camera.far = DISTANCE * 3;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
    });

    return null;
}
