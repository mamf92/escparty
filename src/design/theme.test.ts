import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import { isThemeName, THEME_STORAGE_KEY, THEMES } from "./theme";

const root = posix.join(__dirname.replace(/\\/g, "/"), "..", "..");
const html = readFileSync(posix.join(root, "index.html"), "utf8");
// The inline script that sets the theme before first paint.
const prePaint = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(code => code.includes("dataset.theme"));

/** Runs the pre-paint script against a fake storage and <html>; returns the theme it set. */
const runPrePaint = (getItem: (key: string) => string | null) => {
  const documentElement = { dataset: {} as Record<string, string> };
  new Function("localStorage", "document", prePaint!)({ getItem }, { documentElement });
  return documentElement.dataset.theme;
};

describe("theme", () => {
  it("knows its themes and nothing else", () => {
    expect(THEMES).toEqual(["calm", "sparkle"]);
    expect(isThemeName("sparkle")).toBe(true);
    expect(isThemeName("disco")).toBe(false);
    expect(isThemeName(null)).toBe(false);
  });

  // index.html sets the theme before first paint with its own small script;
  // it has to agree with readStoredTheme, and Calm has to stay the landing state.
  describe("index.html's pre-paint script", () => {
    it("exists", () => expect(prePaint).toBeDefined());

    it("lands on Calm when nothing, or nothing valid, is stored", () => {
      expect(runPrePaint(() => null)).toBe("calm");
      expect(runPrePaint(() => "disco")).toBe("calm");
    });

    it("applies the stored Sparkle, read from the same key the app writes", () => {
      expect(runPrePaint(key => (key === THEME_STORAGE_KEY ? "sparkle" : null))).toBe("sparkle");
    });

    it("falls back to Calm when storage throws", () => {
      expect(runPrePaint(() => { throw new Error("blocked"); })).toBe("calm");
    });
  });
});
