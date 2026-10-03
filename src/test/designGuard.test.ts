import { readdirSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Colours are decided in one place (#179, Epic #166).
 *
 * Every colour a screen paints comes from a token in src/design/tokens.css
 * (docs/design/design-system.md). So no `.ts`, `.tsx` or `.css` file under
 * src/ may write a hex colour literal (`#fff`, `#2a2142`, `#ffffff80`) or
 * read `theme.colors`, the retired styled-components palette, except:
 *
 * - src/design/, where the tokens and the design system's own decoration
 *   are defined;
 * - src/fabric-ui/, the self-contained /fabric-ui WebGL demo, which keeps
 *   its own palette (palette.ts) and shaders and never renders a live page.
 *
 * A colour that no token gives is a new token, not an entry here. ALLOWED
 * lists the only exceptions, one per line with the reason; keep it short.
 * Test files are scanned too, so a test can't quietly assert on a literal;
 * only this file, whose examples are the patterns it hunts, is skipped.
 */
const EXEMPT_FOLDERS = ["src/design/", "src/fabric-ui/"];

// `${file}: ${literal}` pairs that may stay, each with why.
// Empty today: the one literal left at the time (MobileFrame's home bar)
// moved onto --esc-home-bar.
const ALLOWED = new Set<string>([]);

// A hex colour: # then 3, 4, 6 or 8 hex digits, not followed by another
// word character. An issue reference like (#179) matches too; isColour
// tells the two apart.
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const THEME_COLORS = /\btheme\.colors\b/;

const root = posix.join(__dirname.replace(/\\/g, "/"), "..", "..");

const walk = (folder: string): string[] =>
  readdirSync(posix.join(root, folder), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(posix.join(folder, entry.name)) : [posix.join(folder, entry.name)],
  );

const SELF = "src/test/designGuard.test.ts";
const scanned = walk("src").filter(
  (file) => /\.(tsx?|css)$/.test(file) && file !== SELF && !EXEMPT_FOLDERS.some((folder) => file.startsWith(folder)),
);

/**
 * True when `literal`, found at `index` in `line`, reads as a colour rather
 * than an issue or PR number like (#171). A match with a letter a-f is
 * always a colour. An all-digit one (`#333`) is a reference instead when it
 * sits in a comment or straight after "(", as every issue reference here
 * does.
 */
const isColour = (line: string, literal: string, index: number) => {
  if (/[a-fA-F]/.test(literal)) return true;
  const before = line.slice(0, index);
  if (/^\s*(\/\/|\/\*|\*)/.test(before) || before.includes("//") || before.includes("/*")) return false;
  return !before.endsWith("(");
};

const findings = (pattern: "hex" | "theme.colors") =>
  scanned.flatMap((file) =>
    readFileSync(posix.join(root, file), "utf8")
      .split("\n")
      .flatMap((line, i) => {
        if (pattern === "theme.colors") {
          return THEME_COLORS.test(line) ? [`${file}:${i + 1}: theme.colors`] : [];
        }
        return [...line.matchAll(HEX)]
          .filter((match) => isColour(line, match[0], match.index ?? 0))
          .filter((match) => !ALLOWED.has(`${file}: ${match[0]}`))
          .map((match) => `${file}:${i + 1}: ${match[0]}`);
      }),
  );

describe("design guard", () => {
  it("no hex colour literals outside src/design and src/fabric-ui", () => {
    expect(findings("hex"), "use a token from src/design/tokens.css (add one there if none fits)").toEqual([]);
  });

  it("nothing reads the retired theme.colors palette", () => {
    expect(findings("theme.colors"), "use a token from src/design/tokens.css").toEqual([]);
  });

  it("catches a hex colour and tells it from an issue number", () => {
    const hits = (line: string) =>
      [...line.matchAll(HEX)].filter((match) => isColour(line, match[0], match.index ?? 0)).map((m) => m[0]);

    expect(hits("  background-color: #333;")).toEqual(["#333"]);
    expect(hits('  color: "#A56DC6",')).toEqual(["#A56DC6"]);
    expect(hits("  border: 1px solid #fff;")).toEqual(["#fff"]);
    expect(hits("  box-shadow: 0 0 0 1px #000;")).toEqual(["#000"]);
    expect(hits("  fill={'#000000'}")).toEqual(["#000000"]);
    expect(hits("// The quiz screen (#171): layout only")).toEqual([]);
    expect(hits("it(\"adds a player (#131)\", () => {")).toEqual([]);
  });

  it("the allow list only lists literals that are still there", () => {
    const stale = [...ALLOWED].filter((entry) => {
      const [file, literal] = entry.split(": ");
      try {
        return !readFileSync(posix.join(root, file), "utf8").includes(literal);
      } catch {
        return true;
      }
    });
    expect(stale, "remove these from ALLOWED in src/test/designGuard.test.ts").toEqual([]);
  });
});
