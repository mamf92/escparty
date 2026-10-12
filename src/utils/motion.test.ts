import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "./motion";

describe("prefersReducedMotion", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("follows the reduced-motion media query", () => {
        vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
        expect(prefersReducedMotion()).toBe(true);
        vi.stubGlobal("matchMedia", () => ({ matches: false }));
        expect(prefersReducedMotion()).toBe(false);
    });

    it("is false where matchMedia is missing", () => {
        vi.stubGlobal("matchMedia", undefined);
        expect(prefersReducedMotion()).toBe(false);
    });
});
