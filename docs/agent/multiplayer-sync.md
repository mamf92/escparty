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
   (`startGame`, which sets `Room.started = true` and moves the room to
   `phase: "question"` in the same write; see
   `docs/agent/firestore-data-model.md`). Every client's listener fires
   on that write; each one independently stashes a `multiplayerGame` blob in
   `sessionStorage` and navigates itself to `/quiz/:difficulty`. There is no
   single "go" signal beyond the `started` flag — navigation is a side
   effect of the snapshot callback running on every subscribed client.
3. **`Quiz.tsx`** — reads multiplayer context from router `location.state`
   if present, falling back to the `sessionStorage` `multiplayerGame` blob
   (needed on refresh, since `location.state` doesn't survive one). In
   multiplayer, **the room drives progression** (#62): every client renders
   `Room.currentQuestionIndex` and derives its countdown from
   `Room.phaseStartedAt`, so all screens show the same question, and a tab
   that was backgrounded or reloaded jumps straight to the room's current
   question and time. When a question's slot is over, any client ends it
   with `advanceQuestion` (one write lands, the rest are no-ops). When the
   room's phase becomes `mid-scoreboard` or `results`, every client navigates
   there. Single player still runs local timers. Details:
   `docs/agent/firestore-data-model.md`.
4. **Mid-quiz** — `MidQuizScoreboard.tsx` marks each arriving player ready
   via `markPlayerAtMidQuiz` (`arrayUnion`, since everyone arrives at once).
   The host's continue calls `resumeAfterMidQuiz` (the room back to
   `phase: "question"` at the next question, clearing the ready marks), and
   that's the whole signal (#63): each scoreboard, the host's included,
   returns to the quiz as soon as its snapshot shows the room out of this
   break, however late that snapshot arrives. If the room has already
   reached the results (a phone locked through the rest of the quiz), the
   quiz page sends the player straight on there. The old `continueReady` flag was set and
   reset 3s later, so a throttled or offline client could miss it and get
   stuck (#23). The rules refuse a ready mark that arrives after the
   resume. `HostObserverView.tsx` is the host-only screen when
   `hostIsObserver` is true — the host watches without answering, and its
   Continue waits until every player is marked.
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

## Server-authoritative progression

Landed in #62, with the mid-quiz return following it since #63; see steps
3 and 4 above and `docs/agent/firestore-data-model.md`. A multiplayer room
without a phase (created before #61) can't be played any more.
