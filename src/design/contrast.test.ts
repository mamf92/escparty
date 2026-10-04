import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The design system's contrast floor (docs/design/design-system.md,
 * "Accessibility"), checked against the token values themselves so a colour
 * change can't quietly break it: text 4.5:1, markers and focus 3:1, on every
 * material it can sit on (the stage, a dark tile, a white button or card, a
 * blush control, the black button and a chosen pink one).
 */
const here = __dirname.replace(/\\/g, "/");
const tokens = readFileSync(posix.join(here, "tokens.css"), "utf8");

const block = (selector: string) => {
  const start = tokens.indexOf(selector);
  return tokens.slice(start, tokens.indexOf("}", start));
};
const calm = block(':root[data-theme="calm"]');
const glam = block(':root[data-theme="sparkle"] {');

const token = (name: string) => {
  const match = calm.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"));
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
const brightest = (stops: Rgb[]) => stops.reduce((a, b) => (luminance(a) > luminance(b) ? a : b));
const stops = (css: string, name: string) => {
  const start = css.indexOf(`${name}:`);
  if (start < 0) throw new Error(`${name} isn't declared`);
  return [...css.slice(start, css.indexOf(";", start)).matchAll(/#[0-9a-f]{6}/gi)].map(m => rgb(m[0]));
};
const tile = (() => {
  const m = calm.match(/--esc-tile:\s*rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/);
  if (!m) throw new Error("--esc-tile isn't an rgba() colour");
  return { colour: [+m[1], +m[2], +m[3]] as Rgb, alpha: +m[4] };
})();

// The brightest spot of the stage in either theme: where text is hardest to read.
const stage = brightest([...stops(calm, "--esc-screen"), ...stops(glam, "--esc-screen"), rgb(token("--esc-stage-top"))]);
// A dark tile, frosted over that brightest spot.
const darkTile = over(tile.colour, tile.alpha, stage);

const expectText = (fg: Rgb | string, bg: Rgb | string, label: string, floor = 4.5) => {
  const a = typeof fg === "string" ? rgb(fg) : fg;
  const b = typeof bg === "string" ? rgb(bg) : bg;
  expect(ratio(a, b), label).toBeGreaterThanOrEqual(floor);
};

describe("design token contrast", () => {
  it("the two themes share every material but the stage", () => {
    const names = [...glam.matchAll(/(--esc-[a-z0-9-]+):/g)].map(m => m[1]);
    expect(names.sort()).toEqual(["--esc-screen", "--esc-stage-text-shadow"]);
  });

  it("stage text holds 4.5:1 on the brightest spot of the stage, and on a dark tile", () => {
    for (const name of ["--esc-ink", "--esc-ink-muted", "--esc-stage-ink", "--esc-stage-ink-muted", "--esc-title", "--esc-link"]) {
      expectText(token(name), stage, `${name} on the stage`);
      expectText(token(name), darkTile, `${name} on a tile`);
    }
    for (const name of ["--esc-focus", "--esc-correct", "--esc-wrong", "--esc-stage-correct", "--esc-stage-wrong"]) {
      expectText(token(name), stage, `${name} on the stage`, 3);
      expectText(token(name), darkTile, `${name} on a tile`, 3);
    }
  });

  it("card ink holds 4.5:1 on a white card, a white button and a blush control or well", () => {
    for (const bg of ["--esc-card", "--esc-button", "--esc-button-hover", "--esc-blush", "--esc-blush-hover"]) {
      for (const name of ["--esc-card-ink", "--esc-card-ink-muted", "--esc-card-label"]) {
        expectText(token(name), token(bg), `${name} on ${bg}`);
      }
      for (const name of ["--esc-card-focus", "--esc-card-correct", "--esc-card-wrong"]) {
        expectText(token(name), token(bg), `${name} on ${bg}`, 3);
      }
    }
    expectText(token("--esc-on-button"), token("--esc-button"), "a button's label");
  });

  it("the black button and the chosen pink hold 4.5:1 for their white labels", () => {
    for (const bg of ["--esc-primary", "--esc-primary-hover"]) {
      expectText(token("--esc-on-primary"), token(bg), `on ${bg}`);
    }
    expectText(token("--esc-on-accent"), token("--esc-accent"), "a chosen label");
    expectText(token("--esc-on-accent-muted"), token("--esc-accent"), "a chosen sub line");
    // The focus ring stays visible on the stage around a white button or a pink one.
    expectText(token("--esc-focus"), token("--esc-bg"), "focus on the stage", 3);
  });
});
