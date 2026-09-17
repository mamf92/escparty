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
  clobber each other.
- **Race-prone:** `updatePlayerScore` and `markPlayerAtMidQuiz` both do a
  manual read-modify-write (`getDoc` then `updateDoc` with a recomputed
  array). Two near-simultaneous calls for different players can read the
  same snapshot and each overwrite the other's change, silently dropping one
  player's score update or mid-quiz-ready flag. No Firestore transaction is
  used anywhere in this file. If you're adding a new field that multiple
  clients might write concurrently, use `arrayUnion`/`arrayRemove` where the
  shape allows it, or a transaction — don't add another manual
  read-modify-write.

## Progression flags

- `continueReady` — host-set boolean signaling "advance to the next
  question" to observer-mode hosts. Reset by the host, not automatically.
- `playersAtMidQuiz` — array of player IDs who have reached the mid-quiz
  scoreboard, built via `markPlayerAtMidQuiz` (race-prone, see above) and
  cleared by `resetPlayersAtMidQuiz`.

## Security rules — known gap

**There is no `firestore.rules` file in this repository.** Production rules
exist only in the Firebase console and are not version-controlled or
reviewable in a PR diff. Error handling in `roomsFirestore.ts` for
`permission-denied` implies rules exist and are enforced, but their actual
content is invisible from the codebase. Treat any change to write patterns
here as a change to an implicit, unreviewed contract. This is a known
security gap — cross-link the repo's security-hardening work if you're
picking this up.

## Env / emulator

Firestore is initialized in `src/firebase.ts` from `VITE_FIREBASE_*` vars.
The emulator (`npm run emulators`, port 8080) is only wired up when running
locally in dev mode with `VITE_USE_FIREBASE_EMULATOR=true` — production and
production-preview builds always hit the real project. The exact set of
required `VITE_FIREBASE_*` keys is listed in `.env.example` and in
README.md's "Environment variables" section — that's the single source for
the list, not repeated here.
