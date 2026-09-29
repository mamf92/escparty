import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every page, component and hook ships with a test file (#140, Epic #53).
 *
 * A file under one of these folders needs a sibling `<name>.test.ts(x)`.
 * UNTESTED is the debt that predates the rule (#59): it may only shrink, so
 * when you add a test for one of these, delete its line here too (the second
 * test below fails until you do).
 */
const CHECKED_FOLDERS = ["src/pages", "src/components", "src/hooks"];

const UNTESTED = new Set([
  "src/components/MobileFrame.tsx",
  "src/pages/HostObserverView.tsx",
  "src/pages/Lobby.tsx",
  "src/pages/MidQuizScoreboard.tsx",
  "src/pages/MultiplayerLobby.tsx",
  "src/pages/QuizResults.tsx",
  "src/pages/Scoreboard.tsx",
  "src/pages/SelectDifficulty.tsx",
  "src/pages/UnderDevelopment.tsx",
]);

const root = join(__dirname, "..", "..");
const isTest = (name: string) => /\.test\.tsx?$/.test(name);
const isSource = (name: string) => /\.tsx?$/.test(name) && !isTest(name) && !name.endsWith(".d.ts");

const walk = (folder: string): string[] =>
  readdirSync(join(root, folder), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)],
  );

const allFiles = CHECKED_FOLDERS.flatMap(walk).map((file) => relative(root, join(root, file)));
const files = new Set(allFiles);
const hasTest = (file: string) => {
  const base = file.replace(/\.tsx?$/, "");
  return files.has(`${base}.test.ts`) || files.has(`${base}.test.tsx`);
};
const sources = allFiles.filter((file) => isSource(file.split("/").pop() ?? ""));

describe("test files", () => {
  it("every new page, component and hook has a test file", () => {
    const missing = sources.filter((file) => !hasTest(file) && !UNTESTED.has(file));
    expect(missing, "add a <name>.test.tsx next to each of these").toEqual([]);
  });

  it("the untested list only lists files that still exist and still lack a test", () => {
    const stale = [...UNTESTED].filter((file) => !files.has(file) || hasTest(file));
    expect(stale, "remove these from UNTESTED in src/test/testFiles.test.ts").toEqual([]);
  });
});
