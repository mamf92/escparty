/**
 * Per feature second order spring.
 *
 * Release must not be a tween. An ease-out lands dead, which reads as a plastic
 * button; a critically underdamped spring lands with one small overshoot, which
 * is what makes the sheet read as elastic.
 */
export interface Spring {
    value: number;
    velocity: number;
    target: number;
}

export function createSpring(value = 0): Spring {
    return { value, velocity: 0, target: value };
}

/** Fixed substep, so behaviour does not change with frame rate. */
const SUBSTEP = 1 / 300;
const MAX_DELTA = 1 / 15;

export function stepSpring(spring: Spring, delta: number, frequency: number, damping: number): void {
    // A long frame (tab was backgrounded) must not be integrated in one go.
    let remaining = Math.min(delta, MAX_DELTA);
    const w = frequency;
    const c = 2 * damping * frequency;

    while (remaining > 0) {
        const dt = Math.min(remaining, SUBSTEP);
        remaining -= dt;
        const accel = -w * w * (spring.value - spring.target) - c * spring.velocity;
        // Semi implicit Euler: velocity first, so the integrator stays stable.
        spring.velocity += accel * dt;
        spring.value += spring.velocity * dt;
    }
}

/** Damped horizontal shake used by the incorrect state. */
export function shakeOffset(
    elapsed: number,
    amplitude: number,
    frequency: number,
    decay: number,
): number {
    if (elapsed < 0) return 0;
    return Math.sin(elapsed * frequency) * amplitude * Math.exp(-elapsed * decay);
}
