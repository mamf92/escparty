# CLAUDE.md

Read this every session — it's short on purpose. For anything deeper, follow
the links instead of re-deriving it by grepping the codebase.

## Stack

React 19 + Vite + TypeScript, styled-components for styling, react-router
(`HashRouter` — routes are `#/...`, a holdover from the original GitHub
Pages deploy that every existing link now depends on).
Backend is Firebase Firestore via the client SDK: state syncs through
`onSnapshot` listeners, there are no WebSockets, and the only Firestore
transactions are `updatePlayerScore`, `advanceQuestion` and
`resumeAfterMidQuiz` — everything else is a plain read/write (see
`docs/agent/firestore-data-model.md`).

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — `tsc -b` then `vite build`.
- `npm run lint` — ESLint; CI runs this and `build` on every PR.
- `npm test` — Vitest unit/component suite (`vitest run`); `npm run
  test:watch` for watch mode, `npm run test:coverage` for the per-file
  coverage floors.
- `npm run preview` — serve the production build locally.
- `npm run emulators` — start the local Firestore emulator (needs a JDK).

Unit/component tests run on Vitest + React Testing Library. Covered today:
`roomsFirestore.ts`, `QuizDataProvider.ts`, `quizScoring.ts` and
`quizTiming.ts` (with per-file coverage floors), plus one `Home.tsx` smoke
test — every other page,
and `Quiz.tsx` itself, is uncovered. `npm test` now runs in `ci.yml`, but a
red run doesn't yet block merge or deploy (see #57). See
`docs/agent/testing.md` before assuming a given flow is covered.

## Where things live

`src/pages/` holds most screens; `src/components/` currently has only
`MobileFrame.tsx` (the phone-frame chrome) and `Quiz.tsx` (~920 lines — the
biggest single file in the app, despite the folder name most "components"
are pages). `src/fabric-ui/` is a self-contained WebGL rendering module for
the Sparkle theme, lazy-loaded behind its own route. `src/store/` has one
file, `useGameStore.ts`, which is dead code (see Landmines). `src/utils/`
has `roomsFirestore.ts` (the Firestore API), `QuizDataProvider.ts` (quiz
question loading), `quizScoring.ts` (the answer-scoring math, extracted from
`Quiz.tsx` so it can be tested directly), `quizTiming.ts` (multiplayer
question timing and what follows each question), and `pathUtils.ts`
(base-path/env helpers). Full layout:
`docs/agent/architecture.md`.

## Design themes

Two design languages. Inside the `src/fabric-ui/` demo they render from the
same `OverlayItem[]` content model so they never disagree on *what* they
show, only *how* — see `docs/agent/theming.md` for how that scopes to live
pages, which today adopt Calm's CSS directly rather than going through
`OverlayItem`:

- **Calm** — dark violet CSS surface, no motion beyond a press, the default
  and accessible landing experience. Skill: `.claude/skills/escparty-calm/`.
- **Sparkle** — glittering WebGL sequin membrane with device/pointer
  parallax, opt-in only, never the landing state. Skill:
  `.claude/skills/escparty-sparkle/`.

One paragraph bridging the two, without repeating the skills' content:
`docs/agent/theming.md`.

## Do not change without explicit instruction

- `vite.config.ts`'s `base` path — it resolves to `/` when Vercel builds
  (`VERCEL=1`), which is what makes the deployed assets load from the domain
  root. Changing it breaks the deploy.
- `roomsFirestore.ts`'s exported function signatures — multiple pages depend
  on this exact API; change it as a coordinated migration, not a drive-by edit.
- `firestore.rules` at the repo root — production access control for every
  multiplayer room, and **merging a change to it deploys it**. Treat any
  change here as high risk; how the deploy works and what it guards against
  is in "Deploying rules" in `docs/agent/firestore-data-model.md`.

If you're unsure whether a change affects hosting, env vars, or Firestore
rules, ask before making it rather than guessing.

## Known landmines

- `useGameStore.ts` (Zustand) is **not imported anywhere** outside itself —
  it's dead code. Session state is instead duplicated ad hoc via
  `localStorage`/`sessionStorage`/router `location.state` across
  `MultiplayerLobby.tsx`, `Lobby.tsx`, `Quiz.tsx`, `MidQuizScoreboard.tsx`,
  `HostObserverView.tsx`, and `QuizResults.tsx`. Don't assume the store is
  wired in; don't add to it without a migration plan.
- In multiplayer, `Room.phase`/`currentQuestionIndex`/`phaseStartedAt` are
  **the** source of truth for which question is showing (#62). Don't
  reintroduce a locally incremented index or a local countdown there, or a
  timed signal like the old `continueReady` flag (#63): clients react to the
  room's state, which a slow client can't miss.
- Writes several clients make at once must not be a plain read-modify-write.
  `updatePlayerScore`, `advanceQuestion` and `resumeAfterMidQuiz` are
  transactions and `markPlayerAtMidQuiz` is an `arrayUnion` — all players
  reach the mid-quiz break on the same snapshot (#62), and the old
  read-modify-write there dropped player IDs. Don't revert any of them to a
  `getDoc`/`updateDoc` pair.

## The dev loop

Pick a task → plan if it's non-trivial → execute on a branch → commit →
open a PR → get it reviewed → fix what review and CI raise → merge only
after review approves. Full policy: `CONTRIBUTING.md`, including when an
agent may merge its own PR (section 8). An agent following this loop
end-to-end should use the `steward` skill
(`.claude/skills/steward/SKILL.md`).

## Deep dives (read only when the task touches that area)

- `docs/agent/architecture.md` — detailed `src/` layout and module boundaries.
- `docs/agent/firestore-data-model.md` — the `Room`/`Player` shape, which
  writes are safe vs. race-prone, the missing-rules-file gap.
- `docs/agent/multiplayer-sync.md` — how room create/join/start/progress/
  results actually flows today.
- `docs/agent/theming.md` — how Calm and Sparkle relate; pointers to both
  skills.
- `docs/agent/testing.md` — how to run and write tests, and what isn't
  covered yet.

## Keeping this file honest

If a change touches architecture, the data model, or adds a route, update
the matching `docs/agent/*.md` file in the same PR — the PR template has a
checkbox for this. Don't let facts drift between this file, `docs/agent/`,
and `.github/copilot-instructions.md`: each fact has exactly one home
(`.github/copilot-instructions.md` is a pointer file only — see there for
why it still exists).
