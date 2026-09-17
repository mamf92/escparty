# Architecture

Read this when you need to know where something lives in `src/`, or before
moving files between folders.

## `src/pages/`

Most screens live here: `Home.tsx`, `SelectDifficulty.tsx`,
`MultiplayerLobby.tsx`, `Lobby.tsx`, `MidQuizScoreboard.tsx`,
`HostObserverView.tsx`, `QuizResults.tsx`, `Scoreboard.tsx`,
`UnderDevelopment.tsx`. Routed from `src/App.tsx`, wrapped in `MobileFrame`
(see below) except the standalone `/fabric-ui` demo route.

## `src/components/`

Only two files today, and the folder name is misleading — neither is a small
reusable piece:

- `MobileFrame.tsx` — the phone-frame chrome every routed page renders inside
  (except `/fabric-ui`).
- `Quiz.tsx` — 728 lines, the largest file in the app. Handles single-player
  and multiplayer quiz flow, answer selection/scoring, and the multiplayer
  progression timer. A change here is rarely "just a component change" —
  read `docs/agent/multiplayer-sync.md` first if the change touches
  multiplayer behavior.

## `src/fabric-ui/`

The Sparkle theme's WebGL rendering implementation: a `react-three-fiber`
displaced height field, plus a DOM overlay for real interactive elements.
It's a parallel module with its own README (`src/fabric-ui/README.md`) and
its own demo route (`/fabric-ui`), lazy-loaded so `three`/`@react-three/fiber`/
`leva` never land in the main bundle. As of this writing it is a standalone
proof-of-concept demo, not yet confirmed wired into the live app pages —
check current usage before assuming it renders the real quiz flow. Design
details belong in `.claude/skills/escparty-sparkle/`, not here.

## `src/store/useGameStore.ts`

A Zustand store. **Dead code** — not imported anywhere outside itself. Real
session state (`playerId`, `playerName`, `isHost`, room code, etc.) is
instead threaded through `localStorage`, `sessionStorage`, and router
`location.state` directly inside the pages listed in `CLAUDE.md`'s Known
Landmines section. Don't wire new code to this store without a migration
plan that also removes the ad hoc storage it would duplicate.

## `src/utils/`

- `roomsFirestore.ts` — the entire Firestore API surface: room/player CRUD,
  the `onSnapshot`-based `listenToRoom`, and progression flags
  (`continueReady`, `playersAtMidQuiz`). See
  `docs/agent/firestore-data-model.md` for the data shape and which writes
  are safe. Its exported function signatures are on the do-not-change list
  in `CLAUDE.md`.
- `QuizDataProvider.ts` — loads quiz questions for a difficulty, trying a
  direct JSON import, then a `fetch` against `public/quizdata/`, then a
  small hardcoded fallback, in an order that differs between dev and
  production (see the file for which order).
- `pathUtils.ts` — environment detection (`isDevelopmentEnvironment`,
  `isProductionPreview`) and base-path helpers used by both `firebase.ts`
  and `QuizDataProvider.ts`. The Vite `base` config (GitHub Pages vs.
  Vercel) flows through here.

## `src/firebase.ts`

Firebase app + Firestore init from `VITE_FIREBASE_*` env vars. Connects to
the local emulator only when `isDevelopmentEnvironment()` is true **and**
`VITE_USE_FIREBASE_EMULATOR=true`.

## `src/styles/theme.ts`

The shared styled-components theme (colors, fonts) both design themes pull
their tokens from. See `docs/agent/theming.md`.

## Data files

`src/data/*.json` and `public/quizdata/*.json` are duplicates of the same
three quiz question sets (easy/medium/hard) — one set is bundled, the other
is fetched at runtime. `QuizDataProvider.ts` is what reconciles which one
actually gets used.
