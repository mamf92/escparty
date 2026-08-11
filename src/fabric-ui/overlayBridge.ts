import { MAX_FEATURES } from './constants';
import type { ProjectedRect } from './types';

/**
 * Shared handle between the WebGL layer and the DOM overlay.
 *
 * The overlay's buttons have to track their plateaus every frame. Routing that
 * through React state would re-render the whole tree at 60fps, so the surface
 * writes transforms straight onto the registered elements instead.
 */
export interface OverlayBridge {
    elements: Array<HTMLElement | null>;
    rects: ProjectedRect[];
}

export function createOverlayBridge(): OverlayBridge {
    return {
        elements: new Array(MAX_FEATURES).fill(null),
        rects: Array.from({ length: MAX_FEATURES }, () => ({ x: 0, y: 0, width: 0, height: 0 })),
    };
}

/** Writes a projected rectangle onto its element, skipping no-op style writes. */
export function applyRect(bridge: OverlayBridge, slot: number): void {
    const el = bridge.elements[slot];
    if (!el) return;

    const rect = bridge.rects[slot];
    el.style.transform = `translate(-50%, -50%) translate(${rect.x.toFixed(2)}px, ${rect.y.toFixed(2)}px)`;

    // Width and height only move on resize or a leva change, so avoid touching
    // layout affecting properties on every frame.
    const w = `${Math.round(rect.width)}px`;
    const h = `${Math.round(rect.height)}px`;
    if (el.style.width !== w) el.style.width = w;
    if (el.style.height !== h) el.style.height = h;
}
