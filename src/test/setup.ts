// Vitest setup, loaded once per test file (see `test.setupFiles` in
// vite.config.ts).
//
// `globals` is deliberately off, so tests import `describe`/`it`/`expect`
// from `vitest` explicitly. Two consequences handled here:
//   - jest-dom's matchers are registered through its `/vitest` entry point,
//     which also augments Vitest's `Assertion` type.
//   - React Testing Library only auto-cleans up when globals are on, so the
//     unmount has to be wired manually or one test's DOM leaks into the next.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
