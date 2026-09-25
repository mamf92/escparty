// Verification script for firestore.rules. CI runs it on every PR that
// touches the rules (.github/workflows/firestore-rules.yml); it isn't part
// of the Vitest suite (see docs/agent/testing.md). To run it by hand against
// a local emulator:
//
//   npm run emulators &
//   node scripts/verify-firestore-rules.mjs
//
// It exercises the real client SDK write paths roomsFirestore.ts uses
// (unauthenticated, matching production — this app has no Firebase Auth) and
// asserts which ones firestore.rules should allow vs. deny. Written to catch
// regressions while fixing the rules gaps found in #50 (hostId piggybacking,
// unvalidated player-array writes). Superseded once Epic 3's test infra
// lands and this can become a real emulator-based test suite.
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
} from "firebase/firestore";

const app = initializeApp({ projectId: "demo-escparty" });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);

let pass = 0;
let fail = 0;
function report(name, expected, actual) {
  const ok = actual === expected || actual.startsWith(expected + " ");
  console.log(`${ok ? "OK  " : "FAIL"} ${name} (expected=${expected} actual=${actual})`);
  if (ok) pass++; else fail++;
}

async function expectAllowed(name, fn) {
  try {
    await fn();
    report(name, "allowed", "allowed");
  } catch (e) {
    report(name, "allowed", `denied (${e.code})`);
  }
}

// Only a rules denial counts. Any other rejection (invalid-argument from a
// malformed write, unavailable from the emulator, the list case's
// unexpectedly-succeeded) means the rule was never actually exercised, so
// it's reported as a failure rather than a pass.
async function expectDenied(name, fn) {
  try {
    await fn();
    report(name, "denied", "allowed");
  } catch (e) {
    report(name, "denied", e.code === "permission-denied" ? "denied (permission-denied)" : `error (${e.code})`);
  }
}

function freshRoom(prefix) {
  const roomCode = prefix + Math.floor(Math.random() * 100000);
  const roomRef = doc(db, "rooms", roomCode);
  return { roomCode, roomRef };
}

async function createRoom(roomRef, id) {
  await setDoc(roomRef, {
    id,
    hostId: "host-1",
    started: false,
    createdAt: serverTimestamp(),
    players: [{ id: "host-1", name: "Host", score: 0 }],
  });
}

// 1. Legitimate room creation (host)
const { roomCode, roomRef } = freshRoom("TEST");
await expectAllowed("create room (host)", () => createRoom(roomRef, roomCode));

// 2. Legitimate player join via arrayUnion (real addPlayerToRoom shape)
await expectAllowed("join room (arrayUnion, valid player)", () =>
  updateDoc(roomRef, {
    players: arrayUnion({ id: "player-2", name: "Guest", score: 0 }),
  })
);

// 3. Malicious: append a new "player" that's missing a required field. Sized
// to exactly oldCount + 1 so this write actually reaches allPlayersValid via
// isAddingPlayer's exact-size-match branch, rather than getting denied on a
// size mismatch before shape validation is ever evaluated (which would give
// false confidence — the write is denied either way, but for the wrong
// reason, masking a regression that removes the shape check itself).
const evil = freshRoom("EVIL");
await createRoom(evil.roomRef, evil.roomCode);
await expectDenied("append a player missing required fields", () =>
  updateDoc(evil.roomRef, {
    players: [
      { id: "host-1", name: "Host", score: 0 },
      { id: "attacker-1", name: "Mallory" }, // no score
    ],
  })
);

// 3b. Malicious: same array length as a legitimate join (oldCount + 1), but
// with an EARLIER entry corrupted rather than just the appended one — this
// is the shape isAddingPlayer's "only validate the last entry" version
// missed, since size() == oldCount + 1 alone doesn't prove the write came
// from arrayUnion appending, not a full replace.
const evilAppend = freshRoom("EVILAPPEND");
await createRoom(evilAppend.roomRef, evilAppend.roomCode);
await expectDenied("replace earlier player while appending a valid-looking one", () =>
  updateDoc(evilAppend.roomRef, {
    players: [
      { id: "host-1" }, // host entry corrupted: no name/score
      { id: "player-2", name: "Guest", score: 0 }, // looks like a legit join
    ],
  })
);

// 4. Malicious: piggyback forged hostId onto a legitimate difficulty write
const diff1 = freshRoom("DIFF");
await createRoom(diff1.roomRef, diff1.roomCode);
await expectDenied("set difficulty + forge hostId in same write", () =>
  updateDoc(diff1.roomRef, {
    difficulty: "hard",
    hostId: "attacker-controlled",
  })
);

// 5. Legitimate: set difficulty alone, then start the game
const diff2 = freshRoom("DIFF2");
await createRoom(diff2.roomRef, diff2.roomCode);
await expectAllowed("set difficulty alone", () =>
  updateDoc(diff2.roomRef, { difficulty: "easy" })
);
await expectAllowed("start game after difficulty set", () =>
  updateDoc(diff2.roomRef, { started: true })
);

// 5b. Malicious: re-set difficulty after it's already been set once
const diff3 = freshRoom("DIFF3");
await createRoom(diff3.roomRef, diff3.roomCode);
await updateDoc(diff3.roomRef, { difficulty: "easy" });
await expectDenied("re-set difficulty after it's already set", () =>
  updateDoc(diff3.roomRef, { difficulty: "hard" })
);

// 5c. Malicious: list/enumerate the whole rooms collection with no code
await expectDenied("list the entire rooms collection with no code", async () => {
  const snap = await getDocs(collection(db, "rooms"));
  if (snap.size > 0) throw { code: "unexpectedly-succeeded", size: snap.size };
});

// 6. Legitimate: update player scores after game started
const score1 = freshRoom("SCORE");
await createRoom(score1.roomRef, score1.roomCode);
await updateDoc(score1.roomRef, { difficulty: "medium" });
await updateDoc(score1.roomRef, { started: true });
await expectAllowed("update player score after start", () =>
  updateDoc(score1.roomRef, {
    players: [{ id: "host-1", name: "Host", score: 500 }],
  })
);

// 6b. Malicious: same-size players array during an active game, but with a
// malformed entry (missing name/score) — exercises allPlayersValid via
// isUpdatingPlayerScores specifically, the other of the two branches this
// PR fixed. Without this, a regression that dropped allPlayersValid from
// just this branch would go undetected even though test 3/3b above cover
// the isAddingPlayer branch.
const score1b = freshRoom("SCOREB");
await createRoom(score1b.roomRef, score1b.roomCode);
await updateDoc(score1b.roomRef, { difficulty: "medium" });
await updateDoc(score1b.roomRef, { started: true });
await expectDenied("update players with malformed entry during active game", () =>
  updateDoc(score1b.roomRef, {
    players: [{ id: "host-1", name: "Host" }], // no score
  })
);

// 7. Malicious: piggyback forged hostId onto a legitimate score update
const score2 = freshRoom("SCORE2");
await createRoom(score2.roomRef, score2.roomCode);
await updateDoc(score2.roomRef, { difficulty: "medium" });
await updateDoc(score2.roomRef, { started: true });
await expectDenied("update score + forge hostId in same write", () =>
  updateDoc(score2.roomRef, {
    players: [{ id: "host-1", name: "Host", score: 500 }],
    hostId: "attacker-controlled",
  })
);

// 8. Legitimate: mid-quiz flag and continueReady
const flag = freshRoom("FLAG");
await createRoom(flag.roomRef, flag.roomCode);
await expectAllowed("set continueReady", () =>
  updateDoc(flag.roomRef, { continueReady: true })
);
await expectAllowed("set playersAtMidQuiz", () =>
  updateDoc(flag.roomRef, { playersAtMidQuiz: ["host-1"] })
);
await expectAllowed("reset playersAtMidQuiz to empty", () =>
  updateDoc(flag.roomRef, { playersAtMidQuiz: [] })
);

// 9. Malicious: forge started=true without difficulty ever being set
const forge = freshRoom("FORGE");
await createRoom(forge.roomRef, forge.roomCode);
await expectDenied("forge started=true with no difficulty set", () =>
  updateDoc(forge.roomRef, { started: true })
);

// 10. Malicious: add a player after the game has already started
const started = freshRoom("STARTED");
await createRoom(started.roomRef, started.roomCode);
await updateDoc(started.roomRef, { difficulty: "easy" });
await updateDoc(started.roomRef, { started: true });
await expectDenied("add player after game started", () =>
  updateDoc(started.roomRef, {
    players: arrayUnion({ id: "late-joiner", name: "Late", score: 0 }),
  })
);

// 11. Shared progression state (#61): phase / currentQuestionIndex /
// phaseStartedAt. createRoom writes them in the lobby shape, startGame moves
// them to the first question in the same write that flips `started`.
async function createRoomWithPhase(roomRef, id, overrides = {}) {
  await setDoc(roomRef, {
    id,
    hostId: "host-1",
    started: false,
    createdAt: serverTimestamp(),
    phase: "lobby",
    currentQuestionIndex: 0,
    phaseStartedAt: serverTimestamp(),
    players: [{ id: "host-1", name: "Host", score: 0 }],
    ...overrides,
  });
}
const startWrite = (overrides = {}) => ({
  started: true,
  phase: "question",
  currentQuestionIndex: 0,
  phaseStartedAt: serverTimestamp(),
  ...overrides,
});
const backdated = Timestamp.fromMillis(Date.now() - 60_000);

const phase1 = freshRoom("PHASE");
await expectAllowed("create room with lobby phase fields", () =>
  createRoomWithPhase(phase1.roomRef, phase1.roomCode)
);
await updateDoc(phase1.roomRef, { difficulty: "easy" });
await expectAllowed("start game with phase fields in the same write", () =>
  updateDoc(phase1.roomRef, startWrite())
);

// 11b. Legacy started-only write still works on a room created with the new
// fields (a cached pre-#61 client, or startGame's permission-denied fallback).
const phase2 = freshRoom("PHASELEGACY");
await createRoomWithPhase(phase2.roomRef, phase2.roomCode);
await updateDoc(phase2.roomRef, { difficulty: "easy" });
await expectAllowed("start game with started only on a phase-aware room", () =>
  updateDoc(phase2.roomRef, { started: true })
);

// 11c. New-shape start on a room created before #61 (no phase fields yet).
const phase3 = freshRoom("PHASEOLDROOM");
await createRoom(phase3.roomRef, phase3.roomCode);
await updateDoc(phase3.roomRef, { difficulty: "easy" });
await expectAllowed("start game with phase fields on a pre-#61 room", () =>
  updateDoc(phase3.roomRef, startWrite())
);

// 11d. Malicious creates: skip the lobby, or back-date the phase clock.
const phaseEvil1 = freshRoom("PHASEEVILA");
await expectDenied("create room already in the question phase", () =>
  createRoomWithPhase(phaseEvil1.roomRef, phaseEvil1.roomCode, { phase: "question" })
);
const phaseEvil2 = freshRoom("PHASEEVILB");
await expectDenied("create room on a later question", () =>
  createRoomWithPhase(phaseEvil2.roomRef, phaseEvil2.roomCode, { currentQuestionIndex: 4 })
);
const phaseEvil3 = freshRoom("PHASEEVILC");
await expectDenied("create room with a client-chosen phaseStartedAt", () =>
  createRoomWithPhase(phaseEvil3.roomRef, phaseEvil3.roomCode, { phaseStartedAt: backdated })
);

// 11e. Malicious starts: wrong phase/index, a client-chosen timestamp, a
// forged field riding along, or moving phase without starting the game.
// Each room is set up *before* expectDenied, so a denial during setup (say,
// a regression that stops phase-aware rooms being created) fails loudly
// instead of passing as "the start was denied".
async function readyToStart(prefix) {
  const room = freshRoom(prefix);
  await createRoomWithPhase(room.roomRef, room.roomCode);
  await updateDoc(room.roomRef, { difficulty: "easy" });
  return room.roomRef;
}
const evilD = await readyToStart("PHASEEVILD");
await expectDenied("start game straight into results", () =>
  updateDoc(evilD, startWrite({ phase: "results" }))
);
const evilE = await readyToStart("PHASEEVILE");
await expectDenied("start game on a later question", () =>
  updateDoc(evilE, startWrite({ currentQuestionIndex: 5 }))
);
const evilF = await readyToStart("PHASEEVILF");
await expectDenied("start game with a client-chosen phaseStartedAt", () =>
  updateDoc(evilF, startWrite({ phaseStartedAt: backdated }))
);
const evilG = await readyToStart("PHASEEVILG");
await expectDenied("start game with phase fields + forged hostId", () =>
  updateDoc(evilG, startWrite({ hostId: "attacker-controlled" }))
);
const evilH = await readyToStart("PHASEEVILH");
await expectDenied("move phase without starting the game", () =>
  updateDoc(evilH, {
    phase: "question",
    currentQuestionIndex: 0,
    phaseStartedAt: serverTimestamp(),
  })
);
const evilI = freshRoom("PHASEEVILI");
await createRoomWithPhase(evilI.roomRef, evilI.roomCode);
await expectDenied("start game with phase fields but no difficulty set", () =>
  updateDoc(evilI.roomRef, startWrite())
);

// 11f. The phase fields can't ride along on any other legitimate write.
// Each of these is exactly an allowed write plus a jump to the results
// phase; only the phase keys make it a forgery.
const skipToResults = { phase: "results", currentQuestionIndex: 9 };
// A fresh lobby room per case: if one forgery got through, the room would
// already be in "results" and the next case's phase keys wouldn't change
// anything, so a shared room would muddle which rule broke.
async function lobbyRoom(prefix) {
  const room = freshRoom(prefix);
  await createRoomWithPhase(room.roomRef, room.roomCode);
  return room.roomRef;
}
const piggyA = await lobbyRoom("PHASEPIGGYA");
await expectDenied("phase fields riding on setting difficulty", () =>
  updateDoc(piggyA, { difficulty: "easy", ...skipToResults })
);
const piggyB = await lobbyRoom("PHASEPIGGYB");
await expectDenied("phase fields riding on a player join", () =>
  updateDoc(piggyB, {
    players: arrayUnion({ id: "player-2", name: "Guest", score: 0 }),
    ...skipToResults,
  })
);
const piggyC = await lobbyRoom("PHASEPIGGYC");
await expectDenied("phase fields riding on continueReady", () =>
  updateDoc(piggyC, { continueReady: true, ...skipToResults })
);
const piggyD = await lobbyRoom("PHASEPIGGYD");
await expectDenied("phase fields riding on playersAtMidQuiz", () =>
  updateDoc(piggyD, { playersAtMidQuiz: ["host-1"], ...skipToResults })
);
const piggyStarted = await readyToStart("PHASEPIGGYE");
await updateDoc(piggyStarted, startWrite());
await expectDenied("phase fields riding on a score update", () =>
  updateDoc(piggyStarted, {
    players: [{ id: "host-1", name: "Host", score: 500 }],
    ...skipToResults,
  })
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
