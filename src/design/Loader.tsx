import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FPS, MAX_STEP, paintBall, usePrefersStill } from "./Stage";
import { CALM_BALL, RESTING_LIGHT, SPARKLE_BALL, SPIN, lampDirection } from "./stageLights";
import { useDesignTheme } from "./useDesignTheme";

/*
 * The wait (docs/design/design-system.md, "States"): a small disco ball,
 * painted from the same facets as the stage's, and a short line of text,
 * over the whole screen while it waits on the network. The overlay
 * covers and blocks the page beneath, so a tap can't start a second thing
 * (and the page's content is inert, so neither can a key), and the line is
 * announced to a screen reader through a status region that is mounted
 * empty and filled afterwards. The app bar stays above the scrim.
 *
 * `<Loader inline>` is the same ball and line placed in the page flow, for a
 * wait that must leave the page's own exits usable (a guest waiting on the
 * host can still go back): no portal, no scrim, nothing inert.
 *
 * - Calm, reduced motion and forced colours: the ball hangs still.
 * - Sparkle: the ball turns, a few times faster than the stage's.
 */

/** The ball's diameter in CSS pixels. */
const SIZE = 88;
/** How much faster than the stage's ball it turns, so a wait looks busy. */
const SPEED = 6;
/** The lamp never moves here, so its direction is worked out once. */
const LAMP = lampDirection(RESTING_LIGHT.x, RESTING_LIGHT.y);
/** The page content the app frame makes inert while we wait (MobileFrame.tsx). */
const CONTENT = ".esc-content";
/** How long the status region sits empty before it is filled, so it is announced. */
const ANNOUNCE_DELAY = 100;

/** Paint the ball on a canvas of SIZE CSS pixels. */
const paintLoader = (canvas: HTMLCanvasElement, sparkle: boolean, phase: number) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixels = Math.round(SIZE * dpr);
  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);
  paintBall(ctx, 0, 0, SIZE, sparkle ? SPARKLE_BALL : CALM_BALL, LAMP, phase);
};

export type LoaderProps = {
  /** What we are waiting for, as a short line ("Finding the party…"). */
  children: string;
  /** Sit in the page flow instead of covering it: nothing is blocked or made inert. */
  inline?: boolean;
};

/**
 * Render it while a screen waits, and stop rendering it when the wait is
 * over. It covers the phone screen (`.esc-app`), or the window where
 * there is none.
 */
export const Loader = ({ children, inline = false }: LoaderProps) => {
  const { theme } = useDesignTheme();
  const sparkle = theme === "sparkle";
  const still = usePrefersStill();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The screen to cover is only there once the frame has mounted, so it is
  // found when a marker rendered in place attaches, not during render; the
  // overlay then mounts once and stays through text changes.
  const [screen, setScreen] = useState<Element | null>(null);
  const findScreen = useCallback((marker: HTMLElement | null) => {
    if (marker && !inline) setScreen(document.querySelector(".esc-app") ?? document.body);
  }, [inline]);
  useLayoutEffect(() => {
    if (inline) return;
    const content = document.querySelector(".esc-app")?.querySelector(CONTENT);
    content?.setAttribute("inert", "");
    return () => content?.removeAttribute("inert");
  }, [inline]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let phase = 0.4;
    paintLoader(canvas, sparkle, phase);
    if (!sparkle || still) return;
    let frame = 0;
    let last = performance.now();
    let drawn = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - drawn < 1000 / FPS - 4) return;
      const step = Math.min((now - last) / 1000, MAX_STEP);
      phase = (phase + SPIN * SPEED * step + Math.PI * 2) % (Math.PI * 2);
      last = now;
      drawn = now;
      paintLoader(canvas, sparkle, phase);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [screen, sparkle, still]);

  // The status region goes in empty and gets its text a moment later:
  // screen readers announce what fills a live region, not one that arrives full.
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(children), ANNOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [children]);

  const className = inline ? "esc-loader is-inline" : `esc-loader${screen === document.body ? " is-window" : ""}`;
  const overlay = (
    <div className={className}>
      <canvas ref={canvasRef} className="esc-loader-ball" width={SIZE} height={SIZE} aria-hidden="true" />
      <p className="esc-loader-text" aria-hidden="true">{children}</p>
      <div className="esc-loader-status" role="status" aria-live="polite">{announced}</div>
    </div>
  );
  if (inline) return overlay;
  return (
    <>
      <span hidden ref={findScreen} />
      {screen && createPortal(overlay, screen)}
    </>
  );
};

export default Loader;
