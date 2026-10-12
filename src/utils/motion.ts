/** Whether the system asks for less motion. False where matchMedia is missing. */
export const prefersReducedMotion = (): boolean =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
