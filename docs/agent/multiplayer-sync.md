# Multiplayer sync

Read this before changing anything in the create → join → start → progress →
results flow, or when debugging players seeing inconsistent quiz state.

This absorbs today's actual behavior; if a future quiz-flow rework changes
any of it, update this file in the same PR rather than leaving it stale.
Why this runs on Firestore listeners and not WebSockets:
`docs/agent/adr/0001-firestore-vs-websockets.md`.

## The flow, page by page

1. **`MultiplayerLobby.tsx`** — host creates a room (`createRoom`, generates
   a 4-letter code) or a player joins one (`joinRoom`). Both paths write
   `playerId`, `playerName`, `gameCode` and `isHost` to `localStorage`, then
   navigate to `/lobby`. Whether the host only observes is stored on the
   room (`Room.hostIsObserver`) and nowhere else.
2. **`Lobby.tsx`** — reads those `localStorage` values back out, then opens
   one `onSnapshot` listener via `listenToRoom(gameCode, callback)`. It's
   the "green room" (#65): guests tap "I'm ready" (`setPlayerReady`), the
   host can take a player out (`removePlayerFromRoom`), and the host's
   Start waits until every guest is ready, with an explicit "Start anyway"
   before that (`lobbyGate.ts`; an observer host needs at least one
   player). The host
   picks a difficulty (`setRoomDifficulty`) and starts the game
   (`startGame`, which sets `Room.started = true` and moves the room to
   `phase: "question"` in the same write; see
   `docs/agent/firestore-data-model.md`). Every client's listener fires
   on that write; each one independently stashes a `multiplayerGame` blob in
   `sessionStorage` and navigates itself to `/quiz/:difficulty` (an observer
   host goes to `/host-observer` instead). There is no
   single "go" signal beyond the `started` flag — navigation is a side
   effect of the snapshot callback running on every subscribed client.
3. **`Quiz.tsx`** — reads multiplayer context from router `location.state`
   if present, falling back to the `sessionStorage` `multiplayerGame` blob
   only when there's no router state at all (a direct link, a new or
   restored tab; `HashRouter` keeps router state across a refresh). In
   multiplayer, **the room drives progression** (#62): every client renders
   `Room.currentQuestionIndex` and derives its countdown from
   `Room.phaseStartedAt`, so all screens show the same question, and a tab
   that was backgrounded or reloaded jumps straight to the room's current
   question and time. When a question's slot is over, any client ends it
   with `advanceQuestion` (one write lands, the rest are no-ops). When the
   room's phase becomes `mid-scoreboard` or `results`, every player
   navigates there. An observer host doesn't play: Lobby (or, failing that,
   the quiz page or the break screen) sends it to `/host-observer`, where it stays for the whole
   game and follows the room to the results when it ends (#21). An
   observer that opens the lobby or quiz page after the game has ended is
   sent on to the results too (`shouldObserve` in `roomRoles.ts`). Any
   router state, like single player's `{ multiplayer: false }`, skips the
   `sessionStorage` fallback, so a leftover blob can't turn a later
   single-player quiz into an old room (#63). Single player still runs
   local timers. Details:
   `docs/agent/firestore-data-model.md`.
4. **Mid-quiz** — in a room with an observer host, `MidQuizScoreboard.tsx`
   marks each arriving player ready via `markPlayerAtMidQuiz` (`arrayUnion`,
   since everyone arrives at once), because the observer's Continue waits
   for every mark. A playing host's room doesn't need them.
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
   Continue waits until every player is marked, naming who's missing, with
   "Continue without them" for a player whose phone died (#65).
5. **`QuizResults.tsx`** — the finale (#67): the room's final standings,
   revealed a tap at a time (everyone below the podium, then 3rd, 2nd and
   1st; ties together, `finale.ts`), with no motion, in the Calm style. It
   listens to the room for as long as it's open and recovers from
   `sessionStorage` if `location.state` is missing (a direct link, a
   reload). The stored game is kept through a reload, so a reload on the results
   keeps working. The host's "Play
   again with everyone" creates a new room and writes its code to the
   finished room (`setNextRoom`, `nextRoomCode`, once; the rules only
   accept an existing lobby with the same `hostId`); guests still on the
   results see "Join the next round", which joins them under the same
   player ID and name and takes everyone to the new lobby, where the host
   picks the next quiz (#21). Leaving the results any other way (Back, a
   typed URL) also forgets the stored game, a tick after the page closes.
   Single-player scores are separately persisted to `localStorage`
   (`quizScores`) and read by `Scoreboard.tsx` — that path doesn't touch
   Firestore at all.

## State plumbing, summarized

Three different persistence mechanisms are in play simultaneously, and
which one wins depends on the page:

- `localStorage` — identity that should survive across the whole multiplayer
  session (`playerId`, `playerName`, `gameCode`, `isHost`). Since #63 the
  quiz and break screens don't trust `isHost` for anything that matters:
  who's the host, and whether they only observe, comes from the room
  (`src/utils/roomRoles.ts`), because `localStorage` is shared by every tab
  and outlives the game.
- `sessionStorage` — a `multiplayerGame` snapshot (room code, player ID,
  difficulty; read via `readMultiplayerGame()` in `multiplayerSession.ts`)
  for pages opened without router state: a direct link, a new or restored
  tab. A refresh keeps router state (`HashRouter` stores it in
  `history.state`).
- `location.state` — the primary hand-off between pages on normal
  navigation; several pages fall back to `sessionStorage` when it's absent.

`useGameStore.ts` (Zustand) is not part of this — it's dead code, see
`CLAUDE.md`.

## Server-authoritative progression

Landed in #62, with the mid-quiz return following it since #63; see steps
3 and 4 above and `docs/agent/firestore-data-model.md`. A multiplayer room
without a phase (created before #61) can't be played any more.
