import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, walk } from "./repoTree";

/**
 * Colours are decided in one place (#179, Epic #166).
 *
 * Every colour a screen paints comes from a token in src/design/tokens.css
 * (docs/design/design-system.md). So no `.ts`, `.tsx` or `.css` file under
 * src/ may, outside its comments:
 *
 * - write a hex colour (`#333`, `#2a2142`) or an `rgb()`/`rgba()`/`hsl()`/
 *   `hsla()` colour;
 * - read `theme.colors`, the retired styled-components palette;
 * - import the /fabric-ui demo's own palette.
 *
 * Exempt are src/design/, where the tokens and the design system's own
 * decoration are defined, and src/fabric-ui/, the self-contained /fabric-ui
 * WebGL demo, which keeps its own palette (palette.ts) and shaders and is
 * not a live screen. Test files are scanned too; only this file, whose
 * examples are the patterns it hunts, is skipped.
 *
 * Issue references are told apart from all-digit hex colours by how this
 * repo writes them: in parentheses after prose, "(#171)" or "(#178, Epic
 * #53)". Written any other way in code or a test name, "#179" reads as a
 * colour; put it in parentheses.
 *
 * A colour that no token gives is a new token, not an entry here. ALLOWED
 * lists the only exceptions as `file: literal`, each with the reason.
 */
const EXEMPT_FOLDERS = ["src/design/", "src/fabric-ui/"];
const SELF = "src/test/designGuard.test.ts";

// Empty today: the two literals left at the time (MobileFrame's home bar and
// its glow) moved onto --esc-home-bar and --esc-frame-glow.
const ALLOWED = new Set<string>([]);

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?)\(/g;
const THEME_COLORS = /\btheme\.colors\b/g;
const DEMO_PALETTE = /fabric-ui\/palette\b/g;

/**
 * `source` with every comment blanked to spaces (newlines kept, so line
 * numbers hold). CSS has only block comments; TS/TSX has line and block
 * comments, and strings, whose `//` (a URL) is not a comment. A template
 * literal is styled-components CSS, so a block comment inside one is
 * blanked too, while `${...}` in it is code again.
 */
const stripComments = (source: string, css: boolean): string => {
  const out = source.split("");
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };
  // What encloses the cursor: code, or a template literal. Each `${` in a
  // template pushes code; the `}` that closes it pops back to the template.
  const stack: Array<"code" | "template"> = ["code"];
  const braces: number[] = [0];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    const mode = css ? "css" : stack[stack.length - 1];
    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (mode === "code" && c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (mode === "code" && (c === '"' || c === "'")) {
      i += 1;
      while (i < source.length && source[i] !== c && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
      i += 1;
    } else if (mode === "code" && c === "`") {
      stack.push("template");
      braces.push(0);
      i += 1;
    } else if (mode === "code" && c === "{") {
      braces[braces.length - 1] += 1;
      i += 1;
    } else if (mode === "code" && c === "}") {
      if (braces[braces.length - 1] === 0 && stack.length > 1) {
        stack.pop();
        braces.pop();
      } else {
        braces[braces.length - 1] -= 1;
      }
      i += 1;
    } else if (mode === "template" && c === "\\") {
      i += 2;
    } else if (mode === "template" && c === "`") {
      stack.pop();
      braces.pop();
      i += 1;
    } else if (mode === "template" && c === "$" && next === "{") {
      stack.push("code");
      braces.push(0);
      i += 2;
    } else {
      i += 1;
    }
  }
  return out.join("");
};

/**
 * True when the hex `literal` at `index` in `line` is a colour, not an
 * issue reference "(#171)", "(#178, Epic #53)" or an HTML entity `&#160;`.
 */
const isColour = (line: string, literal: string, index: number) => {
  const before = line.slice(0, index);
  if (before.endsWith("&")) return false;
  if (/[a-fA-F]/.test(literal)) return true;
  // "(#171)" after prose, not "gradient(#000": a space or the line's start
  // before the paren, the reference first in it or after another one.
  return !/(^|\s)\((#\d+,\s*(Epic\s+)?)*$/.test(before);
};

/** Every colour, palette read and palette import on one cleaned line. */
const findingsOnLine = (line: string): string[] => [
  ...[...line.matchAll(HEX)].filter((m) => isColour(line, m[0], m.index ?? 0)).map((m) => m[0]),
  ...[...line.matchAll(COLOUR_FUNCTION)].map((m) => m[0]),
  ...[...line.matchAll(THEME_COLORS)].map((m) => m[0]),
  ...[...line.matchAll(DEMO_PALETTE)].map((m) => m[0]),
];

const scanned = walk("src")
  .filter((file) => /\.(tsx?|css)$/.test(file))
  .filter((file) => file !== SELF && !EXEMPT_FOLDERS.some((folder) => file.startsWith(folder)))
  .map((file) => ({
    file,
    lines: stripComments(readFileSync(posix.join(repoRoot, file), "utf8"), file.endsWith(".css")).split("\n"),
  }));

describe("design guard", () => {
  it("no colour literals, theme.colors or demo palette outside src/design and src/fabric-ui", () => {
    const found = scanned.flatMap(({ file, lines }) =>
      lines.flatMap((line, i) =>
        findingsOnLine(line)
          .filter((literal) => !ALLOWED.has(`${file}: ${literal}`))
          .map((literal) => `${file}:${i + 1}: ${literal}`),
      ),
    );
    expect(found, "use a token from src/design/tokens.css (add one there if none fits)").toEqual([]);
  });

  it("finds colours in code and CSS, and leaves comments, issue references and entities alone", () => {
    const hits = (source: string, css = false) => stripComments(source, css).split("\n").flatMap(findingsOnLine);

    expect(hits("const A = styled.div`\n  background-color: #333;\n`;")).toEqual(["#333"]);
    expect(hits("const A = styled.div`\n  border: 0.0625rem /* 1px */ solid #333;\n`;")).toEqual(["#333"]);
    expect(hits('const A = styled.div`\n  background: url("https://x/y.png") #000;\n`;')).toEqual(["#000"]);
    expect(hits("const a = { color: '#A56DC6' }; // was #fff")).toEqual(["#A56DC6"]);
    expect(hits("background: linear-gradient(#000, #111);", true)).toEqual(["#000", "#111"]);
    expect(hits("* { color: #000; }", true)).toEqual(["#000"]);
    expect(hits("box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);", true)).toEqual(["rgba("]);
    expect(hits("const A = styled.p`\n  color: ${({ theme }) => theme.colors.white};\n`;")).toEqual(["theme.colors"]);
    expect(hits('import { palette } from "../fabric-ui/palette";')).toEqual(["fabric-ui/palette"]);

    expect(hits("/* The quiz screen (#171): layout only */", true)).toEqual([]);
    expect(hits("// a URL https://x/#fff, and #333")).toEqual([]);
    expect(hits('it("adds a player (#131)", () => {});')).toEqual([]);
    expect(hits('describe("party (#178, Epic #53)", () => {});')).toEqual([]);
    expect(hits("<p>Score&#160;points</p>")).toEqual([]);
    expect(hits("const s = `a ${b ? `x${c}` : ''} d`; const t = '#ab'.length;")).toEqual([]);
  });

  it("the allow list only lists literals that are still there", () => {
    const stale = [...ALLOWED].filter((entry) => {
      const [file, literal] = entry.split(": ");
      const source = scanned.find((s) => s.file === file);
      return !source || !source.lines.some((line) => findingsOnLine(line).includes(literal));
    });
    expect(stale, "remove these from ALLOWED in src/test/designGuard.test.ts").toEqual([]);
  });
});
