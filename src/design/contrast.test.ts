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
const tileOf = (name: string) => {
  const m = calm.match(new RegExp(`${name}:\\s*rgba\\((\\d+), (\\d+), (\\d+), ([\\d.]+)\\)`));
  if (!m) throw new Error(`${name} isn't an rgba() colour`);
  return { colour: [+m[1], +m[2], +m[3]] as Rgb, alpha: +m[4] };
};

// The brightest spot of the stage's gradient in either theme.
const stage = brightest([...stops(calm, "--esc-screen"), ...stops(glam, "--esc-screen")]);
/*
 * Over that gradient Stage.tsx paints the ball's spots of light and, in
 * Sparkle, sequin highlights, which can be anything up to white. So a tile
 * is checked frosted over white, and text straight on the stage leans on
 * its dark halo (`--esc-stage-text-shadow`) wherever a spot lands.
 */
const frosted = (name: string) => {
  const t = tileOf(name);
  return over(t.colour, t.alpha, [255, 255, 255]);
};
const darkTile = frosted("--esc-tile");
const hoverTile = frosted("--esc-tile-hover");
const sunkTile = frosted("--esc-tile-sunk");
const halo = token("--esc-halo");

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

  it("stage text holds 4.5:1 on the stage, in its halo over a spot of light, and on a tile over one", () => {
    for (const name of ["--esc-ink", "--esc-ink-muted", "--esc-stage-ink", "--esc-stage-ink-muted", "--esc-title", "--esc-link"]) {
      expectText(token(name), stage, `${name} on the stage`);
      expectText(token(name), halo, `${name} in its halo`);
      expectText(token(name), darkTile, `${name} on a tile`);
      expectText(token(name), hoverTile, `${name} on a hovered tile`);
      expectText(token(name), sunkTile, `${name} on a sunk tile`);
    }
    for (const name of ["--esc-focus", "--esc-correct", "--esc-wrong", "--esc-stage-correct", "--esc-stage-wrong"]) {
      expectText(token(name), stage, `${name} on the stage`, 3);
      expectText(token(name), darkTile, `${name} on a tile`, 3);
    }
  });

  it("stage text keeps a solid outline in the halo colour in both themes", () => {
    // Unblurred copies a pixel out on all four diagonals: every glyph edge
    // meets the halo, so the ink-on-halo ratio above is the one a reader gets.
    for (const css of [calm, glam]) {
      const start = css.indexOf("--esc-stage-text-shadow:");
      const shadow = css.slice(start, css.indexOf(";", start));
      for (const [x, y] of [["-1px", "-1px"], ["1px", "-1px"], ["-1px", "1px"], ["1px", "1px"]]) {
        expect(shadow).toContain(`${x} ${y} 0 var(--esc-halo)`);
      }
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
    // The focus ring stays visible on the stage around a white button or a pink one,
    // and against the dark rings that frame it over a spot of light.
    expectText(token("--esc-focus"), token("--esc-bg"), "focus on the stage", 3);
    expectText(token("--esc-focus"), halo, "focus against its dark rings", 3);
  });
});
