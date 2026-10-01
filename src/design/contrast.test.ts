import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The design system's contrast floor (docs/design/design-system.md,
 * "Accessibility"), checked against the token values themselves so a colour
 * change can't quietly break it: body text 4.5:1, markers and focus 3:1.
 */
const here = __dirname.replace(/\\/g, "/");
const tokens = readFileSync(posix.join(here, "tokens.css"), "utf8");
const sparkle = readFileSync(posix.join(here, "sparkle.css"), "utf8");

const block = (selector: string) => {
  const start = tokens.indexOf(selector);
  return tokens.slice(start, tokens.indexOf("}", start));
};
const token = (css: string, name: string) => {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match) throw new Error(`${name} isn't a plain hex colour`);
  return match[1];
};

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb => top.map((c, i) => c * alpha + bottom[i] * (1 - alpha)) as Rgb;
const luminance = (c: Rgb) => {
  const [r, g, b] = c.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const calm = block(':root[data-theme="calm"]');
const glam = block(':root[data-theme="sparkle"] {');

// Calm's raised face: 5% white over its ground.
const calmFace = over([255, 255, 255], 0.05, rgb("#190c31"));
// Sparkle's faces: the brightest stop of each sheet, under its brightest sequin.
const faceStops = (name: string) => {
  const start = sparkle.indexOf(`${name}:`);
  const decl = sparkle.slice(start, sparkle.indexOf(";", start));
  return [...decl.matchAll(/#[0-9a-f]{6}/gi)].map(m => rgb(m[0]));
};
const brightest = (stops: Rgb[]) => stops.reduce((a, b) => (luminance(a) > luminance(b) ? a : b));
const sequin = (face: Rgb) => over([255, 255, 255], 0.3, face);

describe("design token contrast", () => {
  it("Calm: text on a control and on the screen holds 4.5:1", () => {
    const ink = rgb(token(calm, "--esc-ink"));
    expect(ratio(ink, calmFace)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(ink, rgb(token(calm, "--esc-screen")))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(rgb(token(calm, "--esc-title")), rgb(token(calm, "--esc-screen")))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(rgb(token(calm, "--esc-link")), rgb(token(calm, "--esc-screen")))).toBeGreaterThanOrEqual(4.5);
  });

  it("Calm: markers and the focus ring hold 3:1", () => {
    for (const name of ["--esc-correct", "--esc-wrong", "--esc-focus"]) {
      expect(ratio(rgb(token(calm, name)), calmFace), name).toBeGreaterThanOrEqual(3);
    }
  });

  it("Sparkle: text holds 4.5:1 on every sequin face, even over a sequin", () => {
    const ink = rgb(token(glam, "--esc-ink"));
    for (const name of ["--lyc-face", "--lyc-face-hover", "--lyc-face-down"]) {
      expect(ratio(ink, sequin(brightest(faceStops(name)))), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("Sparkle: markers and the focus ring hold 3:1 on the pane they sit on", () => {
    // Markers sit in the pane's gutter and the ring 3px outside a control,
    // so both are read against the pane: rgba(46,8,62,.94) over the ground's
    // brightest stop.
    const pane = over([46, 8, 62], 0.94, rgb("#3b0a52"));
    for (const name of ["--esc-correct", "--esc-wrong", "--esc-focus"]) {
      expect(ratio(rgb(token(glam, name)), pane), name).toBeGreaterThanOrEqual(3);
    }
  });
});
