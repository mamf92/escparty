import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BALL_GRID, CALM_BALL, RESTING_LIGHT, SPARKLE_BALL, SPIN, ballCells, lampDirection } from "./stageLights";
import { useDesignTheme } from "./useDesignTheme";

/*
 * The wait (docs/design/design-system.md, "States"): a small disco ball,
 * painted from the same facets as the stage's, and a short line of text,
 * over the whole screen while it waits on the network. The overlay
 * covers and blocks the page beneath, so a tap can't start a second thing,
 * and it is a status, so a screen reader hears the line.
 *
 * - Calm, reduced motion and forced colours: the ball hangs still.
 * - Sparkle: the ball turns, a few times faster than the stage's.
 */

/** The ball's diameter in CSS pixels. */
const SIZE = 88;
/** How much faster than the stage's ball it turns, so a wait looks busy. */
const SPEED = 6;
const FPS = 30;
const MAX_STEP = 0.1;
const STILL = "(prefers-reduced-motion: reduce), (forced-colors: active)";

const rgba = ([r, g, b]: readonly number[], a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

/** Paint the ball, a facet at a time, on a canvas of SIZE CSS pixels. */
const paintBall = (canvas: HTMLCanvasElement, sparkle: boolean, phase: number) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== SIZE * dpr) {
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  const cell = SIZE / BALL_GRID;
  const lamp = lampDirection(RESTING_LIGHT.x, RESTING_LIGHT.y);
  ballCells(sparkle ? SPARKLE_BALL : CALM_BALL, lamp, phase).forEach((colour, index) => {
    if (!colour) return;
    ctx.fillStyle = rgba(colour, 1);
    ctx.fillRect((index % BALL_GRID) * cell, Math.floor(index / BALL_GRID) * cell, cell + 0.5, cell + 0.5);
  });
  // The grout between the mirrors.
  ctx.strokeStyle = "rgba(30, 0, 20, 0.3)";
  ctx.lineWidth = 0.5;
  for (let k = 1; k < BALL_GRID; k += 1) {
    ctx.beginPath();
    ctx.moveTo(k * cell, 0);
    ctx.lineTo(k * cell, SIZE);
    ctx.moveTo(0, k * cell);
    ctx.lineTo(SIZE, k * cell);
    ctx.stroke();
  }
  ctx.restore();
};

const usePrefersStill = () => {
  const query = () => (typeof window.matchMedia === "function" ? window.matchMedia(STILL) : null);
  const [still, setStill] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const media = query();
    if (!media) return;
    const changed = () => setStill(media.matches);
    media.addEventListener?.("change", changed);
    return () => media.removeEventListener?.("change", changed);
  }, []);
  return still;
};

export type LoaderProps = {
  /** What we are waiting for, as a short line ("Finding the party…"). */
  children: string;
};

/**
 * Render it while a screen waits, and stop rendering it when the wait is
 * over. It covers the phone screen (`.esc-app`), or the window where
 * there is none.
 */
export const Loader = ({ children }: LoaderProps) => {
  const { theme } = useDesignTheme();
  const sparkle = theme === "sparkle";
  const still = usePrefersStill();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let phase = 0.4;
    paintBall(canvas, sparkle, phase);
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
      paintBall(canvas, sparkle, phase);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [sparkle, still]);

  const screen = document.querySelector(".esc-app");
  const overlay = (
    // The overlay is the status: mounted with its text, so it is announced.
    <div className={`esc-loader${screen ? "" : " is-window"}`} role="status" aria-live="polite">
      <canvas ref={canvasRef} className="esc-loader-ball" width={SIZE} height={SIZE} aria-hidden="true" />
      <p className="esc-loader-text">{children}</p>
    </div>
  );
  return createPortal(overlay, screen ?? document.body);
};

export default Loader;
