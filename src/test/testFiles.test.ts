import { readdirSync } from "node:fs";
import { posix } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every page, component and hook ships with a test file (#140, Epic #53).
 *
 * Every `.ts`/`.tsx` module under src/pages, src/components and src/hooks
 * needs a sibling `<name>.test.ts(x)` or `<name>.spec.ts(x)`. In
 * src/fabric-ui and src/store only components (`.tsx`) and hooks (`use*.ts`)
 * do: their plain `.ts` files are shader constants and presets.
 * UNTESTED is the debt that predates the rule (#59): it may only shrink, so
 * when you add a test for one of these, delete its line here too (the second
 * test below fails until you do).
 */
const CHECKED_FOLDERS = ["src/pages", "src/components", "src/hooks", "src/fabric-ui", "src/store"];

const UNTESTED = new Set([
  "src/components/MobileFrame.tsx",
  "src/fabric-ui/CalmSurface.tsx",
  "src/fabric-ui/CameraRig.tsx",
  "src/fabric-ui/FabricQuizDemo.tsx",
  "src/fabric-ui/FabricSurface.tsx",
  "src/fabric-ui/useFabricControls.ts",
  "src/fabric-ui/useParallax.ts",
  "src/pages/HostObserverView.tsx",
  "src/pages/Lobby.tsx",
  "src/pages/MidQuizScoreboard.tsx",
  "src/pages/QuizResults.tsx",
  "src/pages/Scoreboard.tsx",
  "src/pages/UnderDevelopment.tsx",
  "src/store/useGameStore.ts",
]);

// The repo root, from this file's own location rather than the working
// directory. Paths are kept POSIX-style whatever the OS, so they match
// UNTESTED.
const root = posix.join(__dirname.replace(/\\/g, "/"), "..", "..");
const isTest = (name: string) => /\.(test|spec)\.tsx?$/.test(name);
const EVERY_MODULE = ["src/pages/", "src/components/", "src/hooks/"];
const needsTest = (file: string) => {
  const name = posix.basename(file);
  if (isTest(name) || name.endsWith(".d.ts") || !/\.tsx?$/.test(name)) return false;
  return EVERY_MODULE.some((folder) => file.startsWith(folder)) || /\.tsx$/.test(name) || /^use[A-Z]/.test(name);
};

const walk = (folder: string): string[] =>
  readdirSync(posix.join(root, folder), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(posix.join(folder, entry.name)) : [posix.join(folder, entry.name)],
  );

const allFiles = CHECKED_FOLDERS.flatMap(walk);
const files = new Set(allFiles);
const hasTest = (file: string) => {
  const base = file.replace(/\.tsx?$/, "");
  return ["test.ts", "test.tsx", "spec.ts", "spec.tsx"].some((suffix) => files.has(`${base}.${suffix}`));
};
const sources = allFiles.filter(needsTest);

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
