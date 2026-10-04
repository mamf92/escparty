import { act } from "react";
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
});
