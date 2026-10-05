import { act, type CSSProperties } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { Stage } from "./Stage";
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

  it("hangs the ball on its wire, except where the screen floats it (Home)", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(800);
    const fillRect = vi.fn();
    const ctx = new Proxy({ fillRect } as Record<string, unknown>, {
      get: (target, key: string) => target[key] ?? (key === "createRadialGradient" ? () => ({ addColorStop: vi.fn() }) : vi.fn()),
      set: () => true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((kind: string) => kind === "2d" ? ctx : null) as never);
    // The wire: a 2px strip down the stage's middle from its top edge.
    const wires = () => fillRect.mock.calls.filter(([x, y, w]) => x === 199 && y === 0 && w === 2);

    const hanging = renderWithProviders(<Stage />);
    expect(wires()).not.toHaveLength(0);
    hanging.unmount();

    fillRect.mockClear();
    renderWithProviders(<div style={{ "--esc-ball-wire": "none" } as CSSProperties}><Stage /></div>);
    expect(fillRect).toHaveBeenCalled();
    expect(wires()).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
