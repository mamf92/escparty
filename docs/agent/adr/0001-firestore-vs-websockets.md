# ADR 0001: Keep Firestore `onSnapshot` for quiz sync, not WebSockets

Status: accepted (2026-09-29). Epic #60, rung 9 (#66).

## Context

Multiplayer quizzes had sync bugs. Players drifted onto different
questions, some got stuck at the mid-quiz break, scores were lost or
overwritten, and one room could both start and let a guest join. The
review behind epic #60 asked whether the fix was to swap Firestore's
`onSnapshot` listeners for a WebSocket server.

Every one of those bugs came from **architecture**, not from the
transport:

- Each client counted questions and ran timers locally, so there was no
  shared state for them to agree on. Fixed by #61 and #62: the room's
  `phase`, `currentQuestionIndex` and `phaseStartedAt` are now the single
  source of truth.
- A timed `continueReady` handshake could be missed by a slow client.
  Fixed by #63: clients now follow the room's phase instead.
- Score and ready writes were plain read-modify-writes. Fixed by #62 and
  #64: `updatePlayerScore` and `advanceQuestion` are transactions, and
  ready marks and joins use `arrayUnion`.
- Nothing on the server refused an illegal move. Fixed by `firestore.rules`,
  which now checks phase moves, their timing, joins, and score writes
  against a finished room (#142).

A WebSocket server would have had to be built with the same fixes. The
transport was never the cause.

## Decision

Keep Firestore with `onSnapshot` listeners. Fix the data model and the
rules rather than change transport.

## Consequences

What we keep:

- A managed backend, with no server of our own to run, scale or keep
  awake on party night.
- Firestore's offline queue and automatic reconnects. This matters on
  flaky party wifi: a phone that sleeps through a question catches up
  from the room's state when it wakes.
- `firestore.rules` as the one server-side check on every write,
  verified against the emulator and deployed on merge.
- The scoreboard party (#79) reuses the same pattern: `parties/` plus one
  ballot document per guest.

What a WebSocket server would have cost:

- New infrastructure to host, secure, monitor and pay for.
- Rebuilding the offline handling and reconnection that Firestore already
  provides.
- No fix in itself. It still needs server-authoritative state, which is
  the part that was actually missing.

What we accept:

- The server does no work mid-game. Anything a rule can't express is done
  by clients, which the rules then check for shape only. There is no auth
  (#115), so the rules can't tell who is writing. The awards in the
  scoreboard party are worked out on each device for the same reason.
- A client's clock matters in a few places, such as a party's `expireAt`.
  The rules allow for skew rather than trusting it.

## When to revisit

Revisit this if a feature needs server-side work mid-game that Firestore
rules can't express and a Cloud Function triggered by a Firestore write
can't do cleanly. One example: working out the scoreboard party's awards
in secret, so anonymous awards can't be traced back to people. Even then,
the first choice is a Cloud Function next to Firestore, not a socket
server. Don't make this switch in advance.
