# Testing

Unit and component tests run on **Vitest + React Testing Library**. There is
no e2e runner yet, but the unit suite now runs on every PR and push to `main`
as part of `ci.yml` — see "Known gaps" below for what's still missing.

## Commands

- `npm test` — run the unit/component suite once (`vitest run`). This is the
  command `ci.yml` runs on every PR and push to `main`.
- `npm run test:watch` — the same suite in watch mode while developing.
- `npm run test:coverage` — the same run plus a coverage report, and the
  per-file floors described under "The coverage floor" below. Not part of
  `npm test`, so an ordinary run stays fast.

`npm run lint`, `npm run build`, and now `npm test` run in CI
(`.github/workflows/ci.yml`) on every PR and push to `main`. A red test run
fails the workflow, but nothing yet stops it from merging (that's branch
protection, #49) or from deploying (Vercel's GitHub integration deploys
`main` independently of this workflow's result — see #57 for the plan there).

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

Anything that talks to a *real* Firestore belongs against the local emulator
(`npm run emulators`), never production credentials.

`src/utils/roomsFirestore.test.ts` talks to neither: it mocks the Firebase
client SDK (`vi.mock("firebase/firestore", …)` plus `vi.mock("../firebase")`)
and asserts on the exact write payloads the module hands the SDK. That's a
deliberate split — the emulator needs a JDK and a running process, so an
emulator-bound unit suite would be un-runnable now that `npm test` is a CI
check. What the mocked suite pins down is the logic this module
adds *on top of* the SDK: the guards (`Firebase not initialized`, "game
already started", duplicate player, non-finite/negative/decreasing score),
the wrapped error messages pages match on, and which writes go through a
transaction rather than a read-modify-write. What it cannot tell you is
whether `firestore.rules` would accept those writes — that's the emulator's
job, below.

Two patterns in that file worth reusing:

- The `../firebase` mock exposes `db` through a **getter** over a mutable
  `vi.hoisted` object, so one test can drop it to `undefined` and exercise
  every function's "Firebase not initialized" guard without a second file.
- `runTransaction` is mocked to invoke its callback once with a fake
  `{ get, update }`. That means retry-on-conflict is *not* exercised — it's
  the SDK's behaviour, not this module's.

`scripts/verify-firestore-rules.mjs` exercises `firestore.rules` against a
running emulator using the same client SDK write paths as
`roomsFirestore.ts`. It is still a plain Node script, not wired into Vitest
or CI — run it by hand (`npm run emulators &` then
`node scripts/verify-firestore-rules.mjs`) after changing `firestore.rules`.
Folding it into the real suite is part of the rules work tracked in #50.

## The coverage floor

`npm run test:coverage` enforces per-file thresholds, configured under
`test.coverage` in `vite.config.ts`. They are deliberately **not** a
repo-wide percentage: a single repo number is met by testing easy UI and
leaving the risky layer bare, which is the state this epic exists to fix.
Coverage `include` therefore lists exactly the files with a floor:

| File | Floor |
| --- | --- |
| `src/utils/quizScoring.ts` | 100% statements / branches / functions / lines |
| `src/utils/roomsFirestore.ts` | 100% statements / branches / functions / lines |
| `src/utils/QuizDataProvider.ts` | 98% statements & lines, 96% branches, 100% functions |

`QuizDataProvider.ts` is short of 100% only because of the `default:` arm in
`directImportQuizData`'s switch, which `loadQuizData` normalises away before
ever calling it.

Adding a file to the list is how coverage gets ratcheted up (#59 tracks the
backlog); **lowering a floor to make a run go green is not** — cover the new
branch instead. `npm run test:coverage` itself is still not a CI check —
`ci.yml` runs the faster `npm test` — a coverage-diff gate is tracked in #57.

## Known gaps

The unit harness is the first rung of the test-coverage epic (#53). Still
open at the time of writing:

- **Covered so far: the data/logic layer, not the screens.**
  `src/utils/roomsFirestore.ts`, `src/utils/QuizDataProvider.ts` and the
  extracted scoring math in `src/utils/quizScoring.ts` have unit tests with
  a coverage floor (#56). `src/pages/Home.test.tsx` is still the only
  component test — every other page and `Quiz.tsx` itself are uncovered,
  which is #59.
- **`Quiz.tsx` is covered only where it was extracted.** The scoring formula
  moved to `src/utils/quizScoring.ts` and is tested directly; the component's
  own timer, question progression and multiplayer branching are not tested
  at all. Don't read "scoring is covered" as "the quiz is covered".
- **No e2e runner.** Playwright is #55.
- **Test failures don't block merge or deploy yet.** `npm test` runs in
  `ci.yml`, but nothing requires it to pass before merge (branch protection,
  #49) or before Vercel deploys `main` (no workflow chains to Vercel's
  GitHub integration today — #57 tracks the coverage-diff gate and the
  Vercel/branch-protection decision).
- **Review policy hasn't tightened yet.** `.claude/skills/steward/SKILL.md`
  and `.github/pull_request_template.md` still treat "no tests for a new
  component" as a known gap to note rather than a blocking finding. #58
  flips that; don't hand-wire it before then.
- **Pre-existing debt.** `Quiz.tsx` (728 lines, the multiplayer branching
  logic) and `src/fabric-ui/` are the obvious first targets — tracked as #59.

Until #58 lands, treat a PR checklist item about tests honestly: say what is
and isn't covered rather than checking the box to make the template look
complete.
