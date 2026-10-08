import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MobileFrame from "../components/MobileFrame";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/test-utils";
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

const render = (inline: boolean) =>
  renderWithProviders(
    <MobileFrame>
      <a href="/elsewhere">Away</a>
      <Loader inline={inline}>Waiting…</Loader>
    </MobileFrame>,
  );

describe("Loader", () => {
  it("announces what we wait for through a status region that starts empty", async () => {
    renderWithProviders(<Loader>Finding the party…</Loader>);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    await waitFor(() => expect(status).toHaveTextContent("Finding the party…"));
    expect(document.querySelector("canvas.esc-loader-ball")).toHaveAttribute("aria-hidden", "true");
  });

  it("covers the phone screen when there is one, and the window when there is not", () => {
    const { unmount } = renderWithProviders(<Loader>Waiting…</Loader>);
    expect(screen.getByRole("status").parentElement).toHaveClass("is-window");
    unmount();

    const phone = document.createElement("div");
    phone.className = "esc-app";
    document.body.append(phone);
    renderWithProviders(<Loader>Waiting…</Loader>);
    const overlay = screen.getByRole("status").parentElement;
    expect(overlay?.parentElement).toBe(phone);
    expect(overlay).not.toHaveClass("is-window");
    phone.remove();
  });

  it("stays mounted when its text changes", () => {
    const { rerender } = renderWithProviders(<Loader>One…</Loader>);
    const overlay = document.querySelector(".esc-loader");
    rerender(<Loader>Two…</Loader>);
    expect(document.querySelector(".esc-loader")).toBe(overlay);
  });

  it("makes the page content inert, but not the app bar, and lifts it afterwards", () => {
    const view = (loading: boolean) => (
      <MobileFrame>
        <a href="/elsewhere">Away</a>
        {loading && <Loader>Waiting…</Loader>}
      </MobileFrame>
    );
    const { rerender } = renderWithProviders(view(true));
    const content = document.querySelector(".esc-content");
    expect(content).toHaveAttribute("inert");
    expect(content).toContainElement(screen.getByText("Away"));
    expect(content).not.toContainElement(screen.getByRole("switch", { name: "Sparkle mode" }));
    rerender(view(false));
    expect(content).not.toHaveAttribute("inert");
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
    await screen.findByRole("switch", { name: "Sparkle mode" });
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

  describe("inline", () => {
    it("sits in the page flow: no portal, no scrim, nothing inert", () => {
      render(true);
      const status = screen.getByRole("status");
      const box = status.parentElement;
      expect(box).toHaveClass("esc-loader", "is-inline");
      expect(box).not.toHaveClass("is-window");
      expect(document.querySelector(".esc-content")).toContainElement(box);
      expect(document.querySelector(".esc-content")).not.toHaveAttribute("inert");
      expect(screen.getByText("Away")).toBeVisible();
    });

    it("announces through a status region that starts empty", async () => {
      render(true);
      const status = screen.getByRole("status");
      expect(status).toBeEmptyDOMElement();
      await waitFor(() => expect(status).toHaveTextContent("Waiting…"));
    });

    it("leaves the page's links usable", async () => {
      const user = userEvent.setup();
      render(true);
      const link = screen.getByRole("link", { name: "Away" });
      await user.click(link);
      expect(link).toBeInTheDocument();
    });

    it("does not block the pointer", () => {
      const css = readFileSync("src/design/stage.css", "utf8");
      const rule = css.match(/\.esc-loader\.is-inline \{[^}]*\}/)?.[0] ?? "";
      expect(rule).toMatch(/position: relative/);
      expect(rule).toMatch(/background: none/);
    });
  });
});
