# Testing

Unit and component tests run on **Vitest + React Testing Library**, on every
PR and push to `main` as part of `ci.yml`. A small **Playwright** end-to-end
suite in `e2e/` drives the real app in Chromium against the Firestore
emulator (`e2e.yml`, see "End-to-end" below). "Known gaps" below lists what's
still missing.

## Commands

- `npm run test:e2e` — the Playwright suite in `e2e/`, with the Firestore
  emulator started around it (needs a JDK); see "End-to-end" below.

- `npm test` — run the unit/component suite once (`vitest run`).
- `npm run test:watch` — the same suite in watch mode while developing.
- `npm run test:coverage` — the same run plus a coverage report, and the
  per-file floors described under "The coverage floor" below. `ci.yml`
  runs this on its Node 22 leg on every PR and push to `main` (#57), and
  plain `npm test` on Node 24; `npm test` skips coverage, so an ordinary
  local run stays fast.

`npm run lint`, `npm run build` and the tests (with the coverage floors on
Node 22) run in CI (`.github/workflows/ci.yml`) on every PR and push to
`main`. A red test run, or a file under its coverage floor, fails the
workflow.

**The deploy gate (#57, decided):** branch protection on `main`, not
Vercel's Ignored Build Step. Vercel deploys whatever lands on `main`, and it
can't see this workflow's result, so the way to keep a red build off `main`
is to require these checks before merging (#49): `build (22.x)` and
`build (24.x)` (build, lint, tests, coverage floors) and `gitleaks`, with
"Require branches to be up to date before merging" on, so two PRs that
are each green can't land a red `main` together. Don't require `Verify
rules against the emulator`: `firestore-rules.yml` only runs on PRs that
touch the rules or their scripts, so a required check would wait forever
on every other PR (it already blocks the rules deploy itself). Turning
this on is a repository setting only the owner can change; until then a
red run fails visibly but doesn't block the merge button.

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
`roomsFirestore.ts`. It is still a plain Node script, not part of Vitest.
Run it by hand with `npm run emulators &` then
`node scripts/verify-firestore-rules.mjs`. CI runs it on rules PRs as the
gate before a deploy (see "Deploying rules" in
`docs/agent/firestore-data-model.md`).
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
| `src/utils/quizTiming.ts` | 100% statements / branches / functions / lines |
| `src/utils/roomRoles.ts` | 100% statements / branches / functions / lines |
| `src/utils/multiplayerSession.ts` | 100% statements / branches / functions / lines |
| `src/utils/roomsFirestore.ts` | 100% statements / branches / functions / lines |
| `src/utils/QuizDataProvider.ts` | 98% statements & lines, 96% branches, 100% functions |

`QuizDataProvider.ts` is short of 100% only because of the `default:` arm in
`directImportQuizData`'s switch, which `loadQuizData` normalises away before
ever calling it.

Adding a file to the list is how coverage gets ratcheted up (#59 tracks the
backlog); **lowering a floor to make a run go green is not** — cover the new
branch instead. CI runs `npm run test:coverage`, so a PR that drops a
covered file under its floor fails. Nothing stops a PR from lowering a
floor in `vite.config.ts` or dropping a file from the list, so a reviewer
has to; a coverage-diff gate that would catch that is still open in #57.

## Known gaps

The unit harness is the first rung of the test-coverage epic (#53). Still
open at the time of writing:

- **Covered so far: the data/logic layer, and a test file per screen.**
  `src/utils/roomsFirestore.ts`, `src/utils/QuizDataProvider.ts`, the
  extracted scoring math in `src/utils/quizScoring.ts` and the multiplayer
  timing in `src/utils/quizTiming.ts` have unit tests with a coverage floor
  (#56, #62), as do `src/utils/roomRoles.ts` and
  `src/utils/multiplayerSession.ts` (#63); `src/hooks/useResumeRoom.ts` has hook tests (#63), without a
  floor. Every page, component and hook now has a test file except the
  ones listed in `UNTESTED` in `src/test/testFiles.test.ts`
  (the WebGL components in `src/fabric-ui/` and its `leva` debug-panel hook,
  plus the dead `useGameStore`), which is #59; a test file doesn't mean
  every flow in it is covered.
- **`Quiz.tsx` is mostly covered where it was extracted.** The scoring
  formula moved to `src/utils/quizScoring.ts` and the multiplayer timing to
  `src/utils/quizTiming.ts`, and both are tested directly.
  `src/components/Quiz.test.tsx` renders the component for answer selection
  (#22) and a failed multiplayer score write (#131), but its effects (the
  local timers, following the room, phase navigation) are still untested.
  Rungs 2 and 3 (#62, #63) are covered end to end by
  `e2e/lockstep.spec.ts` (#68). Don't read "scoring is
  covered" as "the quiz is covered".
- **Test failures don't block merge yet.** CI fails on them, but requiring
  the checks before merge is branch protection (#49), a setting only the
  owner can turn on; see "The deploy gate" above for the check names.
- **New pages, components and hooks need a test file.**
  `src/test/testFiles.test.ts` fails `npm test` when a module under
  `src/pages`, `src/components` or `src/hooks`, or a component (`.tsx`)
  or hook (`use*.ts`) under `src/fabric-ui` or `src/store`, has no sibling
  `*.test.ts(x)`/`*.spec.ts(x)`, except the pre-existing debt it lists (#140, #59). The
  steward treats missing tests as blocking (#58).
- **Pre-existing debt.** `Quiz.tsx` (~880 lines, the multiplayer branching
  logic) and `src/fabric-ui/` are the obvious first targets — tracked as #59.

Treat a PR checklist item about tests honestly: say what is and isn't
covered rather than checking the box to make the template look complete.

## End-to-end

`e2e/` holds Playwright specs (#55), run by `npm run test:e2e` locally and by
`.github/workflows/e2e.yml` on every PR and push to `main`.
`playwright.config.ts` starts Vite on port 5174 with a demo Firebase config
pointed at the emulator (`VITE_USE_FIREBASE_EMULATOR`), so nothing touches
production. Questions run on their real 15-second slots, so a spec takes a
minute or two; there is one worker and no retries (a flaky spec is a bug).

- `solo.spec.ts` — Home → quiz library → play Quick Fire solo → results →
  scoreboard, and the run is saved exactly once.
- `lockstep.spec.ts` — two browsers, the guest's network slowed: host and
  guest stay on the same question, both reach the mid-quiz break, and both
  resume together (#62, #63, #68).
- `builder.spec.ts` — build a quiz from three bank questions and one of
  your own with a break after question 3, save it, host a room with it and
  play it through alone, break included (#78).
- `party.spec.ts` — a scoreboard party: a host and two guests rate four
  acts of a semi, the host ticks a qualifier and opens the awards, and the
  guests see the Jedward Twins go to the two who rated alike (#91).
- `theme.spec.ts` — every scoreboard party screen measured and judged by
  the Calm skill's `tools/check.py` (#90; needs `python3`, which CI's
  runner has). See "Checking a live page" in `theming.md`.

On a failure CI uploads the HTML report and traces as the `playwright-report`
artifact.
