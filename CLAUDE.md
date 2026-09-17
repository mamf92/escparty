# CLAUDE.md

Read this every session — it's short on purpose. For anything deeper, follow
the links instead of re-deriving it by grepping the codebase.

## Stack

React 19 + Vite + TypeScript, styled-components for styling, react-router
(`HashRouter` — routes are `#/...`, required by the GitHub Pages deploy).
Backend is Firebase Firestore via the client SDK: state syncs through
`onSnapshot` listeners, there are no WebSockets and no Firestore transactions
anywhere in the codebase (see `docs/agent/firestore-data-model.md`).

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — `tsc -b` then `vite build`.
- `npm run lint` — ESLint; CI runs this and `build` on every PR.
- `npm run preview` — serve the production build locally.
- `npm run deploy` — build then publish `dist/` to GitHub Pages (`gh-pages`).
- `npm run emulators` — start the local Firestore emulator (needs a JDK).

There is no test suite yet. `docs/agent/testing.md` is a stub until that
lands — don't assume `npm test` exists.

## Where things live

`src/pages/` holds most screens; `src/components/` currently has only
`MobileFrame.tsx` (the phone-frame chrome) and `Quiz.tsx` (728 lines — the
biggest single file in the app, despite the folder name most "components"
are pages). `src/fabric-ui/` is a self-contained WebGL rendering module for
the Sparkle theme, lazy-loaded behind its own route. `src/store/` has one
file, `useGameStore.ts`, which is dead code (see Landmines). `src/utils/`
has `roomsFirestore.ts` (the Firestore API), `QuizDataProvider.ts` (quiz
question loading), and `pathUtils.ts` (base-path/env helpers). Full layout:
`docs/agent/architecture.md`.

## Design themes

Two design languages, both rendering from the same `OverlayItem[]` content
model so they never disagree on *what* they show, only *how*:

- **Calm** — dark violet CSS surface, no motion beyond a press, the default
  and accessible landing experience. Skill: `.claude/skills/escparty-calm/`.
- **Sparkle** — glittering WebGL sequin membrane with device/pointer
  parallax, opt-in only, never the landing state. Skill:
  `.claude/skills/escparty-sparkle/`.

One paragraph bridging the two, without repeating the skills' content:
`docs/agent/theming.md`.

## Do not change without explicit instruction

- `vite.config.ts`'s `base` path — breaks the GitHub Pages deployment.
- `roomsFirestore.ts`'s exported function signatures — multiple pages depend
  on this exact API; change it as a coordinated migration, not a drive-by edit.
- Production Firestore rules — they live only in the Firebase console (there
  is no `firestore.rules` file in this repo), so there's nothing to diff
  against locally. Treat any change here as high risk.

If you're unsure whether a change affects hosting, env vars, or Firestore
rules, ask before making it rather than guessing.

## Known landmines

- `useGameStore.ts` (Zustand) is **not imported anywhere** outside itself —
  it's dead code. Session state is instead duplicated ad hoc via
  `localStorage`/`sessionStorage`/router `location.state` across
  `MultiplayerLobby.tsx`, `Lobby.tsx`, `Quiz.tsx`, `MidQuizScoreboard.tsx`,
  `HostObserverView.tsx`, and `QuizResults.tsx`. Don't assume the store is
  wired in; don't add to it without a migration plan.
- The Firestore `Room` doc has **no `currentQuestionIndex` field** — question
  progression during a multiplayer quiz is driven client-locally (each
  client runs its own timer), not by a server-authoritative field.
- No Firestore transactions are used anywhere in `roomsFirestore.ts`; a few
  writes (`updatePlayerScore`, `markPlayerAtMidQuiz`) are manual
  read-modify-write and are race-prone under concurrent writers.

## The dev loop

Pick a task → plan if it's non-trivial → execute on a branch → open a PR →
get it reviewed → merge only after review approves. Full policy:
`CONTRIBUTING.md`. An agent following this loop end-to-end should use the
`steward` skill (`.claude/skills/steward/SKILL.md`).

## Deep dives (read only when the task touches that area)

- `docs/agent/architecture.md` — detailed `src/` layout and module boundaries.
- `docs/agent/firestore-data-model.md` — the `Room`/`Player` shape, which
  writes are safe vs. race-prone, the missing-rules-file gap.
- `docs/agent/multiplayer-sync.md` — how room create/join/start/progress/
  results actually flows today.
- `docs/agent/theming.md` — how Calm and Sparkle relate; pointers to both
  skills.
- `docs/agent/testing.md` — stub; fills in once a test suite exists.

## Keeping this file honest

If a change touches architecture, the data model, or adds a route, update
the matching `docs/agent/*.md` file in the same PR — the PR template has a
checkbox for this. Don't let facts drift between this file, `docs/agent/`,
and `.github/copilot-instructions.md`: each fact has exactly one home
(`.github/copilot-instructions.md` is a pointer file only — see there for
why it still exists).
