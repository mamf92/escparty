# Firestore data model

Read this before touching `roomsFirestore.ts` or any Firestore-backed page.

## Collections

One collection, `rooms`, keyed by a 4-letter uppercase room code
(`generateRoomCode()`). No sub-collections; players live as an array on the
room document, not as their own documents.

## `Room` shape (as defined in `roomsFirestore.ts`)

```ts
interface Room {
  id: string;
  hostId: string;
  started: boolean;
  difficulty?: string;
  createdAt: Timestamp | FieldValue;
  players: Player[];
  hostIsObserver?: boolean;
  continueReady?: boolean;
  playersAtMidQuiz?: string[];
  phase?: RoomPhase;                 // "lobby" | "question" | "mid-scoreboard" | "results"
  currentQuestionIndex?: number;
  phaseStartedAt?: Timestamp | FieldValue; // always serverTimestamp()
}

interface Player {
  id: string;
  name: string;
  score: number;
  joinedAt?: Timestamp | FieldValue;
}
```

**`phase` / `currentQuestionIndex` / `phaseStartedAt` drive multiplayer
progression (#61 added them, #62 made clients follow them).** In a
multiplayer quiz, every client shows `currentQuestionIndex` and derives its
countdown from `phaseStartedAt`; nothing is counted down locally. Timing
constants and the "what comes next" logic live in `src/utils/quizTiming.ts`.
The lifecycle:

- `createRoom` writes `phase: "lobby"`, `currentQuestionIndex: 0`,
  `phaseStartedAt: serverTimestamp()`.
- `startGame` writes `started: true` plus `phase: "question"`,
  `currentQuestionIndex: 0`, `phaseStartedAt: serverTimestamp()` in one
  `updateDoc`.
- `advanceQuestion(roomCode, fromIndex, totalQuestions)` ends a question
  once its 15s slot (10s answering + 5s feedback) is over. Any client may
  call it, including when the host is an observer who never runs the quiz.
  It runs in a transaction that only advances if the room is still on
  `fromIndex`, so racing clients produce one write and a string of no-ops.
  It moves to the next question, to `"mid-scoreboard"` after every 5th
  question (with `currentQuestionIndex` already pointing at the question
  after the break), or to `"results"` after the last one.
- `resumeAfterMidQuiz(roomCode)` is the host's continue: `"mid-scoreboard"`
  → `"question"` at the same index, with a fresh `phaseStartedAt`, clearing
  `playersAtMidQuiz`. A no-op outside the break.
- All three are optional on `Room`: rooms created before #61 don't have
  them. Since #63 `Quiz.tsx` no longer plays such a room (its local-timer
  fallback is gone) and shows a "start a new room" error instead.
- `phaseStartedAt` reads as `null` in a snapshot whose `serverTimestamp()`
  write is still pending (the writer's own listener sees that local
  snapshot first). `Quiz.tsx` counts from "now" until the real value lands.
- Clients compare `phaseStartedAt` (server time) against their own clock.
  A phone whose clock is off by a second or two shows a correspondingly
  shorter or longer countdown; the advance itself is still gated on the
  server's clock (see the rules below), so the room never moves early.

## Which writes are safe vs. race-prone

- **Safe:** `addPlayerToRoom` and `markPlayerAtMidQuiz` use `arrayUnion` —
  concurrent joins, and every player reaching the mid-quiz break on the same
  snapshot (#62), can't clobber each other. `advanceQuestion` and
  `resumeAfterMidQuiz` are transactions (see above). `updatePlayerScore` runs inside a `runTransaction` —
  Firestore retries it on a conflicting concurrent write, so two
  near-simultaneous score updates for the same player (e.g. an answer's
  write and a time's-up repair write in `Quiz.tsx` near a question's
  deadline) can't silently drop one of them the way a plain
  read-modify-write would.
- **Don't add a manual read-modify-write.** `markPlayerAtMidQuiz` used to
  be one (`getDoc` then `updateDoc` with a recomputed array); once #62 put
  every player at the break at the same moment, concurrent calls dropped
  each other's IDs and an observer host's Continue never enabled. If you're
  adding a field several clients might write concurrently, use
  `arrayUnion`/`arrayRemove` where the shape allows it, or a transaction
  (see `updatePlayerScore` for the pattern).

## Progression flags

- `continueReady` — unused since #63. It was the host's "continue" signal,
  set to `true` and reset 3s later, so a client whose snapshot arrived late
  missed it and stayed stuck at the break (#23). Players now leave the
  break as soon as the room isn't in it any more (`hasLeftBreak` in
  `quizTiming.ts`; see `docs/agent/multiplayer-sync.md`). `setContinueReady` and its rules branch
  remain only so the exported API and old rooms don't break.
- `playersAtMidQuiz` — array of player IDs who have reached the mid-quiz
  scoreboard, built via `markPlayerAtMidQuiz` (`arrayUnion`) and cleared by
  `resumeAfterMidQuiz` in the same write that ends the break, so a
  half-failed resume can't leave stale marks for the next one. Among phase
  moves, only the resume may touch it (and only to clear it). On its own
  (`isManagingMidQuizPlayers`, #63), a room with a phase only accepts marks
  while it's in `"mid-scoreboard"`, and only ones that append a single
  player ID string, as `arrayUnion` does (so one client can't mark everyone
  ready in one write), or leave the list unchanged. Without sign-in the
  rules can't tell whose ID a mark is, so a client could still mark others
  one write at a time; per-player state on the room is #64. A mark queued
  offline or on a slow network that arrives after the resume is refused,
  so it can't count a player as ready at the next break before they get
  there. Rooms without a phase still accept any list.
  `resetPlayersAtMidQuiz` still exists but nothing calls it, and in a room
  with a phase the rules now refuse it.

## Security rules

`firestore.rules` at the repo root is the production rules, originally
imported verbatim from the Firebase console and wired up via
`firebase.json`'s `firestore.rules` key, so the emulator and
`firebase deploy --only firestore:rules` both use this file as the source
of truth.

### Deploying rules

`.github/workflows/firestore-rules.yml` deploys this file. It runs on any PR
or push to `main` that touches the rules, `firebase.json`, either rules
script, the workflow itself, or `package.json`/`package-lock.json` (the
verify script runs on the installed `firebase` SDK):

- **On a PR:** only `scripts/verify-firestore-rules.mjs` against the
  emulator. PR runs get no production access, because a PR can edit the
  workflow itself, and a PR run holding the key could deploy unreviewed
  rules. So the PR's diff of `firestore.rules` is exactly what goes live on
  merge.
- **On push to `main`** (the `deploy` job, in the `production` GitHub
  environment): it reads the live rules (`scripts/firestore-live-rules.mjs`).
  If they already match the file, it stops. Otherwise it checks where they
  came from. If they match any version of `firestore.rules` in `main`'s
  history, they're just an older deploy, so it logs the diff, deploys, and
  reads the live rules back, failing unless they now match the file exactly.
  If they match no version, someone edited them outside the repo, and the
  job refuses to deploy rather than silently discard that edit. Port the
  edit into the file, or re-run the workflow by hand with `overwrite_live`
  to discard it.
- It only deploys the current tip of `main`. Re-running an older run is a
  no-op, so it can't put back rules a later commit replaced. A missing
  secret or variable fails the job rather than skipping it, since a green
  run on `main` reads as "deployed".
- Known gaps, not closed yet:
  - A rollback made in the console, to an older ruleset that matches some
    earlier commit, looks like a stale deploy and gets replaced on the next
    push. Roll back by reverting in the repo instead.
  - Auth is a long-lived JSON key. Workload Identity Federation scoped to
    `main` would remove it.
  - `firebase-tools` runs via a pinned `npx` version, not a lockfile, and
    actions are pinned by tag, not SHA. Both match `ci.yml` today.

So: **never edit rules in the Firebase console.** Change this file in a PR.
Credentials: the `FIREBASE_SERVICE_ACCOUNT` secret, which belongs in the
`production` environment (deployment branches: `main` only) rather than
the repo-wide secrets, since any PR's workflow can read a repo-wide secret.
It's the `github-rules-deployer` service account, with Firebase Rules Admin
and Service Usage Consumer only, so it can't touch room data. Plus the
`FIREBASE_PROJECT_ID` repo variable.

### Progression fields (#61, #62)

`isValidRoomCreation` accepts the three fields as optional, but when
present they must be `phase == 'lobby'`, `currentQuestionIndex == 0` and
`phaseStartedAt == request.time`. `isStartingGame` accepts exactly
`started` + the three fields, with `phase == 'question'`,
`currentQuestionIndex == 0` and `phaseStartedAt == request.time`. The
legacy started-only start is no longer accepted (#62): a game started that
way would have no phase for clients to follow.

`isAdvancingPhase` covers every later move, mirroring `phaseAfterQuestion`
in `quizTiming.ts`: question N → question N+1 (N+1 not a multiple of 5),
question N → `mid-scoreboard` at N+1 (N+1 a multiple of 5), question N →
`results`, and `mid-scoreboard` N → question N (which may also clear
`playersAtMidQuiz` to `[]`, and is the only move that may). A question can't be ended
before `phaseStartedAt + 15s`, measured on the server's clock, so no client
can cut a question short or race ahead. The 15s is hardcoded there; keep it
in sync with `QUESTION_SLOT_MS`. Rules can't see how many questions a quiz
has, so `results` is accepted from any question.

`phaseStartedAt` is always pinned to `request.time`, and no other update
branch admits these keys (each is `hasOnly` its own fields), so they can't
be back-dated or forged alongside another write. Covered by cases 11 and 12
of `scripts/verify-firestore-rules.mjs`. Case 12 waits out real 15s slots,
so the script takes about two minutes.

**Two real bugs found and fixed in the rules imported from the Firebase
console** (verified against the real emulator before and after — see
`scripts/verify-firestore-rules.mjs`), both root-caused by the same mistake:
`data.players.hasAll(isValidPlayerBasic)` passes a function name where
`hasAll` expects a list. Firestore Rules has no `.every()`/map-over-list
construct, so this was presumably an attempt at "validate every player" that
doesn't do what it looks like — it's an undefined-identifier reference that
errors at evaluation time, not a type error caught at load time (the file
still loads and deploys fine).

That one bug had two distinct live consequences, fixed together:
1. In `isUpdatingPlayerScores()`, the error meant this branch reliably
   **denied every score update once a game had started** — `submitAnswer`
   and `handleTimeUp` in `Quiz.tsx` both swallow `updatePlayerScore`'s
   rejection into `console.error` and keep going, so this would have been
   silently eating every player's score write with no visible symptom
   beyond scores not syncing to other clients. If you've seen reports of
   scores not showing up for other players during a multiplayer game, this
   is almost certainly why — worth confirming with whoever reported it.
2. In `isAddingPlayer()`, the same error made its first (intended,
   shape-checked) branch always fail, silently falling through to a second,
   unrelated branch (`request.writeFields != null`, itself referencing a
   field that doesn't exist on `request`) that happened to still allow the
   write through with **no shape validation and no size bound** — replacing
   the whole `players` array with malformed entries was accepted.

Both are fixed now: every `allow update` branch takes the write's
`affectedKeys()` (computed once in `isValidRoomUpdate()`, not per-branch —
calling `.diff()` up to six times per write was expensive enough to trip the
rules engine's per-request expression budget) and requires it match exactly
the field(s) that operation is for, so a legitimate-looking write can no
longer piggyback an unrelated forged field (e.g. `hostId`) in the same
request. Player-array shape validation no longer relies on a function
reference — `allPlayersValid()` unrolls the check up to 32 players (there's
no loop/recursion in Firestore Rules, so this is the standard workaround;
32 comfortably covers a realistic party-quiz room, and anything larger is
rejected by the size check rather than silently accepted). `isAddingPlayer`
no longer has a second bypass branch, and validates every entry in the
resulting array via `allPlayersValid()`, not just the newly appended one —
an earlier version of this fix only checked the last entry, which a review
pass caught: array-grew-by-one doesn't by itself prove the write came from
`arrayUnion` appending rather than a full replace with an earlier entry
corrupted.

**Two more real gaps found and fixed** on a pass against #50's own acceptance
criteria (also verified against the emulator, also in
`scripts/verify-firestore-rules.mjs`):
- `allow read: if true` covers both Firestore's `get` (fetch one doc you
  already know the path to) and `list` (query the collection). This app
  never queries the `rooms` collection — every read is `getDoc`/`onSnapshot`
  on a known room code — so `list` being open meant any client could
  enumerate every room in the collection with **no code at all**, reading
  every room's player names, scores, and `hostId`. Split into
  `allow get: if true; allow list: if false;`.
- `isSettingDifficulty()` didn't check whether `difficulty` was already set,
  so it could be changed repeatedly before the game started, not just once.
  Fixed with `!('difficulty' in existingData)`. There's still no way to
  check the caller is actually the *host* specifically (no auth to check
  it against) — this only makes it a one-shot choice, not a host-only one.
  Making this one-shot at the rules layer turned a client-side race (a fast
  double-click on two difficulty buttons in `Lobby.tsx`, sending two writes
  before the first one's `onSnapshot` update disables the buttons) from a
  harmless duplicate write into a `permission-denied` error that used to
  render `Lobby.tsx`'s dead-end full-page error screen. Fixed alongside
  this rules change by disabling the difficulty buttons for the duration of
  the write (`isSettingDifficulty` state in `Lobby.tsx`) — a rules change
  that makes something one-shot should come with a look at whether any
  client code assumed re-sending the same kind of write was harmless.

Remaining gaps, all pre-existing and **not** closed by any of the above:
- The emulator checks are a plain Node script
  (`scripts/verify-firestore-rules.mjs`), not part of the Vitest suite; see
  `docs/agent/testing.md` for running it. Fold it into the real suite once
  Epic 3 lands.
- A client still can't be stopped from writing a *different* player's score
  entry specifically — rules can validate shape, not identity, without auth.
- There's no "finished room" concept in the `Room` schema at all (no field
  for it), so #50's "can't resurrect a finished room's state" can't be
  enforced by a rule yet — that needs a data-model change first, not just a
  rules change.

## Trust boundary for client-submitted writes

There's no auth in this app — any visitor with a room code is an equally
trusted (or untrusted) client. That shapes what's worth enforcing:

- **Should be rejected outright (belongs in `firestore.rules`):** a non-host
  client forging `started: true` or `difficulty`, or forging an unrelated
  field (e.g. `hostId`) by piggybacking it onto another legitimate write —
  both now enforced (see above). **Not yet enforceable:** a client writing
  another *specific* player's score entry rather than its own — `players`
  is a plain array with no per-player identity to check a write's author
  against, since this app has no auth. Rules can (and now do) validate that
  a player entry has a valid *shape*, but not *whose* entry a given write is
  allowed to change. Closing this fully would need either Firebase Auth
  (anonymous auth, matching `request.auth.uid` to a player's `id`) or a
  Cloud Function validation layer — both bigger than a rules-only fix, and
  not yet justified for this app's threat model (see below).
- **Acceptable client trust, not worth enforcing server-side, for a
  Eurovision party quiz with no auth and no stakes beyond bragging
  rights:** exact millisecond timing of `timeLeftMs` — a modified client
  can already see the correct answer in the bundle, so precise timing
  fraud isn't a meaningfully bigger risk than that.
- **Fixed as defense in depth (not a security boundary, just guards
  against an honest client's own bugs and against silently dropping a
  concurrent update):** `updatePlayerScore` in `roomsFirestore.ts` now
  runs in a transaction and rejects non-finite/negative scores and a
  write that would lower an existing player's score, and `Quiz.tsx`
  clamps `timeLeftMs` to `[0, 10000]` before computing the time bonus.
  None of this stops a client that edits its own JS before sending the
  request — only real Firestore rules do that.
- **Out of scope for now:** a Cloud Function to validate score deltas
  server-side. Worth revisiting only if this app ever has real stakes
  (money, ranked competition) attached to a score.

## Env / emulator

Firestore is initialized in `src/firebase.ts` from `VITE_FIREBASE_*` vars.
The emulator (`npm run emulators`, port 8080) is only wired up when running
locally in dev mode with `VITE_USE_FIREBASE_EMULATOR=true` — production and
production-preview builds always hit the real project. The exact set of
required `VITE_FIREBASE_*` keys is listed in `.env.example` and in
README.md's "Environment variables" section — that's the single source for
the list, not repeated here.
