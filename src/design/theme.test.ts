import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import { isThemeName, THEME_STORAGE_KEY, THEMES } from "./theme";

describe("theme", () => {
  it("knows its themes and nothing else", () => {
    expect(THEMES).toEqual(["calm", "sparkle"]);
    expect(isThemeName("sparkle")).toBe(true);
    expect(isThemeName("disco")).toBe(false);
    expect(isThemeName(null)).toBe(false);
  });

  // index.html sets the theme before first paint with its own small script;
  // it has to read the same key and know the same opt-in theme.
  it("index.html's pre-paint script reads the same key and theme", () => {
    const root = posix.join(__dirname.replace(/\\/g, "/"), "..", "..");
    const html = readFileSync(posix.join(root, "index.html"), "utf8");
    expect(html).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
    for (const theme of THEMES) expect(html).toContain(`"${theme}"`);
  });
});
