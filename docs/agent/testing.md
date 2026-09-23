# Testing

Unit and component tests run on **Vitest + React Testing Library**. There is
no e2e runner yet, and the unit suite is not yet a required CI check — see
"Known gaps" below for which issue covers each.

## Commands

- `npm test` — run the unit/component suite once (`vitest run`). This is the
  command CI will call once the suite is wired in.
- `npm run test:watch` — the same suite in watch mode while developing.

`npm run lint` and `npm run build` still run in CI
(`.github/workflows/ci.yml`) on every PR and push to `main`.

## Where tests live

Tests sit next to the code they cover, as `<Name>.test.tsx` /
`<name>.test.ts` (e.g. `src/pages/Home.test.tsx`). Only files matching
`src/**/*.{test,spec}.{ts,tsx}` are collected, so a helper file under
`src/test/` is never mistaken for a suite.

Shared harness code lives in `src/test/`:

- `setup.ts` — loaded once per test file. Registers jest-dom's matchers and
  runs Testing Library's `cleanup` after each test.
- `test-utils.tsx` — `renderWithProviders`, plus re-exports of `screen`,
  `waitFor`, `within` and `userEvent` so a test file needs one import.

## Rendering a component

Every screen in this app is mounted under two providers in `App.tsx`:
styled-components' `ThemeProvider` and the router. A component that reads
`theme.colors.*` in a styled block, or calls `useNavigate`, throws without
them — so render through the helper rather than RTL's `render` directly:

```tsx
import { renderWithProviders, screen } from "../test/test-utils";

renderWithProviders(<Lobby />, { initialEntries: ["/lobby"] });
```

The helper uses `MemoryRouter`, not the app's `HashRouter`: the history lives
in memory, so a test can start on any route without touching
`window.location`. To assert on navigation, render a small `<Routes>` tree
and check that the destination rendered — `src/pages/Home.test.tsx` does
exactly that.

## How the harness is configured

The Vitest config is the `test` block in `vite.config.ts`, so tests share the
app's React plugin and path resolution instead of a second, drifting config.
Two choices worth knowing:

- `environment: 'jsdom'` — component tests need a DOM.
- `globals: false` — tests import `describe`/`it`/`expect` from `vitest`
  explicitly. The trade-off is that RTL's automatic cleanup (which only
  happens with globals on) is wired manually in `src/test/setup.ts`.

`vite.config.ts`'s `base` path is untouched by any of this and must stay that
way — it's what makes the Vercel deploy's assets resolve (see `CLAUDE.md`).

## Firestore-touching tests

Anything that talks to Firestore belongs against the local emulator
(`npm run emulators`), never production credentials.

`scripts/verify-firestore-rules.mjs` exercises `firestore.rules` against a
running emulator using the same client SDK write paths as
`roomsFirestore.ts`. It is still a plain Node script, not wired into Vitest
or CI — run it by hand (`npm run emulators &` then
`node scripts/verify-firestore-rules.mjs`) after changing `firestore.rules`.
Folding it into the real suite is part of the rules work tracked in #50.

## Known gaps

The unit harness is the first rung of the test-coverage epic (#53). Still
open at the time of writing:

- **Coverage is one smoke test.** `src/pages/Home.test.tsx` proves the
  harness works end to end; the actually risky code (`roomsFirestore.ts`,
  the scoring math in `Quiz.tsx`, `QuizDataProvider.ts`) has no tests yet —
  that's #56.
- **No e2e runner.** Playwright is #55.
- **Not enforced by CI.** `npm test` doesn't run in `ci.yml` yet, and the
  Vercel deploy still fires on push to `main` regardless of test state —
  that's #57.
- **Review policy hasn't tightened yet.** `.claude/skills/steward/SKILL.md`
  and `.github/pull_request_template.md` still treat "no tests for a new
  component" as a known gap to note rather than a blocking finding. #58
  flips that; don't hand-wire it before then.
- **Pre-existing debt.** `Quiz.tsx` (728 lines, the multiplayer branching
  logic) and `src/fabric-ui/` are the obvious first targets — tracked as #59.

Until #58 lands, treat a PR checklist item about tests honestly: say what is
and isn't covered rather than checking the box to make the template look
complete.
