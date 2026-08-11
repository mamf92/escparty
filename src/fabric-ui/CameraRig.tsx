import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DESIGN_HALF_HEIGHT, DESIGN_HALF_WIDTH } from './constants';

const DISTANCE = 8;

interface CameraRigProps {
    /** Degrees away from looking straight down the sheet's normal. */
    tilt: number;
}

/**
 * Static orthographic camera at a slight tilt.
 *
 * Orthographic is not a style choice here. It keeps the map from plane
 * coordinates to pixels a fixed affine transform, which is what lets the DOM
 * overlay sit exactly on top of each plateau with one projection per frame and
 * no perspective correction.
 */
export default function CameraRig({ tilt }: CameraRigProps) {
    const { camera, size } = useThree();

    useEffect(() => {
        if (!(camera instanceof THREE.OrthographicCamera)) return;

        const t = THREE.MathUtils.degToRad(tilt);
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
        camera.position.set(0, -Math.sin(t) * DISTANCE, Math.cos(t) * DISTANCE);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 0, 0);

        // Fit the design area. Vertical extent is foreshortened by the tilt, so
        // the height term is divided by cos(tilt).
        const zoomX = size.width / (2 * DESIGN_HALF_WIDTH);
        const zoomY = size.height / (2 * DESIGN_HALF_HEIGHT * Math.cos(t));
        camera.zoom = Math.min(zoomX, zoomY);

        camera.near = 0.1;
        camera.far = DISTANCE * 3;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
    }, [camera, size.width, size.height, tilt]);

    return null;
}
