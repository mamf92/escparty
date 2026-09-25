# Multiplayer sync

Read this before changing anything in the create → join → start → progress →
results flow, or when debugging players seeing inconsistent quiz state.

This absorbs today's actual behavior; if a future quiz-flow rework changes
any of it, update this file in the same PR rather than leaving it stale.

## The flow, page by page

1. **`MultiplayerLobby.tsx`** — host creates a room (`createRoom`, generates
   a 4-letter code) or a player joins one (`joinRoom`). Both paths write
   `playerId`, `playerName`, `gameCode`, `isHost` (and `hostIsObserver` for
   the host) to `localStorage`, then navigate to `/lobby`.
2. **`Lobby.tsx`** — reads those `localStorage` values back out, then opens
   one `onSnapshot` listener via `listenToRoom(gameCode, callback)`. The host
   picks a difficulty (`setRoomDifficulty`) and starts the game
   (`startGame`, sets `Room.started = true`). Every client's listener fires
   on that write; each one independently stashes a `multiplayerGame` blob in
   `sessionStorage` and navigates itself to `/quiz/:difficulty`. There is no
   single "go" signal beyond the `started` flag — navigation is a side
   effect of the snapshot callback running on every subscribed client.
3. **`Quiz.tsx`** — reads multiplayer context from router `location.state`
   if present, falling back to the `sessionStorage` `multiplayerGame` blob
   (needed on refresh, since `location.state` doesn't survive one). Question
   progression is driven by a **client-local timer per browser tab**, not by
   any Firestore field. `Room.currentQuestionIndex`/`phase` exist (#61) but
   no client reads them yet. This means two players' screens can legitimately be on different
   questions if their timers drift; that's a known limitation, not a bug to
   "fix" by guessing at a quick patch — it needs a server-authoritative
   progression field (see `docs/agent/firestore-data-model.md`).
4. **Mid-quiz** — `MidQuizScoreboard.tsx` marks each arriving player ready
   via `markPlayerAtMidQuiz` (race-prone read-modify-write, see the
   firestore doc) and reads `Room.continueReady` to know when the host has
   signaled to proceed. `HostObserverView.tsx` is the host-only screen when
   `hostIsObserver` is true — the host watches without answering.
5. **`QuizResults.tsx`** — final scoreboard, also recovers from
   `sessionStorage` if `location.state` is missing (e.g., after a refresh).
   Single-player scores are separately persisted to `localStorage`
   (`quizScores`) and read by `Scoreboard.tsx` — that path doesn't touch
   Firestore at all.

## State plumbing, summarized

Three different persistence mechanisms are in play simultaneously, and
which one wins depends on the page:

- `localStorage` — identity that should survive across the whole multiplayer
  session (`playerId`, `playerName`, `gameCode`, `isHost`, `hostIsObserver`).
- `sessionStorage` — a `multiplayerGame` snapshot used specifically to
  survive a page refresh where router `location.state` would otherwise be
  lost.
- `location.state` — the primary hand-off between pages on normal
  navigation; several pages fall back to `sessionStorage` when it's absent.

`useGameStore.ts` (Zustand) is not part of this — it's dead code, see
`CLAUDE.md`.

## If you're asked to add server-authoritative progression

That's the fix for the "different players see different questions" class of
bug. The `Room` fields for it (`phase`, `currentQuestionIndex`,
`phaseStartedAt`) landed in #61, written but not yet read. What's left is
a transaction-safe write pattern for advancing them and listener-driven
progression on the client instead of a local timer (#62). This is
a real architecture change — update `docs/agent/firestore-data-model.md` and
this file in the same PR, and check the PR template's architecture-change
box.
