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
  arrayRemove,
  serverTimestamp,
  Timestamp,
  collection,
  getDoc,
  getDocs,
  deleteDoc,
  runTransaction,
  writeBatch,
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

// The one start write firestore.rules accepts (since #62): flip `started`
// and move the room into question 0 in the same write.
const startWrite = (overrides = {}) => ({
  started: true,
  phase: "question",
  currentQuestionIndex: 0,
  phaseStartedAt: serverTimestamp(),
  ...overrides,
});

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

// 1b. Rooms expire (#248): createRoom stamps expireAt about 30 days out for
// the TTL policy. The rules take it only in parties' 1-60 day window, and
// no later write may move it (no update branch lists it).
const roomExpiry = (days) => Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
const expiring = freshRoom("EXPR");
await expectAllowed("create a room with expireAt 30 days out", () =>
  setDoc(expiring.roomRef, {
    id: expiring.roomCode, hostId: "host-1", started: false, createdAt: serverTimestamp(),
    expireAt: roomExpiry(30),
    players: [{ id: "host-1", name: "Host", score: 0 }],
  })
);
for (const [label, days] of [["a far-off expireAt", 400], ["an expireAt that is already near", 0]]) {
  const bad = freshRoom("EXPB");
  await expectDenied(`create a room with ${label}`, () =>
    setDoc(bad.roomRef, {
      id: bad.roomCode, hostId: "host-1", started: false, createdAt: serverTimestamp(),
      expireAt: roomExpiry(days),
      players: [{ id: "host-1", name: "Host", score: 0 }],
    })
  );
}
await expectDenied("move a room's expireAt after creation", () =>
  updateDoc(expiring.roomRef, { expireAt: roomExpiry(50) })
);
await expectDenied("add an expireAt to a room made without one", () =>
  updateDoc(roomRef, { expireAt: roomExpiry(30) })
);

// 2. Legitimate player join via arrayUnion (real addPlayerToRoom shape)
await expectAllowed("join room (arrayUnion, valid player)", () =>
  updateDoc(roomRef, {
    players: arrayUnion({ id: "player-2", name: "Guest", score: 0 }),
  })
);

// 2b. Joins are an arrayUnion (#64, addPlayerToRoom's write), appended
// server-side. Each guest here is its own client (its own app and write
// stream), so the three joins really are in flight at once, and all must
// land. Then a join races the host's start from two clients: whichever
// wins, the room must end up consistent (the guest is in and the game
// started, or the join was refused and the game started).
const clients = ["guest-a", "guest-b", "guest-c", "host-b"].map((name) => {
  const clientDb = getFirestore(initializeApp({ projectId: "demo-escparty" }, name));
  connectFirestoreEmulator(clientDb, "127.0.0.1", 8080);
  return clientDb;
});
const joinFrom = (clientDb, code, id) =>
  updateDoc(doc(clientDb, "rooms", code), { players: arrayUnion({ id, name: id, score: 0, joinedAt: Timestamp.now() }) });
const joiners = freshRoom("JOINS");
await createRoom(joiners.roomRef, joiners.roomCode);
await expectAllowed("three guests on three clients join at the same moment", () =>
  Promise.all(["g-1", "g-2", "g-3"].map((id, i) => joinFrom(clients[i], joiners.roomCode, id)))
);
const joined = (await getDoc(joiners.roomRef)).data().players.map((p) => p.id).sort();
report("every simultaneous join is in the room", "g-1,g-2,g-3,host-1", joined.join(","));
await updateDoc(joiners.roomRef, { difficulty: "easy" });
const [lateJoin] = await Promise.allSettled([
  joinFrom(clients[0], joiners.roomCode, "g-late"),
  updateDoc(doc(clients[3], "rooms", joiners.roomCode), startWrite()),
]);
const raced = (await getDoc(joiners.roomRef)).data();
const lateIn = raced.players.some((p) => p.id === "g-late");
report(
  "a join racing the start leaves the room consistent",
  "started, join matches room",
  `${raced.started ? "started" : "not started"}, join ${
    (lateJoin.status === "fulfilled") === lateIn &&
    (lateJoin.status === "fulfilled" || lateJoin.reason.code === "permission-denied")
      ? "matches room"
      : `${lateJoin.status} but in room=${lateIn}`
  }`,
);

// 2c. joinRoomWithFreeName's write: a transaction that reads the room and
// writes the list back with one more player. Ten clients join at the same
// moment, all wanting the name "Same"; each picks the first free "Same",
// "Same 2", ... in its transaction. Firestore does not retry the losers
// itself: the join rule compares the list's size with the room's at commit
// time, so a transaction built on a stale read is refused with
// permission-denied. The client (joinRoomWithFreeName, and this copy of it)
// reads again and retries when the room's players changed, so every guest
// must land, each under its own name.
const txJoiners = freshRoom("TXJ");
await createRoom(txJoiners.roomRef, txJoiners.roomCode);
const txJoinOnce = (clientDb, id) =>
  runTransaction(clientDb, async (transaction) => {
    const ref = doc(clientDb, "rooms", txJoiners.roomCode);
    const room = (await transaction.get(ref)).data();
    const taken = new Set(room.players.map((p) => p.name));
    let name = "Same";
    for (let n = 2; taken.has(name); n += 1) name = `Same ${n}`;
    transaction.update(ref, { players: [...room.players, { id, name, score: 0, joinedAt: Timestamp.now() }] });
  });
const txJoinFrom = async (clientDb, id) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await txJoinOnce(clientDb, id);
    } catch (e) {
      if (e.code !== "permission-denied" || attempt >= 40) throw e;
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 150));
    }
  }
};
const txClients = Array.from({ length: 10 }, (_, i) => `tx-${i}`).map((name) => {
  const clientDb = getFirestore(initializeApp({ projectId: "demo-escparty" }, name));
  connectFirestoreEmulator(clientDb, "127.0.0.1", 8080);
  return clientDb;
});
await expectAllowed("ten guests join by transaction at the same moment", () =>
  Promise.all(txClients.map((clientDb, i) => txJoinFrom(clientDb, `t-${i}`)))
);
const txPlayers = (await getDoc(txJoiners.roomRef)).data().players;
report("every transactional join is in the room", "10", String(txPlayers.length - 1));
report(
  "no two transactional joiners share a name",
  String(txPlayers.length),
  String(new Set(txPlayers.map((p) => p.name)).size),
);

// 2d. A full room (#229). Rules stop at 1000 evaluated expressions per
// write; checking every player on every write used to run out at the 13th
// player. Now a join checks only the new entry and a score write only the
// changed one, so a room fills to MAX_PLAYERS (32), with realistic entries,
// and still takes the writes a quiz makes. The 33rd join is refused.
const full = freshRoom("FULL");
await createRoom(full.roomRef, full.roomCode);
await updateDoc(full.roomRef, { difficulty: "easy" });
let fullCount = 1;
for (; fullCount < 32; fullCount += 1) {
  try {
    await updateDoc(full.roomRef, {
      players: arrayUnion({ id: `full-${fullCount}`, name: `Céline Dion ${fullCount}`, score: 0, joinedAt: Timestamp.now() }),
    });
  } catch {
    break;
  }
}
report("32 players fit in a room", "32", String(fullCount));
await expectDenied("a 33rd player joins a full room", () =>
  updateDoc(full.roomRef, { players: arrayUnion({ id: "full-33", name: "One too many", score: 0, joinedAt: Timestamp.now() }) })
);
await expectAllowed("a guest leaves the full lobby (arrayRemove)", async () => {
  const leaving = (await getDoc(full.roomRef)).data().players[31];
  await updateDoc(full.roomRef, { players: arrayRemove(leaving) });
});
await expectAllowed("a guest joins the room again by transaction", () =>
  runTransaction(db, async (transaction) => {
    const room = (await transaction.get(full.roomRef)).data();
    transaction.update(full.roomRef, {
      players: [...room.players, { id: "full-31b", name: "Céline Dion 31", score: 0, joinedAt: Timestamp.now() }],
    });
  })
);
await expectDenied("a join that rewrites an earlier player", async () => {
  const players = (await getDoc(full.roomRef)).data().players.slice(0, 31);
  players[3] = { ...players[3], score: 99 };
  await updateDoc(full.roomRef, { players: [...players, { id: "full-x", name: "X", score: 0 }] });
});
await expectAllowed("the full room starts", () =>
  updateDoc(full.roomRef, { started: true, phase: "question", currentQuestionIndex: 0, phaseStartedAt: serverTimestamp() })
);
await expectAllowed("the last of 32 players scores (updatePlayerScore's write)", async () => {
  const players = (await getDoc(full.roomRef)).data().players;
  players[31] = { ...players[31], score: 1200 };
  await updateDoc(full.roomRef, { players });
});
await expectAllowed("the host of 32 players scores", async () => {
  const players = (await getDoc(full.roomRef)).data().players;
  players[0] = { ...players[0], score: 800 };
  await updateDoc(full.roomRef, { players });
});
await expectDenied("a score write that makes one of 32 scores negative", async () => {
  const players = (await getDoc(full.roomRef)).data().players;
  players[20] = { ...players[20], score: -5 };
  await updateDoc(full.roomRef, { players });
});

// 3. Malicious: append a new "player" that's missing a required field. Sized
// to exactly oldCount + 1 so this write actually reaches the new entry's
// isValidPlayerBasic via isAddingPlayer's exact-size-match branch, rather than getting denied on a
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
  updateDoc(diff2.roomRef, startWrite())
);

// 5b. The host may change the quiz until the game starts (the green room's
// "Change" button), but not after, and only with the quiz keys alone.
const diff3 = freshRoom("DIFF3");
await createRoom(diff3.roomRef, diff3.roomCode);
await updateDoc(diff3.roomRef, { difficulty: "easy", breakEvery: 5 });
await expectAllowed("re-pick the quiz before the game starts", () =>
  updateDoc(diff3.roomRef, { difficulty: "t-nordic-nights", breakEvery: 3 })
);
await expectAllowed("re-pick the quiz without a break setting", () =>
  updateDoc(diff3.roomRef, { difficulty: "hard" })
);
await expectDenied("re-pick the quiz with an invalid key", () =>
  updateDoc(diff3.roomRef, { difficulty: "t-Not Valid", breakEvery: 3 })
);
await expectDenied("re-pick the quiz with an invalid break setting", () =>
  updateDoc(diff3.roomRef, { difficulty: "easy", breakEvery: 7 })
);
await expectDenied("re-pick the quiz while forging hostId", () =>
  updateDoc(diff3.roomRef, { difficulty: "easy", hostId: "attacker" })
);
await expectDenied("re-pick the quiz while flipping started", () =>
  updateDoc(diff3.roomRef, { difficulty: "easy", started: true })
);
await expectAllowed("start the game after re-picking", () =>
  updateDoc(diff3.roomRef, startWrite())
);
await expectDenied("re-pick the quiz after the game has started", () =>
  updateDoc(diff3.roomRef, { difficulty: "medium", breakEvery: 5 })
);

// 5d. Legitimate: a premade quiz as the room's quiz (#72), then start it
const tpl = freshRoom("TPL");
await createRoom(tpl.roomRef, tpl.roomCode);
await expectAllowed("set a premade quiz (t-<id>) as the room's quiz", () =>
  updateDoc(tpl.roomRef, { difficulty: "t-nordic-nights" })
);
await expectAllowed("start a game with a premade quiz", () =>
  updateDoc(tpl.roomRef, startWrite())
);

// 5e. Malicious: a quiz key that is neither a difficulty nor a template id
for (const [label, value] of [
  ["an unknown difficulty", "impossible"],
  ["a template key with uppercase/spaces", "t-Nordic Nights"],
  ["an empty template key", "t-"],
  ["an overlong template key", "t-" + "a".repeat(41)],
]) {
  const bad = freshRoom("BADQ");
  await createRoom(bad.roomRef, bad.roomCode);
  await expectDenied(`set ${label} as the room's quiz`, () =>
    updateDoc(bad.roomRef, { difficulty: value })
  );
}

// 5f. A room may be created with its quiz already named, but only a real
// quiz key: creation used to accept any string, leaving the room stuck on a
// quiz no client can play (the quiz can only be re-picked before the start).
const preset = freshRoom("PRESET");
await expectAllowed("create a room with a premade quiz already named", () =>
  setDoc(preset.roomRef, {
    id: preset.roomCode, hostId: "host-1", started: false, createdAt: serverTimestamp(),
    players: [{ id: "host-1", name: "Host", score: 0 }], difficulty: "t-quick-fire",
  })
);
const bogus = freshRoom("BOGUS");
await expectDenied("create a room with a bogus quiz key", () =>
  setDoc(bogus.roomRef, {
    id: bogus.roomCode, hostId: "host-1", started: false, createdAt: serverTimestamp(),
    players: [{ id: "host-1", name: "Host", score: 0 }], difficulty: "bogus",
  })
);

// 5g. The quiz's break setting rides along with the quiz key, once (#75),
// and custom quizzes are named `c-` plus their 20-character document id.
const brk = freshRoom("BRK");
await createRoom(brk.roomRef, brk.roomCode);
await expectAllowed("set a custom quiz with its break setting", () =>
  updateDoc(brk.roomRef, { difficulty: "c-AbCdEfGhIjKlMnOpQrSt", breakEvery: 4 })
);
await expectAllowed("change the break setting before the game starts", () =>
  updateDoc(brk.roomRef, { breakEvery: 0 })
);
const brkBad = freshRoom("BRKBAD");
await createRoom(brkBad.roomRef, brkBad.roomCode);
await expectDenied("set a break setting that isn't a choice", () =>
  updateDoc(brkBad.roomRef, { difficulty: "easy", breakEvery: 7 })
);
await expectDenied("set a custom quiz key of the wrong length", () =>
  updateDoc(brkBad.roomRef, { difficulty: "c-short" })
);
const brkAlone = freshRoom("BRKALONE");
await createRoom(brkAlone.roomRef, brkAlone.roomCode);
await expectDenied("set the break setting without a quiz", () =>
  updateDoc(brkAlone.roomRef, { breakEvery: 3 })
);

// 5h. Saved custom quizzes (#76): readable by id, never listed, never changed.
const quizRef = doc(collection(db, "quizzes"));
const aQuiz = (overrides = {}) => ({
  title: "Jedward's Revenge",
  breakEvery: 5,
  questions: [{ id: "q1", question: "Who?", options: ["A", "B"], correctAnswer: "A", source: "custom" }],
  createdAt: serverTimestamp(),
  ...overrides,
});
await expectAllowed("save a custom quiz", () => setDoc(quizRef, aQuiz()));
await expectAllowed("read a custom quiz by id", () => getDoc(quizRef));
await expectDenied("list the quizzes collection", async () => {
  const snap = await getDocs(collection(db, "quizzes"));
  if (snap.size > 0) throw { code: "unexpectedly-succeeded", size: snap.size };
});
await expectDenied("change a saved quiz", () => updateDoc(quizRef, { title: "Hijacked" }));
for (const [label, overrides] of [
  ["no questions", { questions: [] }],
  ["51 questions", { questions: Array.from({ length: 51 }, () => aQuiz().questions[0]) }],
  ["an empty title", { title: "" }],
  ["a 61-character title", { title: "x".repeat(61) }],
  ["a break setting that isn't a choice", { breakEvery: 6 }],
  ["a client-chosen createdAt", { createdAt: Timestamp.fromMillis(0) }],
  ["an extra field", { ownerId: "someone" }],
]) {
  await expectDenied(`save a quiz with ${label}`, () => setDoc(doc(collection(db, "quizzes")), aQuiz(overrides)));
}

// 5i. Scoreboard parties (#79): created whole, found by code, never listed;
// host edits by shape only; each guest writes their own ballot.
const partyCode = "P" + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + "RT";
const partyRef = doc(db, "parties", partyCode);
const aParty = (overrides = {}) => ({
  code: partyCode,
  hostId: "host-1",
  title: "Burgas 2027 · Grand final",
  contestId: "burgas-2027-final",
  kind: "final",
  qualifiers: 0,
  acts: [{ id: "se", country: "Sweden", flag: "🇸🇪", artist: "TBA", song: "TBA" }],
  template: { id: "douze", name: "Douze Points", blurb: "", categories: [{ id: "points", label: "Points", max: 12 }] },
  bonuses: true,
  showNames: true,
  results: {},
  revealed: false,
  createdAt: serverTimestamp(),
  expireAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
  ...overrides,
});
for (const [label, overrides] of [
  ["results already in", { results: { places: { se: 1 } } }],
  ["the awards already open", { revealed: true }],
  ["no acts", { acts: [] }],
  ["seven categories", { template: { categories: Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, label: `C${i}`, max: 10 }) ) } }],
  ["a code that doesn't match its document", { code: "ZZZZ" }],
  ["a client-chosen createdAt", { createdAt: Timestamp.fromMillis(0) }],
  ["a far-off expireAt", { expireAt: Timestamp.fromMillis(Date.now() + 400 * 24 * 60 * 60 * 1000) }],
  ["an extra field", { adminOf: "everything" }],
]) {
  await expectDenied(`create a party with ${label}`, () => setDoc(partyRef, aParty(overrides)));
}
await expectDenied("create a party under a lowercase code", () =>
  setDoc(doc(db, "parties", "abcd"), aParty({ code: "abcd" }))
);
await expectAllowed("create a party", () => setDoc(partyRef, aParty()));
await expectAllowed("read a party by code", () => getDoc(partyRef));
await expectDenied("list the parties collection", async () => {
  const snap = await getDocs(collection(db, "parties"));
  if (snap.size > 0) throw { code: "unexpectedly-succeeded", size: snap.size };
});
await expectDenied("create over an existing party", () => setDoc(partyRef, aParty()));
await expectAllowed("edit the running order", () =>
  updateDoc(partyRef, { acts: [...aParty().acts, { id: "no", country: "Norway", flag: "🇳🇴", artist: "TBA", song: "TBA" }] })
);
await expectAllowed("enter real results", () => updateDoc(partyRef, { results: { places: { se: 2, no: 1 } } }));
await expectAllowed("open the awards", () => updateDoc(partyRef, { revealed: true }));
await expectDenied("change the party's host", () => updateDoc(partyRef, { hostId: "attacker" }));
await expectDenied("change the rating template mid-party", () => updateDoc(partyRef, { template: { categories: [] } }));
await expectDenied("results with an unknown key", () => updateDoc(partyRef, { results: { winner: "se" } }));
await expectDenied("empty the running order", () => updateDoc(partyRef, { acts: [] }));

const ballotRef = doc(db, "parties", partyCode, "ballots", "guest-1");
// An override of `undefined` leaves that field out.
const aBallot = (overrides = {}) => Object.fromEntries(Object.entries({
  name: "Loreen",
  ratings: { se: { points: 12 } },
  bonuses: { se: ["wind"] },
  updatedAt: serverTimestamp(),
  expireAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
  ...overrides,
}).filter(([, value]) => value !== undefined));
// A first ballot comes with its name claim (#229, case 5b).
await expectAllowed("save a first ballot with its name claim", async () => {
  const batch = writeBatch(db);
  batch.set(doc(db, "parties", partyCode, "names", "loreen"), {
    name: "Loreen", guestId: "guest-1", expireAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  batch.set(ballotRef, aBallot());
  await batch.commit();
});
await expectAllowed("update a ballot", () => setDoc(ballotRef, aBallot({ ratings: { se: { points: 10 } } })));
await expectAllowed("read every ballot in a party", () => getDocs(collection(db, "parties", partyCode, "ballots")));
await expectDenied("save a ballot in a party that doesn't exist", () =>
  setDoc(doc(db, "parties", "NONE", "ballots", "guest-1"), aBallot())
);
for (const [label, overrides] of [
  ["no name", { name: "" }],
  ["a 41-character name", { name: "x".repeat(41) }],
  ["a client-chosen updatedAt", { updatedAt: Timestamp.fromMillis(0) }],
  ["an extra field", { isHost: true }],
  ["ratings that aren't a map", { ratings: [12] }],
  ["a far-off expireAt", { expireAt: Timestamp.fromMillis(Date.now() + 400 * 24 * 60 * 60 * 1000) }],
  ["no expireAt", { expireAt: undefined }],
]) {
  await expectDenied(`save a ballot with ${label}`, () => setDoc(ballotRef, aBallot(overrides)));
}
await expectDenied("delete a ballot", () => deleteDoc(ballotRef));
// 5b. Party name claims (#229, joinParty): a guest joins by creating
// names/{key} (the name trimmed, lower case) with their first ballot in one
// batch. A claim is never changed, so the second guest to want a name is
// refused, ballot and all.
const aClaim = (overrides = {}) => Object.fromEntries(Object.entries({
  name: "Céline Dion",
  guestId: "claim-1",
  expireAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
  ...overrides,
}).filter(([, value]) => value !== undefined));
const joinBatch = (clientDb, key, claim) => {
  const batch = writeBatch(clientDb);
  batch.set(doc(clientDb, "parties", partyCode, "names", key), claim);
  batch.set(doc(clientDb, "parties", partyCode, "ballots", claim.guestId), aBallot({ name: claim.name, ratings: {}, bonuses: {} }));
  return batch.commit();
};
await expectAllowed("claim a name with the first ballot", () => joinBatch(db, "céline dion", aClaim()));
await expectAllowed("read a name claim", () => getDoc(doc(db, "parties", partyCode, "names", "céline dion")));
await expectDenied("claim a name someone has", () => joinBatch(db, "céline dion", aClaim({ guestId: "claim-2", name: " CÉLINE DION" })));
report(
  "a refused claim writes no ballot",
  "false",
  String((await getDoc(doc(db, "parties", partyCode, "ballots", "claim-2"))).exists()),
);
await expectDenied("hand a claimed name to someone else", () =>
  setDoc(doc(db, "parties", partyCode, "names", "céline dion"), aClaim({ guestId: "claim-2" }))
);
await expectDenied("give a claimed name up", () => deleteDoc(doc(db, "parties", partyCode, "names", "céline dion")));
await expectDenied("list a party's names", () => getDocs(collection(db, "parties", partyCode, "names")));
await expectDenied("claim a name in a party that doesn't exist", () =>
  setDoc(doc(db, "parties", "NONE", "names", "céline dion"), aClaim())
);
await expectDenied("claim a name without a ballot", () =>
  setDoc(doc(db, "parties", partyCode, "names", "abba"), aClaim({ name: "ABBA", guestId: "squatter" }))
);
await expectDenied("a first ballot without a claim on its name", () =>
  setDoc(doc(db, "parties", partyCode, "ballots", "no-claim"), aBallot({ name: "Abba" }))
);
await expectDenied("a first ballot under someone else's claimed name", () =>
  setDoc(doc(db, "parties", partyCode, "ballots", "claim-3"), aBallot({ name: "Céline Dion" }))
);
await expectDenied("a claim whose ballot has another name", async () => {
  const batch = writeBatch(db);
  batch.set(doc(db, "parties", partyCode, "names", "abba"), aClaim({ name: "ABBA", guestId: "claim-4" }));
  batch.set(doc(db, "parties", partyCode, "ballots", "claim-4"), aBallot({ name: "Lordi" }));
  await batch.commit();
});
await expectDenied("rename a ballot to someone else's claimed name", () =>
  setDoc(doc(db, "parties", partyCode, "ballots", "claim-1"), aBallot({ name: "Loreen" }))
);
await expectAllowed("the claimant updates their ballot", () =>
  setDoc(doc(db, "parties", partyCode, "ballots", "claim-1"), aBallot({ name: "Céline Dion" }))
);
const hostPartyCode = Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
await expectAllowed("create a party with the host's claim and ballot in one batch", async () => {
  const batch = writeBatch(db);
  batch.set(doc(db, "parties", hostPartyCode), aParty({ code: hostPartyCode }));
  batch.set(doc(db, "parties", hostPartyCode, "names", "loreen"), aClaim({ name: "Loreen", guestId: "host-p" }));
  batch.set(doc(db, "parties", hostPartyCode, "ballots", "host-p"), aBallot({ name: "Loreen", ratings: {}, bonuses: {} }));
  await batch.commit();
});
for (const [label, key, overrides] of [
  ["a key that isn't the name", "someone else", {}],
  ["a key that keeps the case", "Céline Dion", {}],
  ["no guestId", "céline dion 2", { name: "Céline Dion 2", guestId: undefined }],
  ["an extra field", "céline dion 2", { name: "Céline Dion 2", isHost: true }],
  ["a far-off expireAt", "céline dion 2", { name: "Céline Dion 2", expireAt: Timestamp.fromMillis(Date.now() + 400 * 24 * 60 * 60 * 1000) }],
]) {
  await expectDenied(`claim a name with ${label}`, () => setDoc(doc(db, "parties", partyCode, "names", key), aClaim(overrides)));
}
// Five guests land "Käärijä" at the same moment, each on its own client:
// exactly one gets it.
const claimClients = Array.from({ length: 5 }, (_, i) => `claim-${i}`).map((name) => {
  const clientDb = getFirestore(initializeApp({ projectId: "demo-escparty" }, name));
  connectFirestoreEmulator(clientDb, "127.0.0.1", 8080);
  return clientDb;
});
const claims = await Promise.allSettled(
  claimClients.map((clientDb, i) => joinBatch(clientDb, "käärijä", aClaim({ name: "Käärijä", guestId: `race-${i}` })))
);
report("one of five simultaneous claims of a name lands", "1", String(claims.filter((c) => c.status === "fulfilled").length));
report(
  "the others are refused by the rules",
  "4",
  String(claims.filter((c) => c.status === "rejected" && c.reason.code === "permission-denied").length),
);

// 5j. Party nights (#231, #232): one code for an evening, above the quiz
// rooms and scoreboard parties played in it. Created whole and open; guests
// join with a create-only name claim in one batch (and leave by deleting both);
// the activity list only grows by one valid entry at a time; a night closes
// once and may hand over to a fresh night of the same host.
const nightLetters = () => Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
const nightExpiry = (days = 30) => Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);
const nightRef = (code) => doc(db, "nights", code);
const guestRef = (code, id) => doc(db, "nights", code, "guests", id);
const claimRef = (code, key) => doc(db, "nights", code, "names", key);
const aNight = (code, overrides = {}) => Object.fromEntries(Object.entries({
  code,
  hostId: "night-host",
  title: "Saturday at Ola's",
  activities: [],
  closed: false,
  createdAt: serverTimestamp(),
  expireAt: nightExpiry(),
  ...overrides,
}).filter(([, value]) => value !== undefined));
const aNightGuest = (overrides = {}) => Object.fromEntries(Object.entries({
  name: "Loreen",
  joinedAt: serverTimestamp(),
  expireAt: nightExpiry(),
  ...overrides,
}).filter(([, value]) => value !== undefined));
const aNightClaim = (name, guestId, overrides = {}) => Object.fromEntries(Object.entries({
  name,
  guestId,
  expireAt: nightExpiry(),
  ...overrides,
}).filter(([, value]) => value !== undefined));
// joinNight's write: the guest and their claim on the name, in one batch.
const joinNightBatch = (clientDb, code, guestId, name) => {
  const batch = writeBatch(clientDb);
  batch.set(doc(clientDb, "nights", code, "names", name.trim().toLowerCase()), aNightClaim(name, guestId));
  batch.set(doc(clientDb, "nights", code, "guests", guestId), aNightGuest({ name }));
  return batch.commit();
};
// leaveNight's write: both documents deleted together.
const leaveNightBatch = (clientDb, code, guestId, name) => {
  const batch = writeBatch(clientDb);
  batch.delete(doc(clientDb, "nights", code, "guests", guestId));
  batch.delete(doc(clientDb, "nights", code, "names", name.trim().toLowerCase()));
  return batch.commit();
};
// A night made on its own (no host guest), for cases that are about the night.
const newNight = async (overrides = {}) => {
  const code = nightLetters();
  await setDoc(nightRef(code), aNight(code, overrides));
  return code;
};
const roomIn = async (nightCode, overrides = {}) => {
  const code = nightLetters();
  await setDoc(doc(db, "rooms", code), {
    id: code,
    hostId: "host-1",
    started: false,
    createdAt: serverTimestamp(),
    players: [{ id: "host-1", name: "Host", score: 0 }],
    ...(nightCode ? { nightCode } : {}),
    ...overrides,
  });
  return code;
};
const partyIn = async (nightCode) => {
  const code = nightLetters();
  await setDoc(doc(db, "parties", code), aParty({ code, ...(nightCode ? { nightCode } : {}) }));
  return code;
};
const anActivity = (kind, code, overrides = {}) => ({ kind, code, title: kind === "quiz" ? "Pub quiz" : "Grand final", ...overrides });

// Creation
const badNightCode = nightLetters();
for (const [label, overrides] of [
  ["a code that doesn't match its document", { code: "ZZZZ" }],
  ["an activity already listed", { activities: [anActivity("quiz", "ABBA")] }],
  ["the night already closed", { closed: true }],
  ["a client-chosen createdAt", { createdAt: Timestamp.fromMillis(0) }],
  ["a far-off expireAt", { expireAt: nightExpiry(400) }],
  ["an expireAt that is already near", { expireAt: nightExpiry(0) }],
  ["no expireAt", { expireAt: undefined }],
  ["no title", { title: "" }],
  ["a 61-character title", { title: "x".repeat(61) }],
  ["no host", { hostId: "" }],
  ["a 65-character host id", { hostId: "h".repeat(65) }],
  ["a host id that isn't a string", { hostId: 7 }],
  ["a moved-to code", { movedTo: "ABBA" }],
  ["an extra field", { adminOf: "everything" }],
]) {
  await expectDenied(`create a night with ${label}`, () => setDoc(nightRef(badNightCode), aNight(badNightCode, overrides)));
}
await expectDenied("create a night under a lowercase code", () => setDoc(nightRef("abcd"), aNight("abcd")));
const nightCode = nightLetters();
await expectAllowed("create a night with the host's guest and claim in one batch", async () => {
  const batch = writeBatch(db);
  batch.set(nightRef(nightCode), aNight(nightCode));
  batch.set(claimRef(nightCode, "ola"), aNightClaim("Ola", "night-host"));
  batch.set(guestRef(nightCode, "night-host"), aNightGuest({ name: "Ola" }));
  await batch.commit();
});
await expectAllowed("read a night by code", () => getDoc(nightRef(nightCode)));
await expectDenied("list the nights collection", async () => {
  const snap = await getDocs(collection(db, "nights"));
  if (snap.size > 0) throw { code: "unexpectedly-succeeded", size: snap.size };
});
await expectDenied("create over an existing night", () => setDoc(nightRef(nightCode), aNight(nightCode)));
await expectDenied("delete a night", () => deleteDoc(nightRef(nightCode)));
await expectDenied("change a night's title", () => updateDoc(nightRef(nightCode), { title: "Elsewhere" }));
await expectDenied("change a night's host", () => updateDoc(nightRef(nightCode), { hostId: "attacker" }));

// Guests and name claims
const guestClients = claimClients;
await expectAllowed("join a night with a claim on the name, in one batch", () => joinNightBatch(guestClients[0], nightCode, "ng-1", "Loreen"));
await expectAllowed("read the roster of a night", async () => {
  const snap = await getDocs(collection(db, "nights", nightCode, "guests"));
  if (snap.size !== 2) throw { code: "wrong-roster", size: snap.size };
});
await expectAllowed("read a name claim in a night", () => getDoc(claimRef(nightCode, "loreen")));
await expectDenied("list a night's names", () => getDocs(collection(db, "nights", nightCode, "names")));
await expectDenied("claim a name someone has in a night", () => joinNightBatch(guestClients[1], nightCode, "ng-2", " LOREEN "));
report(
  "a refused night claim writes no guest",
  "false",
  String((await getDoc(guestRef(nightCode, "ng-2"))).exists()),
);
await expectDenied("a guest without a claim on their name", () => setDoc(guestRef(nightCode, "ng-3"), aNightGuest({ name: "Lordi" })));
await expectDenied("a claim without a guest", () => setDoc(claimRef(nightCode, "lordi"), aNightClaim("Lordi", "ng-3")));
await expectDenied("a guest under someone else's claimed name", () => setDoc(guestRef(nightCode, "ng-3"), aNightGuest({ name: "Loreen" })));
await expectDenied("a claim whose guest has another name", async () => {
  const batch = writeBatch(db);
  batch.set(claimRef(nightCode, "lordi"), aNightClaim("Lordi", "ng-4"));
  batch.set(guestRef(nightCode, "ng-4"), aNightGuest({ name: "Hatari" }));
  await batch.commit();
});
await expectDenied("a claim for another guest's id", async () => {
  const batch = writeBatch(db);
  batch.set(claimRef(nightCode, "lordi"), aNightClaim("Lordi", "ng-5"));
  batch.set(guestRef(nightCode, "ng-4"), aNightGuest({ name: "Lordi" }));
  await batch.commit();
});
for (const [label, key, guestOverrides, claimOverrides] of [
  ["a key that isn't the name", "someone else", {}, {}],
  ["a key that keeps the case", "Lordi", {}, {}],
  ["a 41-character name", "x".repeat(41), { name: "x".repeat(41) }, { name: "x".repeat(41) }],
  ["a client-chosen joinedAt", "lordi", { joinedAt: Timestamp.fromMillis(0) }, {}],
  ["an extra field on the guest", "lordi", { isHost: true }, {}],
  ["a far-off expireAt on the guest", "lordi", { expireAt: nightExpiry(400) }, {}],
  ["a far-off expireAt on the claim", "lordi", {}, { expireAt: nightExpiry(400) }],
  ["an extra field on the claim", "lordi", {}, { isHost: true }],
  ["a 65-character guest id", "lordi", {}, { guestId: "g".repeat(65) }],
]) {
  await expectDenied(`join a night with ${label}`, async () => {
    const guestName = guestOverrides.name ?? "Lordi";
    const guestId = claimOverrides.guestId ?? "ng-6";
    const batch = writeBatch(db);
    batch.set(claimRef(nightCode, key), aNightClaim(guestName, guestId, claimOverrides));
    batch.set(guestRef(nightCode, guestId), aNightGuest({ name: guestName, ...guestOverrides }));
    await batch.commit();
  });
}
await expectDenied("join a night that doesn't exist", () => joinNightBatch(db, "NONE", "ng-1", "Loreen"));
await expectDenied("rename a guest", () => setDoc(guestRef(nightCode, "ng-1"), aNightGuest({ name: "Netta" })));
await expectDenied("hand a claimed name to someone else", () => setDoc(claimRef(nightCode, "loreen"), aNightClaim("Loreen", "ng-2")));

// Five guests land "Käärijä" at the same moment, each on its own client:
// exactly one gets it.
const nightClaims = await Promise.allSettled(
  claimClients.map((clientDb, i) => joinNightBatch(clientDb, nightCode, `nrace-${i}`, "Käärijä"))
);
report("one of five simultaneous night claims of a name lands", "1", String(nightClaims.filter((c) => c.status === "fulfilled").length));
report(
  "the others are refused by the rules",
  "4",
  String(nightClaims.filter((c) => c.status === "rejected" && c.reason.code === "permission-denied").length),
);
const raceGuests = (await getDocs(collection(db, "nights", nightCode, "guests"))).docs.filter((d) => d.id.startsWith("nrace-"));
report("only the winner is on the roster", "1", String(raceGuests.length));

// Leaving: guest and claim go together, so the name is free again.
await expectDenied("leave a night, deleting the guest but not the claim", () => deleteDoc(guestRef(nightCode, "ng-1")));
await expectDenied("leave a night, deleting the claim but not the guest", () => deleteDoc(claimRef(nightCode, "loreen")));
await expectDenied("delete a guest and another guest's claim", async () => {
  const batch = writeBatch(db);
  batch.delete(guestRef(nightCode, "ng-1"));
  batch.delete(claimRef(nightCode, "ola"));
  await batch.commit();
});
await expectAllowed("leave a night (guest and claim in one batch)", () => leaveNightBatch(db, nightCode, "ng-1", "Loreen"));
report("the name is free after a leave", "false", String((await getDoc(claimRef(nightCode, "loreen"))).exists()));
await expectAllowed("another guest takes the freed name", () => joinNightBatch(guestClients[2], nightCode, "ng-7", "Loreen"));

// Rooms and parties made in a night
const roomInNight = await roomIn(nightCode);
await expectDenied("create a room for a night that doesn't exist", () => roomIn("NONE"));
await expectDenied("create a room with a lowercase night code", () => roomIn("abcd"));
await expectDenied("create a room with a night code that isn't a string", () => roomIn(7));
await expectDenied("point a room outside a night at a night afterwards", async () => {
  const code = await roomIn(null);
  await updateDoc(doc(db, "rooms", code), { nightCode });
});
await expectDenied("move a room to another night", async () => {
  const other = await newNight();
  await updateDoc(doc(db, "rooms", roomInNight), { nightCode: other });
});
await expectDenied("create a party for a night that doesn't exist", () => partyIn("NONE"));
const partyInNight = await partyIn(nightCode);
await expectDenied("move a party to another night", async () => {
  const other = await newNight();
  await updateDoc(doc(db, "parties", partyInNight), { nightCode: other });
});

// Party ballots: deletable (with their claim) only in a night's party
const nightGuestBallot = (guestId, name) => {
  const batch = writeBatch(db);
  batch.set(doc(db, "parties", partyInNight, "names", name.trim().toLowerCase()), aClaim({ name, guestId }));
  batch.set(doc(db, "parties", partyInNight, "ballots", guestId), aBallot({ name, ratings: {}, bonuses: {} }));
  return batch.commit();
};
await nightGuestBallot("npg-1", "Netta");
await expectDenied("delete a ballot in a night's party, leaving its claim", () =>
  deleteDoc(doc(db, "parties", partyInNight, "ballots", "npg-1"))
);
await expectDenied("delete a claim in a night's party, leaving its ballot", () =>
  deleteDoc(doc(db, "parties", partyInNight, "names", "netta"))
);
await expectAllowed("delete a ballot and its claim in a night's party (a leave)", async () => {
  const batch = writeBatch(db);
  batch.delete(doc(db, "parties", partyInNight, "ballots", "npg-1"));
  batch.delete(doc(db, "parties", partyInNight, "names", "netta"));
  await batch.commit();
});
await expectAllowed("the freed name can be claimed again in the party", () => nightGuestBallot("npg-2", "Netta"));
await expectDenied("delete a ballot and its claim in a standalone party", async () => {
  const batch = writeBatch(db);
  batch.delete(doc(db, "parties", partyCode, "ballots", "claim-1"));
  batch.delete(doc(db, "parties", partyCode, "names", "céline dion"));
  await batch.commit();
});

// Listing activities
const listed = await newNight();
const roomA = await roomIn(listed);
const roomOutside = await roomIn(null);
const roomElsewhere = await roomIn(nightCode);
const partyA = await partyIn(listed);
await expectAllowed("list a quiz room made in the night", () =>
  updateDoc(nightRef(listed), { activities: arrayUnion(anActivity("quiz", roomA)) })
);
await expectAllowed("list a scoreboard party made in the night", () =>
  updateDoc(nightRef(listed), { activities: arrayUnion(anActivity("scoreboard", partyA)) })
);
for (const [label, activity] of [
  ["a room made outside any night", anActivity("quiz", roomOutside)],
  ["a room made in another night", anActivity("quiz", roomElsewhere)],
  ["a room that doesn't exist", anActivity("quiz", "NONE")],
  ["a party that is really a room's code", anActivity("scoreboard", roomA)],
  ["a room listed as a party", anActivity("quiz", partyA)],
  ["a lowercase code", anActivity("quiz", roomA.toLowerCase())],
  ["an unknown kind", anActivity("karaoke", roomA)],
  ["no title", anActivity("quiz", roomA, { title: "" })],
  ["an 81-character title", anActivity("quiz", roomA, { title: "x".repeat(81) })],
  ["an extra key", anActivity("quiz", roomA, { winner: "me" })],
  ["something that isn't a map", "quiz:" + roomA],
]) {
  // arrayUnion skips an entry the list already has, so a repeat of roomA's
  // quiz can't be what is refused here: each of these differs from it.
  await expectDenied(`list ${label}`, () => updateDoc(nightRef(listed), { activities: arrayUnion(activity) }));
}
const listedNow = (await getDoc(nightRef(listed))).data().activities;
await expectDenied("list two activities in one write", async () => {
  const [r1, r2] = [await roomIn(listed), await roomIn(listed)];
  await updateDoc(nightRef(listed), { activities: [...listedNow, anActivity("quiz", r1), anActivity("quiz", r2)] });
});
await expectDenied("rewrite an earlier activity while adding one", async () => {
  const r = await roomIn(listed);
  await updateDoc(nightRef(listed), {
    activities: [anActivity("quiz", roomA, { title: "Renamed" }), listedNow[1], anActivity("quiz", r)],
  });
});
await expectDenied("drop an earlier activity while adding one", async () => {
  const r = await roomIn(listed);
  await updateDoc(nightRef(listed), { activities: [listedNow[1], anActivity("quiz", r)] });
});
await expectDenied("reorder the activities", () =>
  updateDoc(nightRef(listed), { activities: [listedNow[1], listedNow[0]] })
);
await expectDenied("clear the activities", () => updateDoc(nightRef(listed), { activities: [] }));
await expectDenied("list an activity and close the night in one write", async () => {
  const r = await roomIn(listed);
  await updateDoc(nightRef(listed), { activities: arrayUnion(anActivity("quiz", r)), closed: true });
});
const capped = await newNight();
for (let i = 0; i < 20; i += 1) {
  const r = await roomIn(capped);
  await updateDoc(nightRef(capped), { activities: arrayUnion(anActivity("quiz", r, { title: `Round ${i + 1}` })) });
}
await expectDenied("list a 21st activity", async () => {
  const r = await roomIn(capped);
  await updateDoc(nightRef(capped), { activities: arrayUnion(anActivity("quiz", r)) });
});

// Closing
const closing = await newNight();
const closingRoom = await roomIn(closing);
await expectDenied("close a night and change its title", () => updateDoc(nightRef(closing), { closed: true, title: "Elsewhere" }));
await expectAllowed("close a night", () => updateDoc(nightRef(closing), { closed: true }));
await expectDenied("reopen a closed night", () => updateDoc(nightRef(closing), { closed: false }));
await expectDenied("list an activity in a closed night", () =>
  updateDoc(nightRef(closing), { activities: arrayUnion(anActivity("quiz", closingRoom)) })
);
await expectDenied("join a closed night", async () => {
  const batch = writeBatch(db);
  batch.set(claimRef(closing, "late"), aNightClaim("Late", "late-1"));
  batch.set(guestRef(closing, "late-1"), aNightGuest({ name: "Late" }));
  await batch.commit();
});

// Moving on to a fresh night
const movingFrom = await newNight();
const freshTarget = await newNight();
const strangers = await newNight({ hostId: "someone-else" });
const usedTarget = await newNight();
await updateDoc(nightRef(usedTarget), { activities: arrayUnion(anActivity("quiz", await roomIn(usedTarget))) });
const closedTarget = await newNight();
await updateDoc(nightRef(closedTarget), { closed: true });
await expectDenied("move on without closing", () => updateDoc(nightRef(movingFrom), { movedTo: freshTarget }));
await expectDenied("move on to a night that doesn't exist", () => updateDoc(nightRef(movingFrom), { movedTo: "NONE", closed: true }));
await expectDenied("move on to a lowercase code", () => updateDoc(nightRef(movingFrom), { movedTo: "abcd", closed: true }));
await expectDenied("move on to itself", () => updateDoc(nightRef(movingFrom), { movedTo: movingFrom, closed: true }));
await expectDenied("move on to a stranger's night", () => updateDoc(nightRef(movingFrom), { movedTo: strangers, closed: true }));
await expectDenied("move on to a night that already has activities", () => updateDoc(nightRef(movingFrom), { movedTo: usedTarget, closed: true }));
await expectDenied("move on from a night that is already closed", () => updateDoc(nightRef(closing), { movedTo: freshTarget, closed: true }));
await expectDenied("move on to a night that is closed", () => updateDoc(nightRef(movingFrom), { movedTo: closedTarget, closed: true }));
await expectDenied("move on and change the title", () => updateDoc(nightRef(movingFrom), { movedTo: freshTarget, closed: true, title: "Elsewhere" }));
await expectAllowed("move on to a fresh night of the same host", () => updateDoc(nightRef(movingFrom), { movedTo: freshTarget, closed: true }));
await expectDenied("move on a second time", () => newNight().then((other) => updateDoc(nightRef(movingFrom), { movedTo: other })));

await expectAllowed("read a contest lineup", () => getDoc(doc(db, "contests", "burgas-2027-final")));
await expectDenied("write a contest lineup", () =>
  setDoc(doc(db, "contests", "burgas-2027-final"), { acts: [] })
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
await updateDoc(score1.roomRef, startWrite());
await expectAllowed("update player score after start", () =>
  updateDoc(score1.roomRef, {
    players: [{ id: "host-1", name: "Host", score: 500 }],
  })
);

// 6c. Two players' scores written at the same moment from two clients
// (#64), each the way updatePlayerScore does it: read the room and write
// the list back in a transaction. Firestore makes whichever commits second
// retry against the first's result (the score rule only checks size and
// shape, so the retry is allowed), so both scores must survive.
const scoreRace = freshRoom("RACE");
await createRoom(scoreRace.roomRef, scoreRace.roomCode);
await updateDoc(scoreRace.roomRef, { players: arrayUnion({ id: "player-2", name: "Guest", score: 0 }) });
await updateDoc(scoreRace.roomRef, { difficulty: "medium" });
await updateDoc(scoreRace.roomRef, startWrite());
const scoreFrom = (clientDb, id, score) =>
  runTransaction(clientDb, async (transaction) => {
    const ref = doc(clientDb, "rooms", scoreRace.roomCode);
    const room = (await transaction.get(ref)).data();
    transaction.update(ref, { players: room.players.map((p) => (p.id === id ? { ...p, score } : p)) });
  });
await expectAllowed("two players' scores written at the same moment on two clients", () =>
  Promise.all([scoreFrom(clients[0], "host-1", 300), scoreFrom(clients[1], "player-2", 700)])
);
report(
  "both simultaneous scores are kept",
  "host-1:300,player-2:700",
  (await getDoc(scoreRace.roomRef)).data().players.map((p) => `${p.id}:${p.score}`).join(","),
);

// 6b. Malicious: same-size players array during an active game, but with a
// malformed entry (missing name/score) — exercises changedPlayersValid via
// isUpdatingPlayerScores specifically, the other of the two branches this
// PR fixed. Without this, a regression that dropped changedPlayersValid from
// just this branch would go undetected even though test 3/3b above cover
// the isAddingPlayer branch.
const score1b = freshRoom("SCOREB");
await createRoom(score1b.roomRef, score1b.roomCode);
await updateDoc(score1b.roomRef, { difficulty: "medium" });
await updateDoc(score1b.roomRef, startWrite());
await expectDenied("update players with malformed entry during active game", () =>
  updateDoc(score1b.roomRef, {
    players: [{ id: "host-1", name: "Host" }], // no score
  })
);

// 7. Malicious: piggyback forged hostId onto a legitimate score update
const score2 = freshRoom("SCORE2");
await createRoom(score2.roomRef, score2.roomCode);
await updateDoc(score2.roomRef, { difficulty: "medium" });
await updateDoc(score2.roomRef, startWrite());
await expectDenied("update score + forge hostId in same write", () =>
  updateDoc(score2.roomRef, {
    players: [{ id: "host-1", name: "Host", score: 500 }],
    hostId: "attacker-controlled",
  })
);

// 8. Legitimate: mid-quiz flag and continueReady (a room without a phase,
// which keeps the old rules; phase rooms are case 12)
const flag = freshRoom("FLAG");
await createRoom(flag.roomRef, flag.roomCode);
await expectAllowed("set continueReady", () =>
  updateDoc(flag.roomRef, { continueReady: true })
);
await expectAllowed("set playersAtMidQuiz", () =>
  updateDoc(flag.roomRef, { playersAtMidQuiz: ["host-1"] })
);
await expectAllowed("mark a player at the break with arrayUnion (markPlayerAtMidQuiz)", () =>
  updateDoc(flag.roomRef, { playersAtMidQuiz: arrayUnion("player-2") })
);
await expectAllowed("reset playersAtMidQuiz to empty", () =>
  updateDoc(flag.roomRef, { playersAtMidQuiz: [] })
);

// 9. Malicious: forge started=true without difficulty ever being set
const forge = freshRoom("FORGE");
await createRoom(forge.roomRef, forge.roomCode);
await expectDenied("forge started=true with no difficulty set", () =>
  updateDoc(forge.roomRef, startWrite())
);

// 10. Malicious: add a player after the game has already started
const started = freshRoom("STARTED");
await createRoom(started.roomRef, started.roomCode);
await updateDoc(started.roomRef, { difficulty: "easy" });
await updateDoc(started.roomRef, startWrite());
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
const backdated = Timestamp.fromMillis(Date.now() - 60_000);

const phase1 = freshRoom("PHASE");
await expectAllowed("create room with lobby phase fields", () =>
  createRoomWithPhase(phase1.roomRef, phase1.roomCode)
);
await updateDoc(phase1.roomRef, { difficulty: "easy" });
await expectAllowed("start game with phase fields in the same write", () =>
  updateDoc(phase1.roomRef, startWrite())
);

// 11b. The legacy started-only start (pre-#61 clients) is refused since #62:
// a game started that way would have no phase for clients to follow.
const phase2 = freshRoom("PHASELEGACY");
await createRoomWithPhase(phase2.roomRef, phase2.roomCode);
await updateDoc(phase2.roomRef, { difficulty: "easy" });
await expectDenied("start game with started only (legacy write)", () =>
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
async function readyToStart(prefix, quiz = { difficulty: "easy" }) {
  const room = freshRoom(prefix);
  await createRoomWithPhase(room.roomRef, room.roomCode);
  await updateDoc(room.roomRef, quiz);
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

// 12. Moving between phases (#62): question -> next question / mid-quiz
// break / results, and resuming after the break. The rules only let a
// question end once its 15s slot is over, measured against the server's
// real clock, so these cases have to wait it out. One room walks questions
// 1-5 to reach the first mid-quiz boundary; the others test single moves.
const SLOT_MS = 15_000;
const waitForSlot = () => new Promise((resolve) => setTimeout(resolve, SLOT_MS + 1_000));
const advanceTo = (phase, currentQuestionIndex, overrides = {}) => ({
  phase,
  currentQuestionIndex,
  phaseStartedAt: serverTimestamp(),
  ...overrides,
});
async function startedRoom(prefix, quiz) {
  const room = await readyToStart(prefix, quiz);
  await updateDoc(room, startWrite());
  return room;
}

const walker = await startedRoom("PHASEWALK");
const early = await startedRoom("PHASEEARLY");
const skip = await startedRoom("PHASESKIP");
const wrongBreak = await startedRoom("PHASEBRK");
const toResults = await startedRoom("PHASERES");
const revealMix = await startedRoom("PHASEREVMIX");
const forgedClock = await startedRoom("PHASECLK");
const piggyScore = await startedRoom("PHASEPIG");
const resumeTooSoon = await startedRoom("PHASERSM");
// Rooms with their own break setting (#75) walk alongside `walker`.
const every3 = await startedRoom("PHASE3", { difficulty: "t-nul-points", breakEvery: 3 });
const never = await startedRoom("PHASE0", { difficulty: "t-quick-fire", breakEvery: 0 });

await expectDenied("end a question before its 15s slot is over", () =>
  updateDoc(early, advanceTo("question", 1))
);

await waitForSlot();

await expectDenied("skip a question (0 -> 2)", () =>
  updateDoc(skip, advanceTo("question", 2))
);
await expectDenied("take the mid-quiz break off a multiple of 5 (0 -> break at 1)", () =>
  updateDoc(wrongBreak, advanceTo("mid-scoreboard", 1))
);
await expectDenied("advance with a client-chosen phaseStartedAt", () =>
  updateDoc(forgedClock, advanceTo("question", 1, { phaseStartedAt: backdated }))
);
await expectDenied("clear the ready marks while ending a question", () =>
  updateDoc(piggyScore, { ...advanceTo("question", 1), playersAtMidQuiz: [] })
);
await expectDenied("advance + rewrite scores in the same write", () =>
  updateDoc(piggyScore, {
    ...advanceTo("question", 1),
    players: [{ id: "host-1", name: "Host", score: 9999 }],
  })
);
await expectDenied("mark a player ready while the room is on a question, not in a break", () =>
  updateDoc(resumeTooSoon, { playersAtMidQuiz: arrayUnion("player-2") })
);
await expectDenied("resume from a mid-quiz break the room isn't in", () =>
  updateDoc(resumeTooSoon, { phase: "question", phaseStartedAt: serverTimestamp() })
);
await expectAllowed("end the quiz after a question (-> results)", () =>
  updateDoc(toResults, advanceTo("results", 0))
);
const toResultsFinishedAt = Date.now();
await expectDenied("move on from results", () =>
  updateDoc(toResults, advanceTo("question", 1))
);
await expectAllowed("a late score write just after the room finished (#142 grace)", () =>
  updateDoc(toResults, { players: [{ id: "host-1", name: "Host", score: 700 }] })
);
await expectDenied("set continueReady in a room with a phase (unused since #63)", () =>
  updateDoc(walker, { continueReady: true })
);

await expectAllowed("advance to the next question once the slot is over (0 -> 1)", () =>
  updateDoc(walker, advanceTo("question", 1))
);
await updateDoc(every3, advanceTo("question", 1));
await updateDoc(never, advanceTo("question", 1));
for (const next of [2, 3, 4]) {
  await waitForSlot();
  await updateDoc(walker, advanceTo("question", next));
  if (next === 2) await updateDoc(every3, advanceTo("question", 2));
  if (next === 3) {
    await expectDenied("skip the break in a room breaking every 3 (2 -> question 3)", () =>
      updateDoc(every3, advanceTo("question", 3))
    );
    await expectAllowed("take the break after question 3 in a room breaking every 3", () =>
      updateDoc(every3, advanceTo("mid-scoreboard", 3))
    );
  }
  await updateDoc(never, advanceTo("question", next));
}
await waitForSlot();
await expectDenied("take a break in a room with no breaks (4 -> break at 5)", () =>
  updateDoc(never, advanceTo("mid-scoreboard", 5))
);
await expectAllowed("go straight on in a room with no breaks (4 -> question 5)", () =>
  updateDoc(never, advanceTo("question", 5))
);
await expectDenied("skip the mid-quiz break (4 -> question 5)", () =>
  updateDoc(walker, advanceTo("question", 5))
);
await expectAllowed("take the mid-quiz break after question 5 (4 -> break at 5)", () =>
  updateDoc(walker, advanceTo("mid-scoreboard", 5))
);
await expectDenied("leave the break onto a different question", () =>
  updateDoc(walker, advanceTo("question", 6))
);
await expectDenied("mark several players ready in one write", () =>
  updateDoc(walker, { playersAtMidQuiz: arrayUnion("host-1", "player-2") })
);
await expectAllowed("mark a player at the break with arrayUnion (markPlayerAtMidQuiz)", () =>
  updateDoc(walker, { playersAtMidQuiz: arrayUnion("host-1") })
);
await expectAllowed("mark a second player at the break", () =>
  updateDoc(walker, { playersAtMidQuiz: arrayUnion("player-2") })
);
// A repeat arrayUnion changes nothing, so no key is affected; it's let
// through as a no-op write, not by the mark branch.
await expectAllowed("mark an already-marked player again (a no-op)", () =>
  updateDoc(walker, { playersAtMidQuiz: arrayUnion("player-2") })
);
await expectDenied("mark something that isn't a player ID", () =>
  updateDoc(walker, { playersAtMidQuiz: arrayUnion(12345) })
);
await expectDenied("slip a mark in ahead of the existing ones", () =>
  updateDoc(walker, { playersAtMidQuiz: ["player-3", "host-1", "player-2"] })
);
await expectDenied("clear the ready marks during the break without resuming", () =>
  updateDoc(walker, { playersAtMidQuiz: [] })
);
await expectDenied("drop another player's ready mark", () =>
  updateDoc(walker, { playersAtMidQuiz: ["host-1"] })
);
await expectDenied("resume while rewriting who is at the break", () =>
  updateDoc(walker, { phase: "question", phaseStartedAt: serverTimestamp(), playersAtMidQuiz: ["host-1"] })
);
await expectAllowed("resume after the mid-quiz break, clearing the ready marks (break at 5 -> question 5)", () =>
  updateDoc(walker, { phase: "question", phaseStartedAt: serverTimestamp(), playersAtMidQuiz: [] })
);
await expectDenied("a ready mark that lands after the resume (queued offline)", () =>
  updateDoc(walker, { playersAtMidQuiz: arrayUnion("player-2") })
);
await expectDenied("end the resumed question immediately", () =>
  updateDoc(walker, advanceTo("question", 6))
);

// 13. A finished room takes no more score writes once the grace is over
// (#142). The walks above usually take longer than that already; wait out
// whatever is left so this doesn't depend on them.
const RESULTS_GRACE_MS = 30_000;
const leftOfGrace = toResultsFinishedAt + RESULTS_GRACE_MS + 1_000 - Date.now();
if (leftOfGrace > 0) await new Promise((resolve) => setTimeout(resolve, leftOfGrace));
await expectDenied("rewrite scores in a room that finished over 30s ago", () =>
  updateDoc(toResults, { players: [{ id: "host-1", name: "Host", score: 9999 }] })
);

// 14. Another round with the same guests (#21): a finished room points at
// the next room once, and only at a lobby the same host just made; a room
// still playing can't.
const letters = () =>
  Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
const nextCode = letters();
await createRoomWithPhase(doc(db, "rooms", nextCode), nextCode);
const strangerCode = letters();
await setDoc(doc(db, "rooms", strangerCode), {
  id: strangerCode,
  hostId: "someone-else",
  started: false,
  createdAt: serverTimestamp(),
  players: [{ id: "someone-else", name: "Other", score: 0 }],
});
const startedCode = letters();
await createRoomWithPhase(doc(db, "rooms", startedCode), startedCode);
await updateDoc(doc(db, "rooms", startedCode), { difficulty: "easy" });
await updateDoc(doc(db, "rooms", startedCode), startWrite());
const missingCode = [nextCode, strangerCode, startedCode].includes("ZZZZ") ? "YYYY" : "ZZZZ";

await expectDenied("create a room already pointing at a next round", () => {
  const { roomCode: c, roomRef: r } = freshRoom("NEXTNEW");
  return setDoc(r, {
    id: c,
    hostId: "host-1",
    started: false,
    createdAt: serverTimestamp(),
    players: [{ id: "host-1", name: "Host", score: 0 }],
    nextRoomCode: nextCode,
  });
});
await expectDenied("point a room still playing at a next round", () =>
  updateDoc(score1.roomRef, { nextRoomCode: nextCode })
);
await expectDenied("a next-round code that isn't a room code", () =>
  updateDoc(toResults, { nextRoomCode: "next!" })
);
await expectDenied("a next round that doesn't exist", () =>
  updateDoc(toResults, { nextRoomCode: missingCode })
);
await expectDenied("a next round another host made", () =>
  updateDoc(toResults, { nextRoomCode: strangerCode })
);
await expectDenied("a next round that has already started", () =>
  updateDoc(toResults, { nextRoomCode: startedCode })
);
await expectAllowed("point a finished room at the next round", () =>
  updateDoc(toResults, { nextRoomCode: nextCode })
);
await expectDenied("point it somewhere else afterwards", () =>
  updateDoc(toResults, { nextRoomCode: strangerCode })
);
await expectDenied("the next round's code riding along with scores", () =>
  updateDoc(score1.roomRef, { nextRoomCode: nextCode, players: [{ id: "host-1", name: "Host", score: 1 }] })
);

// 14b. The host revealing the standings (#207): `revealStep` moves forward
// only, only in the results, as an integer up to 100. (No auth, so who writes
// it isn't checked, #115.)
await expectDenied("create a room that is already revealed", () => {
  const { roomCode: c, roomRef: r } = freshRoom("REVEALNEW");
  return setDoc(r, {
    id: c,
    hostId: "host-1",
    started: false,
    createdAt: serverTimestamp(),
    players: [{ id: "host-1", name: "Host", score: 0 }],
    revealStep: 1,
  });
});
await expectDenied("reveal in a room still playing", () =>
  updateDoc(score1.roomRef, { revealStep: 1 })
);
await expectDenied("a reveal step that is not an integer", () =>
  updateDoc(toResults, { revealStep: 1.5 })
);
await expectDenied("a reveal step that is a string", () =>
  updateDoc(toResults, { revealStep: "1" })
);
await expectDenied("a negative reveal step", () =>
  updateDoc(toResults, { revealStep: -1 })
);
await expectDenied("a reveal step past 100", () =>
  updateDoc(toResults, { revealStep: 101 })
);
await expectAllowed("start the reveal (step 1)", () =>
  updateDoc(toResults, { revealStep: 1 })
);
await expectAllowed("repeat the same reveal step", () =>
  updateDoc(toResults, { revealStep: 1 })
);
await expectAllowed("reveal everything (step 3)", () =>
  updateDoc(toResults, { revealStep: 3 })
);
await expectDenied("take the reveal back a step", () =>
  updateDoc(toResults, { revealStep: 2 })
);
await expectDenied("reset the reveal to 0", () =>
  updateDoc(toResults, { revealStep: 0 })
);
await expectAllowed("reveal up to the cap (100)", () =>
  updateDoc(toResults, { revealStep: 100 })
);
// The mixes below need a room still inside the 30s grace (`toResults` is
// past it by now), so the denials come from the reveal rule's hasOnly and
// not from the finished-room check. It reaches the results here, its 15s
// slot long over.
await expectAllowed("a second room reaches the results", () =>
  updateDoc(revealMix, advanceTo("results", 0))
);
await expectAllowed("start the reveal in a room inside the grace", () =>
  updateDoc(revealMix, { revealStep: 1 })
);
await expectDenied("the reveal step riding along with scores (inside the grace)", () =>
  updateDoc(revealMix, { revealStep: 2, players: [{ id: "host-1", name: "Host", score: 5 }] })
);
await expectDenied("the reveal step riding along with the next round's code", () =>
  updateDoc(revealMix, { revealStep: 2, nextRoomCode: nextCode })
);
await expectDenied("the reveal step riding along with a phase change", () =>
  updateDoc(revealMix, { revealStep: 2, ...advanceTo("question", 1) })
);
await expectAllowed("a late score write in a room that already carries a reveal step", () =>
  updateDoc(revealMix, { players: [{ id: "host-1", name: "Host", score: 5 }] })
);
await expectAllowed("point a room that already carries a reveal step at the next round", () =>
  updateDoc(revealMix, { nextRoomCode: nextCode })
);

// 15. The waiting room (#65): players mark themselves ready, and the host
// can remove a player, before the start only.
const lobby = freshRoom("LOBBY");
await createRoomWithPhase(lobby.roomRef, lobby.roomCode);
await updateDoc(lobby.roomRef, { players: arrayUnion({ id: "p-2", name: "Loreen", score: 0 }) });
await updateDoc(lobby.roomRef, { players: arrayUnion({ id: "p-3", name: "Lordi", score: 0 }) });
await expectDenied("create a room with ready marks", () => {
  const { roomCode: c, roomRef: r } = freshRoom("READYNEW");
  return setDoc(r, {
    id: c,
    hostId: "host-1",
    started: false,
    createdAt: serverTimestamp(),
    players: [{ id: "host-1", name: "Host", score: 0 }],
    readyPlayers: ["host-1"],
  });
});
await expectAllowed("mark a player ready (arrayUnion)", () =>
  updateDoc(lobby.roomRef, { readyPlayers: arrayUnion("p-2") })
);
await expectAllowed("mark a second player ready", () =>
  updateDoc(lobby.roomRef, { readyPlayers: arrayUnion("p-3") })
);
await expectAllowed("take a ready mark back (arrayRemove)", () =>
  updateDoc(lobby.roomRef, { readyPlayers: arrayRemove("p-3") })
);
await expectDenied("mark several players ready in one write", () =>
  updateDoc(lobby.roomRef, { readyPlayers: ["p-2", "p-3", "p-4"] })
);
await expectDenied("a ready mark that isn't an id", () =>
  updateDoc(lobby.roomRef, { readyPlayers: arrayUnion(42) })
);
await expectDenied("a ready mark riding along with the quiz pick", () =>
  updateDoc(lobby.roomRef, { readyPlayers: arrayUnion("p-3"), difficulty: "easy" })
);
await updateDoc(lobby.roomRef, { readyPlayers: arrayUnion("p-3") });
await expectDenied("remove a player and wipe everyone's ready marks", () =>
  updateDoc(lobby.roomRef, {
    players: arrayRemove({ id: "p-2", name: "Loreen", score: 0 }),
    readyPlayers: [],
  })
);
await expectAllowed("the host removes a player and their ready mark", () =>
  updateDoc(lobby.roomRef, {
    players: arrayRemove({ id: "p-2", name: "Loreen", score: 0 }),
    readyPlayers: arrayRemove("p-2"),
  })
);
await expectDenied("remove the host", () =>
  updateDoc(lobby.roomRef, { players: [{ id: "p-3", name: "Lordi", score: 0 }] })
);
await expectDenied("empty the room", () =>
  updateDoc(lobby.roomRef, { players: [] })
);
await expectDenied("swap a player for someone else while removing", () =>
  updateDoc(lobby.roomRef, { players: [{ id: "host-1", name: "Host", score: 5 }] })
);
await updateDoc(lobby.roomRef, { difficulty: "easy" });
await updateDoc(lobby.roomRef, startWrite());
await expectDenied("change a ready mark after the start", () =>
  updateDoc(lobby.roomRef, { readyPlayers: arrayRemove("p-3") })
);
await expectDenied("remove a player after the start", () =>
  updateDoc(lobby.roomRef, { players: arrayRemove({ id: "p-3", name: "Lordi", score: 0 }) })
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
