import { useCallback, useEffect, useRef, useState } from 'react';

export interface ParallaxOffset {
    tilt: number;
    yaw: number;
}

interface IosDeviceOrientation {
    requestPermission?: () => Promise<'granted' | 'denied'>;
}

/** iOS gates device orientation behind a user gesture. */
function iosMotionApi(): IosDeviceOrientation | null {
    if (typeof DeviceOrientationEvent === 'undefined') return null;
    const api = DeviceOrientationEvent as unknown as IosDeviceOrientation;
    return typeof api.requestPermission === 'function' ? api : null;
}

/**
 * Camera parallax, driven by device orientation where it is available and by
 * pointer position where it is not.
 *
 * A fixed yaw is a compromise: it sells the depth, but it also means looking at
 * a phone screen from an angle you are not actually holding it at. Letting the
 * viewpoint follow the device resolves that. The sheet is then being viewed
 * straight on at rest, and the side faces only appear as you move, which is
 * what makes the depth feel physical rather than drawn on.
 *
 * The offsets are written to a ref rather than to state, because they change
 * every frame and the camera reads them inside the render loop.
 */
export function useParallax(enabled: boolean, strength: number) {
    const offset = useRef<ParallaxOffset>({ tilt: 0, yaw: 0 });
    const [motionGranted, setMotionGranted] = useState(false);
    const needsPermission = iosMotionApi() !== null && !motionGranted;

    const requestMotion = useCallback(async () => {
        const api = iosMotionApi();
        if (!api?.requestPermission) return;
        try {
            const result = await api.requestPermission();
            setMotionGranted(result === 'granted');
        } catch {
            setMotionGranted(false);
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            offset.current.tilt = 0;
            offset.current.yaw = 0;
            return;
        }

        const clamp = (n: number) => Math.max(-1, Math.min(1, n));

        const onPointer = (event: PointerEvent) => {
            const nx = (event.clientX / window.innerWidth) * 2 - 1;
            const ny = (event.clientY / window.innerHeight) * 2 - 1;
            offset.current.yaw = clamp(nx) * strength;
            offset.current.tilt = clamp(-ny) * strength;
        };

        const onOrientation = (event: DeviceOrientationEvent) => {
            if (event.gamma === null && event.beta === null) return;
            // gamma is the left to right tilt, beta the front to back one,
            // measured from a phone lying flat, so beta is offset to the angle
            // a phone is actually held at.
            offset.current.yaw = clamp((event.gamma ?? 0) / 30) * strength;
            offset.current.tilt = clamp(((event.beta ?? 45) - 45) / 30) * strength;
        };

        const useMotion = typeof DeviceOrientationEvent !== 'undefined'
            && (iosMotionApi() === null || motionGranted);

        if (useMotion) window.addEventListener('deviceorientation', onOrientation);
        window.addEventListener('pointermove', onPointer);
        return () => {
            window.removeEventListener('deviceorientation', onOrientation);
            window.removeEventListener('pointermove', onPointer);
        };
    }, [enabled, strength, motionGranted]);

    return { offset, needsPermission, requestMotion };
}
