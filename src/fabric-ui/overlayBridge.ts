import { MAX_FEATURES } from './constants';
import type { ProjectedQuad } from './types';

/**
 * Shared handle between the WebGL layer and the DOM overlay.
 *
 * The overlay's buttons have to track their plateaus every frame. Routing that
 * through React state would re-render the whole tree at 60fps, so the surface
 * writes transforms straight onto the registered elements instead.
 */
export interface OverlayBridge {
    elements: Array<HTMLElement | null>;
    quads: ProjectedQuad[];
}

export function createOverlayBridge(): OverlayBridge {
    return {
        elements: new Array(MAX_FEATURES).fill(null),
        quads: Array.from({ length: MAX_FEATURES }, () => ({
            a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, width: 0, height: 0,
        })),
    };
}

/**
 * Writes a projected plateau onto its element.
 *
 * A plain translate is not enough. Under tilt and yaw a plateau projects to a
 * parallelogram, and an axis aligned label sitting on top of it reads as
 * floating above the surface rather than printed onto it. The full affine
 * matrix maps the element's own box onto that parallelogram, so the text
 * foreshortens and shears with the panel it belongs to.
 */
export function applyQuad(bridge: OverlayBridge, slot: number): void {
    const el = bridge.elements[slot];
    if (!el) return;

    const q = bridge.quads[slot];
    el.style.transform =
        `matrix(${q.a.toFixed(5)},${q.b.toFixed(5)},${q.c.toFixed(5)},` +
        `${q.d.toFixed(5)},${q.e.toFixed(2)},${q.f.toFixed(2)})`;

    // Size only moves on resize or a leva change, so avoid touching layout
    // affecting properties on every frame.
    const w = `${Math.round(q.width)}px`;
    const h = `${Math.round(q.height)}px`;
    if (el.style.width !== w) el.style.width = w;
    if (el.style.height !== h) el.style.height = h;
}
