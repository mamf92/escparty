# Architecture

Read this when you need to know where something lives in `src/`, or before
moving files between folders.

## `src/pages/`

Most screens live here: `Home.tsx`, `SelectDifficulty.tsx`,
`QuizLibrary.tsx` (`/quizzes`, your saved quizzes and every premade one,
to play solo, host, or take into the builder), `QuizBuilder.tsx`
(`/quizzes/new`, `/quizzes/edit/:quizId`: bank picker, question editor,
order and break setting, save),
`MultiplayerLobby.tsx`, `Lobby.tsx`, `MidQuizScoreboard.tsx`,
`HostObserverView.tsx`, `QuizResults.tsx`, `Scoreboard.tsx`,
`UnderDevelopment.tsx`, and the scoreboard party's `PartyHome.tsx`
(`/party`), `PartySetup.tsx` (`/party/new`), `PartyRoom.tsx`
(`/party/:code`), `PartyScreen.tsx` (`/party/:code/screen`) and
`PartyAwards.tsx` (`/party/:code/awards`); see
`docs/agent/scoreboard-party.md`. Routed from `src/App.tsx`, wrapped in
`MobileFrame` (see below) except the standalone `/fabric-ui` demo route and
the party's big screen, which fills the window for a TV.

## `src/components/`

Mostly not small reusable pieces, despite the folder name:

- `CalmPage.tsx` — page chrome (title, subtitle, footer, `CalmLink`,
  `CalmNote`) every screen renders through, in either theme; the surface
  itself is `src/design/surface.css`. See
  `docs/design/design-system.md`.

- `Standings.tsx` — the room's standings as information rows (places shared
  on a tie, as `placePlayers` in `src/utils/finale.ts`; the leader and your
  own row raised), shared by the mid-quiz break and the host's view.

- `PartyHostTools.tsx` — the host's tab in a scoreboard party: share the
  link, enter the real result, edit the running order, open the awards.

- `MobileFrame.tsx` — the phone-frame chrome every routed page renders inside
  (except `/fabric-ui` and the big screen), with the app bar: the brand
  (not a link: mid-game screens own their exits) and the Sparkle mode switch.
- `Quiz.tsx` — ~880 lines, the largest file in the app. Handles single-player
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

## `src/data/`

- `escBeginnerQuiz.json` / `escIntermediateQuiz.json` /
  `escAdvancedQuiz.json` — the classic easy/medium/hard sets (duplicated in
  `public/quizdata/`, see "Data files" below).
- `questionBank.ts` — every built-in question tagged with a difficulty and
  a category (#71, #72): the classic 30 plus the newer ones, current to the
  2026 contest and Burgas 2027. Tested for playability and unique ids.
  Loaded lazily by `quizCatalog.loadQuiz`, so it stays out of the main chunk:
  don't import it statically from a page.
- `quizTemplates.ts` — the premade quizzes, each a spelled-out list of bank
  ids (so it doesn't import the bank) and its own mid-quiz scoreboard
  setting, which applies solo only until rooms carry a break setting.
- `contests2027.ts` — the Burgas 2027 semis and final with a **fictive**
  running order, the fallback when Firestore `contests/` has no real one
  (see `docs/agent/scoreboard-party.md`).

## `src/utils/`

- `quizModel.ts` — the quiz data model (#70): bank vs custom questions,
  `questionProblems`/`quizProblems` (at least 2 answers, one marked
  correct, limits), `BREAK_CHOICES` for the scoreboard placement,
  `isBreakAfter`, `toPlayable`, `seededShuffle`. Pure functions.
- `quizCatalog.ts` — what a quiz key names (`easy`/`medium`/`hard`,
  `t-<templateId>` or `c-<quizId>`), its title, `loadQuiz(key)`,
  `quizBreakEvery(key)` for a room, and `loadQuizForEditing(key)` for the
  builder. The quiz route (`/quiz/:key`) and a room's `difficulty` field
  both carry a key.
- `customQuizzes.ts` — saved custom quizzes (#76): save to and read from
  Firestore `quizzes/`, and this device's "my quizzes" list in
  localStorage. See "Saved quizzes" in `firestore-data-model.md`.

- `finale.ts` — the quiz finale (#67): final places with ties, and the
  order the results page reveals them in.

- `lobbyGate.ts` — when the lobby's host may start (#65): everyone ready,
  "Start anyway" before that, never an observer host with nobody to play.

- `partyModel.ts` (rating sheets, scores, closeness, awards; pure),
  `partyFirestore.ts` (`parties/`, ballots, `contests/`),
  `partySession.ts` (this device's identity and ratings per party),
  `partyResults.ts` (what the party screens show) and `partyNames.ts` —
  the scoreboard party, see `docs/agent/scoreboard-party.md`.

- `roomsFirestore.ts` — the quiz rooms' Firestore API: room/player CRUD,
  the `onSnapshot`-based `listenToRoom`, the phase moves
  (`advanceQuestion`, `resumeAfterMidQuiz`) and the mid-quiz ready marks
  (`playersAtMidQuiz`). See
  `docs/agent/firestore-data-model.md` for the data shape and which writes
  are safe. Its exported function signatures are on the do-not-change list
  in `CLAUDE.md`.
- `QuizDataProvider.ts` — loads quiz questions for a difficulty, trying a
  direct JSON import, then a `fetch` against `public/quizdata/`, then a
  small hardcoded fallback, in an order that differs between dev and
  production (see the file for which order). Loading deliberately returns
  the bank as authored; `filterEnabledQuestions` (same file) is the separate
  step that drops questions flagged `disabled`, called by `Quiz.tsx`.
- `quizScoring.ts` — the answer-scoring math (`500` base plus a time bonus
  of up to `500`, linear in the time left and rounded down), extracted from
  `Quiz.tsx` so the rule players actually see can be unit-tested without
  rendering the component, plus `bestKnownScore` (a multiplayer player's
  local score or the room's, whichever is higher, #63). Pure functions, no
  React, no Firestore.
- `quizTiming.ts` — multiplayer question timing (#62): the 10s + 5s slot,
  `phaseAfterQuestion` (next question, mid-quiz break after every 5th, or
  results), `questionClock` (where a question is, given its
  `phaseStartedAt`) and `hasLeftBreak` (whether a player at a mid-quiz
  break should move on, #63). Pure functions, shared by `Quiz.tsx`,
  `MidQuizScoreboard.tsx` and
  `advanceQuestion` in `roomsFirestore.ts`; `firestore.rules` hardcodes the
  same 15s slot.
- `pathUtils.ts` — environment detection (`isDevelopmentEnvironment`,
  `isProductionPreview`) plus the base-path helper `getAssetPath`.
  `firebase.ts` uses both detection functions (but no base-path helper);
  `QuizDataProvider.ts` uses `isDevelopmentEnvironment` and `getAssetPath`
  (but not `isProductionPreview`). The Vite `base` config (`/` everywhere since
  #125) flows through `getAssetPath`.

- `roomRoles.ts` — who's who in a room, read from the room itself (#63):
  `isRoomHost`, `isObserverHost`, `shouldObserve` (whether to route to the
  observer screen: the observer host, while the game is on) and
  `playingPlayers(room)` (the players without an observing host), plus
  `observerRouteState`, the router state every redirect to
  `/host-observer` hands over. Replaces the `localStorage` guesses pages
  used to make. 100% coverage floor.

- `multiplayerSession.ts` — `readMultiplayerGame()`, this tab's stored
  multiplayer game (`sessionStorage` `multiplayerGame`: room code, player
  ID, difficulty) for pages opened without router state (#63), and
  `readStoredGame()`, which also tells "nothing stored" from "stored but
  unreadable" and never throws. Used by the quiz page, the break screen,
  the observer screen and the results page. 100% coverage floor.

## `src/hooks/`

- `useQuizTitle.ts` — a quiz key's title, reading a saved quiz someone
  else made from Firestore (the lobby and the multiplayer lobby).

- `usePartyData.ts` — a party and all its ballots, live;
  `useOwnBallot.ts` — this guest's ratings, kept on the device and saved
  (with retries) to Firestore.

- `useResumeRoom.ts` — the host's Continue at a mid-quiz break (#63), used
  by `MidQuizScoreboard.tsx` and `HostObserverView.tsx`: calls
  `resumeAfterMidQuiz`, ignores a second tap while one is in flight, and
  turns a failure into a retryable message. It never navigates; every
  screen follows the room's phase instead. Tested in
  `useResumeRoom.test.ts`.

## `src/firebase.ts`

Firebase app + Firestore init from `VITE_FIREBASE_*` env vars. Connects to
the local emulator only when `isDevelopmentEnvironment()` is true **and**
`VITE_USE_FIREBASE_EMULATOR=true`.

## `src/design/`

The design system (rules: `docs/design/design-system.md`). `tokens.css`
holds every colour, font, size, radius, face and shadow per theme
(`data-theme` on `<html>`); `surface.css` draws the frameless neumorphic
surface classes from them; `sparkle.css` is Sparkle's decoration (glint,
stars);
`base.css` the page chrome classes (`esc-title`, `esc-note`, `esc-link`),
the theme switch and the forced-colours / more-contrast rules;
`design-system.css` imports them all once, from `main.tsx`.
`DesignThemeProvider`/`useDesignTheme` hold the active theme,
`ThemeSwitch` is the app bar's Sparkle mode switch, `Sparkles` the
decorative glitter layer, and `Surface.tsx` the `Ground`/`Pane`/`Control`/
`Row`/`Field` primitives screens are built from.

## `src/styles/theme.ts`

Legacy styled-components theme: its fonts point at the design tokens, and
its named colours remain only for screens not yet moved onto
`src/design/`. Don't use `theme.colors` in new code.

## `src/test/`

Test harness only — no app code imports it. `setup.ts` is Vitest's per-file
setup (jest-dom matchers, Testing Library cleanup) and `test-utils.tsx`
exports `renderWithProviders`, which wraps a component in the same
`ThemeProvider` + `DesignThemeProvider` + router that `App.tsx` mounts screens under. Tests
themselves live next to the code they cover, not here. See
`docs/agent/testing.md`.

## Data files

`src/data/*.json` and `public/quizdata/*.json` are duplicates of the same
three quiz question sets (easy/medium/hard) — one set is bundled, the other
is fetched at runtime. `QuizDataProvider.ts` is what reconciles which one
actually gets used.
