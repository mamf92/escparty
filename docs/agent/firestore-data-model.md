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
}

interface Player {
  id: string;
  name: string;
  score: number;
  joinedAt?: Timestamp | FieldValue;
}
```

**There is no `currentQuestionIndex` field, and never has been.** Question
progression during a multiplayer quiz is not server-authoritative — each
client runs its own local timer and advances independently. If you're
debugging players seeing different questions at different times, this is
why; see `docs/agent/multiplayer-sync.md`.

## Which writes are safe vs. race-prone

- **Safe:** `addPlayerToRoom` uses `arrayUnion` — concurrent joins can't
  clobber each other. `updatePlayerScore` runs inside a `runTransaction` —
  Firestore retries it on a conflicting concurrent write, so two
  near-simultaneous score updates for the same player (e.g. `submitAnswer`
  and `handleTimeUp` in `Quiz.tsx` both firing near a question's deadline)
  can't silently drop one of them the way a plain read-modify-write would.
- **Race-prone:** `markPlayerAtMidQuiz` still does a manual read-modify-write
  (`getDoc` then `updateDoc` with a recomputed array). Two near-simultaneous
  calls for different players can read the same snapshot and each overwrite
  the other's change, silently dropping one player's mid-quiz-ready flag. If
  you're adding a new field that multiple clients might write concurrently,
  use `arrayUnion`/`arrayRemove` where the shape allows it, or a transaction
  (see `updatePlayerScore` for the pattern) — don't add another manual
  read-modify-write.

## Progression flags

- `continueReady` — host-set boolean signaling "advance to the next
  question" to observer-mode hosts. Reset by the host, not automatically.
- `playersAtMidQuiz` — array of player IDs who have reached the mid-quiz
  scoreboard, built via `markPlayerAtMidQuiz` (race-prone, see above) and
  cleared by `resetPlayersAtMidQuiz`.

## Security rules

`firestore.rules` at the repo root is the production rules, imported
verbatim from the Firebase console (no behavior change) and wired up via
`firebase.json`'s `firestore.rules` key so the emulator and
`firebase deploy --only firestore:rules` both use this file as the source of
truth going forward. Keep it in sync: if you change production rules in the
Firebase console, port the same change here in the same PR (or as a
same-day follow-up) — this file is only useful if it doesn't drift from
what's actually deployed.

**Known gaps, deliberately not fixed in the PR that first imported this
file** (see #50 — tightening rules and importing them in the same PR that
also changes behavior makes both harder to review):
- No emulator-based tests exist yet exercising the abuse cases this file is
  supposed to guard against (wrong player writing another's score, forging
  `started`, etc.) — blocked on Epic 3's test infra landing
  (`docs/agent/testing.md`).
- `isAddingPlayer()`'s second branch reads `request.writeFields`, which
  isn't a documented Firestore Rules variable — it's very likely dead code
  that always evaluates falsy, meaning `arrayUnion`-style player-add writes
  from `addPlayerToRoom` may only be passing today because of the first
  branch's list-diff check. Worth confirming against the emulator before
  touching `isAddingPlayer` for any other reason.

Until emulator tests exist, exercise any change to `roomsFirestore.ts`
against the local emulator (`npm run emulators`) before shipping it — there's
no automated check standing in for that yet.

## Trust boundary for client-submitted writes

There's no auth in this app — any visitor with a room code is an equally
trusted (or untrusted) client. That shapes what's worth enforcing:

- **Should be rejected outright (belongs in `firestore.rules`):** a client
  writing another player's entry in `players` (`playerId` in the write must
  match the entry being changed), a non-host client forging `started: true`
  or `difficulty`, and any client writing to a room it was never part of.
  The current `firestore.rules` doesn't fully express the "own player only"
  constraint yet — its `isUpdatingPlayerScores()`/`isAddingPlayer()` checks
  validate shape, not which player index changed. Tightening this is
  tracked as a follow-up to #50, once emulator tests exist to verify a
  tightened rule doesn't also break legitimate writes.
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
