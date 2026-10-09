import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { Stage, paintLitBall } from "./Stage";
import { RESTING_LIGHT, SPARKLE_BALL, ballSpots, lampDirection } from "./stageLights";
import { ThemeSwitch } from "./ThemeSwitch";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A reduced-motion setting the test can flip while the stage is open. */
const motionSetting = (reduce: boolean) => {
  const listeners = new Set<() => void>();
  const media = {
    get matches() { return reduce; },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", () => media);
  return (next: boolean) => {
    reduce = next;
    listeners.forEach(fn => fn());
  };
};

describe("Stage", () => {
  it("is decoration: hidden from assistive tech, with the ball's canvas", () => {
    const { container } = renderWithProviders(<Stage />);
    const stage = container.querySelector(".esc-stage");
    expect(stage).toHaveAttribute("aria-hidden", "true");
    expect(stage?.querySelector("canvas.esc-stage-lights")).not.toBeNull();
  });

  it("lays the sequin floor only in Sparkle", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<><ThemeSwitch /><Stage /></>);
    expect(container.querySelector(".esc-stage-sequins")).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Sparkle mode" }));
    expect(container.querySelector(".esc-stage-sequins")).not.toBeNull();
    await user.click(screen.getByRole("switch", { name: "Sparkle mode" }));
    expect(container.querySelector(".esc-stage-sequins")).toBeNull();
  });

  it("follows the reduced-motion setting while open, with a fresh sequin canvas", async () => {
    const setReduce = motionSetting(false);
    localStorage.setItem("escparty-theme", "sparkle");
    const user = userEvent.setup();
    const { container } = renderWithProviders(<><ThemeSwitch /><Stage /></>);
    if (!container.querySelector(".esc-stage-sequins")) {
      await user.click(screen.getByRole("switch", { name: "Sparkle mode" }));
    }
    const moving = container.querySelector(".esc-stage-sequins");
    expect(moving).not.toBeNull();
    act(() => setReduce(true));
    const still = container.querySelector(".esc-stage-sequins");
    expect(still).not.toBeNull();
    expect(still).not.toBe(moving);
  });

  it("only turns in Sparkle with motion allowed: Calm and reduced motion are one still frame", async () => {
    const frames = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", frames);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const setReduce = motionSetting(false);
    const user = userEvent.setup();
    renderWithProviders(<><ThemeSwitch /><Stage /></>);
    expect(frames).not.toHaveBeenCalled();

    await user.click(screen.getByRole("switch", { name: "Sparkle mode" }));
    expect(frames).toHaveBeenCalled();

    frames.mockClear();
    act(() => setReduce(true));
    expect(frames).not.toHaveBeenCalled();
  });

  it("aims the lamp at a finger or a pointer, without stopping a scroll", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    motionSetting(false);
    const add = vi.spyOn(window, "addEventListener");
    const user = userEvent.setup();
    renderWithProviders(<><ThemeSwitch /><Stage /></>);
    await user.click(screen.getByRole("switch", { name: "Sparkle mode" }));
    for (const type of ["pointerdown", "pointermove", "touchstart", "touchmove"]) {
      const call = add.mock.calls.find(([name]) => name === type);
      expect(call, type).toBeDefined();
      expect(call?.[2]).toMatchObject({ passive: true });
    }
    add.mockRestore();
  });

  it("hangs the ball with no wire on any screen", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
    const fillRect = vi.fn();
    const ctx = new Proxy({ fillRect } as Record<string, unknown>, {
      get: (target, key: string) => target[key] ?? (key === "createRadialGradient" ? () => ({ addColorStop: vi.fn() }) : vi.fn()),
      set: () => true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((kind: string) => kind === "2d" ? ctx : null) as never);
    // The old wire: a 2px strip down the stage's middle from its top edge.
    const wires = () => fillRect.mock.calls.filter(([x, y, w]) => x === 199 && y === 0 && w === 2);

    renderWithProviders(<Stage />);
    expect(fillRect).toHaveBeenCalled();
    expect(wires()).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("paints every spot after the ball, so the light never slips behind it", () => {
    const styles: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        key === "fillRect" ? () => styles.push(String(target.fillStyle)) : key === "createRadialGradient" ? () => ({ addColorStop: vi.fn() }) : (target[key] ?? vi.fn()),
      set: (target, key: string, value) => ((target[key] = value), true),
    }) as unknown as CanvasRenderingContext2D;
    const lamp = lampDirection(RESTING_LIGHT.x, RESTING_LIGHT.y);
    const view = { width: 390, height: 844, centreY: 104, radius: 48 };
    const spots = ballSpots(SPARKLE_BALL, lamp, 0.4, view);
    expect(spots.length).toBeGreaterThan(4);
    paintLitBall(ctx, 147, 56, 96, SPARKLE_BALL, lamp, 0.4, spots);
    // Each spot is two fills (its soft edge, then itself), and they come last.
    const last = styles.slice(-2 * spots.length);
    spots.forEach((spot, i) => expect(last[2 * i + 1]).toBe(`rgba(${spot.colour.join(", ")}, ${spot.alpha})`));
  });
});
