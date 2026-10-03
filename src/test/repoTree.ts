import { readdirSync } from "node:fs";
import { posix } from "node:path";

/**
 * The repo's files, for the tests that police the tree as a whole
 * (testFiles.test.ts, designGuard.test.ts). Paths are repo-relative and
 * POSIX-style whatever the OS, so they compare equal to the literal paths
 * those tests list.
 */

// The repo root, from this file's own location rather than the working
// directory.
export const repoRoot = posix.join(__dirname.replace(/\\/g, "/"), "..", "..");

/** Every file under `folder` (repo-relative), recursively. */
export const walk = (folder: string): string[] =>
  readdirSync(posix.join(repoRoot, folder), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(posix.join(folder, entry.name)) : [posix.join(folder, entry.name)],
  );
