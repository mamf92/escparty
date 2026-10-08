import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { Loader } from "./Loader";
import { ThemeSwitch } from "./ThemeSwitch";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A canvas whose 2D context counts the facets painted, as jsdom has none. */
const fakeCanvas = () => {
  const fillRect = vi.fn();
  const ctx = new Proxy({ fillRect } as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : (target[key] = vi.fn())),
    set: (target, key: string, value) => ((target[key] = value), true),
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return { fillRect };
};

const motionSetting = (reduce: boolean) => {
  vi.stubGlobal("matchMedia", () => ({
    matches: reduce,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

describe("Loader", () => {
  it("is a status that says what we wait for, with the ball as silent decoration", () => {
    renderWithProviders(<Loader>Finding the party…</Loader>);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Finding the party…");
    expect(status.querySelector("canvas.esc-loader-ball")).toHaveAttribute("aria-hidden", "true");
  });

  it("covers the phone screen when there is one, and the window when there is not", () => {
    const { unmount } = renderWithProviders(<Loader>Waiting…</Loader>);
    expect(screen.getByRole("status")).toHaveClass("is-window");
    unmount();

    const phone = document.createElement("div");
    phone.className = "esc-app";
    document.body.append(phone);
    renderWithProviders(<Loader>Waiting…</Loader>);
    const status = screen.getByRole("status");
    expect(status.parentElement).toBe(phone);
    expect(status).not.toHaveClass("is-window");
    phone.remove();
  });

  it("paints the ball from the stage's facets", () => {
    const ctx = fakeCanvas();
    renderWithProviders(<Loader>Waiting…</Loader>);
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(100);
  });

  it("hangs still in Calm", () => {
    motionSetting(false);
    const frames = vi.spyOn(window, "requestAnimationFrame");
    fakeCanvas();
    renderWithProviders(<Loader>Waiting…</Loader>);
    expect(frames).not.toHaveBeenCalled();
  });

  it("turns in Sparkle, unless the system asks for reduced motion", () => {
    localStorage.setItem("escparty-theme", "sparkle");
    motionSetting(false);
    const frames = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    fakeCanvas();
    const { unmount } = renderWithProviders(<Loader>Waiting…</Loader>);
    expect(frames).toHaveBeenCalled();
    unmount();
    expect(cancel).toHaveBeenCalledWith(1);

    frames.mockClear();
    motionSetting(true);
    renderWithProviders(<Loader>Waiting…</Loader>);
    expect(frames).not.toHaveBeenCalled();
  });

  it("repaints the ball when the theme changes", async () => {
    const ctx = fakeCanvas();
    const user = userEvent.setup();
    renderWithProviders(<><ThemeSwitch /><Loader>Waiting…</Loader></>);
    const before = ctx.fillRect.mock.calls.length;
    await act(async () => { await user.click(screen.getByRole("switch", { name: "Sparkle mode" })); });
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(before);
  });

  it("blocks the page beneath: the overlay takes the pointer", () => {
    const css = readFileSync("src/design/stage.css", "utf8");
    const rule = css.match(/\.esc-loader \{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/inset: 0/);
    expect(rule).not.toMatch(/pointer-events:\s*none/);
  });
});
