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

const declaration = (css: string, name: string) => {
  const start = css.indexOf(`${name}:`);
  if (start < 0) throw new Error(`${name} isn't declared`);
  return css.slice(start, css.indexOf(";", start));
};
const hexes = (decl: string) => [...decl.matchAll(/#[0-9a-f]{6}/gi)].map(m => rgb(m[0]));
const rgbas = (decl: string) => [...decl.matchAll(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g)]
  .map(m => ({ colour: [+m[1], +m[2], +m[3]] as Rgb, alpha: +m[4] }));
const brightest = (stops: Rgb[]) => stops.reduce((a, b) => (luminance(a) > luminance(b) ? a : b));

/*
 * The brightest spot of a layered background: each solid stop, and each
 * translucent dot or pool laid over the brightest solid stop (the worst
 * case: a sequin or a spotlight may sit right where the base is lightest).
 */
const peak = (themeBlock: string, name: string) => {
  const decl = declaration(themeBlock, name);
  const solid = hexes(decl);
  const base = brightest(solid);
  return brightest([...solid, ...rgbas(decl).map(({ colour, alpha }) => over(colour, alpha, base))]);
};

const TEXT = ["--esc-ink", "--esc-ink-muted"];
const MARKS = ["--esc-correct", "--esc-wrong", "--esc-focus"];

describe("design token contrast", () => {
  it("Calm: every surface is the background colour, with no frame to read against", () => {
    expect(token(calm, "--esc-bg")).toBe(token(calm, "--esc-surface"));
  });

  it("Calm: text holds 4.5:1 on the background and on every face", () => {
    for (const face of ["--esc-bg", "--esc-face-hover", "--esc-face-pressed"]) {
      for (const name of [...TEXT, "--esc-accent", "--esc-link", "--esc-title"]) {
        expect(ratio(rgb(token(calm, name)), rgb(token(calm, face))), `${name} on ${face}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("Calm: markers and the focus ring hold 3:1 on the background", () => {
    for (const name of MARKS) {
      expect(ratio(rgb(token(calm, name)), rgb(token(calm, "--esc-bg"))), name).toBeGreaterThanOrEqual(3);
    }
  });

  it("Sparkle: text holds 4.5:1 on every sequin face, even over a sequin", () => {
    for (const face of ["--esc-face", "--esc-face-hover", "--esc-face-pressed"]) {
      for (const name of TEXT) {
        expect(ratio(rgb(token(glam, name)), peak(glam, face)), `${name} on ${face}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // A chosen key's label is gold on the gold side of its sequins.
    expect(ratio(rgb(token(glam, "--esc-accent")), peak(glam, "--esc-face-pressed"))).toBeGreaterThanOrEqual(4.5);
  });

  it("Sparkle: titles, links, markers and focus hold up on the brightest spot of the stage", () => {
    const stage = peak(glam, "--esc-screen");
    for (const name of [...TEXT, "--esc-title", "--esc-link"]) {
      expect(ratio(rgb(token(glam, name)), stage), name).toBeGreaterThanOrEqual(4.5);
    }
    for (const name of MARKS) {
      expect(ratio(rgb(token(glam, name)), stage), name).toBeGreaterThanOrEqual(3);
    }
  });
});
