import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Player, Room } from "./roomsFirestore";
import {
    addPlayerToRoom,
    advanceQuestion,
    createRoom,
    generateRoomCode,
    getRoom,
    joinRoom,
    listenToRoom,
    markPlayerAtMidQuiz,
    resetPlayersAtMidQuiz,
    resumeAfterMidQuiz,
    setContinueReady,
    setRoomDifficulty,
    startGame,
    updatePlayerScore,
    ScoreWriteRejected,
    JoinRejected,
    MAX_PLAYERS,
    setNextRoom,
} from "./roomsFirestore";

// The Firebase client SDK is mocked rather than pointed at the emulator: the
// emulator needs a JDK and a running process, and `npm test` is about to
// become a CI check (#57), so an emulator-bound suite would be un-runnable
// there. The rules themselves are exercised against the real emulator by
// `scripts/verify-firestore-rules.mjs` — see docs/agent/testing.md. What this
// file pins down is the logic *this module* adds on top of the SDK: the
// guards, the wrapped error messages, and the exact write payloads.

const mocks = vi.hoisted(() => ({
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    arrayUnion: vi.fn(),
    onSnapshot: vi.fn(),
    runTransaction: vi.fn(),
    serverTimestamp: vi.fn(),
    timestampNow: vi.fn(),
}));

// A getter, not a fixed value, so a test can simulate the app booting without
// a usable Firestore handle (every exported function guards on it).
const firebaseState = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../firebase", () => ({
    get db() {
        return firebaseState.db;
    },
}));

vi.mock("firebase/firestore", () => ({
    doc: mocks.doc,
    getDoc: mocks.getDoc,
    setDoc: mocks.setDoc,
    updateDoc: mocks.updateDoc,
    arrayUnion: mocks.arrayUnion,
    onSnapshot: mocks.onSnapshot,
    runTransaction: mocks.runTransaction,
    serverTimestamp: mocks.serverTimestamp,
    Timestamp: { now: mocks.timestampNow },
    FieldValue: class FieldValue { },
}));

const FAKE_DB = { __fake: "db" };
const SERVER_TIMESTAMP = { __sentinel: "serverTimestamp" };
const NOW = { __sentinel: "Timestamp.now", toDate: () => new Date("2026-01-01T00:00:00.000Z") };

type Snapshot = { exists: () => boolean; data: () => Room | null };
type FakeTransaction = {
    get: (ref: unknown) => Promise<Snapshot>;
    update: (ref: unknown, data: Record<string, unknown>) => void;
};

const snapshotOf = (room: Room | null): Snapshot => ({
    exists: () => room !== null,
    data: () => room,
});

const player = (id: string, name: string, score = 0): Player => ({ id, name, score });

const roomWith = (overrides: Partial<Room> = {}): Room => ({
    id: "ABCD",
    hostId: "host-1",
    started: false,
    createdAt: SERVER_TIMESTAMP as unknown as Room["createdAt"],
    players: [player("host-1", "Martin")],
    ...overrides,
});

/** The doc ref the module builds for a given room code, as our mock returns it. */
const refFor = (roomCode: string) => ({ __ref: `rooms/${roomCode}` });

/** Point `runTransaction`'s inner `transaction.get` at a room, and spy on its write. */
const givenTransactionSees = (room: Room | null) => {
    const update = vi.fn();
    mocks.runTransaction.mockImplementation(
        async (_db: unknown, updateFunction: (transaction: FakeTransaction) => Promise<unknown>) =>
            updateFunction({ get: async () => snapshotOf(room), update }),
    );
    return update;
};

beforeEach(() => {
    firebaseState.db = FAKE_DB;

    // This module logs on every call; keep the suite's output readable.
    vi.spyOn(console, "log").mockImplementation(() => { });
    vi.spyOn(console, "warn").mockImplementation(() => { });
    vi.spyOn(console, "error").mockImplementation(() => { });

    mocks.doc.mockImplementation((_db: unknown, collection: string, id: string) => ({
        __ref: `${collection}/${id}`,
    }));
    mocks.arrayUnion.mockImplementation((...items: unknown[]) => ({ __arrayUnion: items }));
    mocks.serverTimestamp.mockReturnValue(SERVER_TIMESTAMP);
    mocks.timestampNow.mockReturnValue(NOW);
    mocks.setDoc.mockResolvedValue(undefined);
    mocks.updateDoc.mockResolvedValue(undefined);
    mocks.getDoc.mockResolvedValue(snapshotOf(null));
    mocks.onSnapshot.mockReturnValue(() => { });
    givenTransactionSees(roomWith());
});

describe("createRoom", () => {
    it("writes the room under its code with the host as the only player", async () => {
        await createRoom("ABCD", "host-1", "Martin");

        expect(mocks.doc).toHaveBeenCalledWith(FAKE_DB, "rooms", "ABCD");
        expect(mocks.setDoc).toHaveBeenCalledTimes(1);
        expect(mocks.setDoc).toHaveBeenCalledWith(refFor("ABCD"), {
            id: "ABCD",
            hostId: "host-1",
            started: false,
            hostIsObserver: false,
            createdAt: SERVER_TIMESTAMP,
            phase: "lobby",
            currentQuestionIndex: 0,
            phaseStartedAt: SERVER_TIMESTAMP,
            players: [{ id: "host-1", name: "Martin", score: 0, joinedAt: NOW }],
        });
    });

    it("opens the room in the lobby on question 0, stamped with the server clock", async () => {
        await createRoom("ABCD", "host-1", "Martin");

        const written = mocks.setDoc.mock.calls[0][1] as Room;
        expect(written.phase).toBe("lobby");
        expect(written.currentQuestionIndex).toBe(0);
        // firestore.rules requires phaseStartedAt == request.time, so a
        // client Timestamp here would be denied.
        expect(written.phaseStartedAt).toBe(SERVER_TIMESTAMP);
    });

    it("starts the host on zero and the game not started", async () => {
        await createRoom("ABCD", "host-1", "Martin");

        const written = mocks.setDoc.mock.calls[0][1] as Room;
        expect(written.started).toBe(false);
        expect(written.players[0].score).toBe(0);
    });

    it("records observer mode when the host opts into it", async () => {
        await createRoom("ABCD", "host-1", "Martin", true);

        expect((mocks.setDoc.mock.calls[0][1] as Room).hostIsObserver).toBe(true);
    });

    it("uses a client timestamp for the player, not serverTimestamp()", async () => {
        // serverTimestamp() is rejected by Firestore inside an array, so the
        // player's joinedAt has to be a concrete Timestamp.
        await createRoom("ABCD", "host-1", "Martin");

        const written = mocks.setDoc.mock.calls[0][1] as Room;
        expect(written.players[0].joinedAt).toBe(NOW);
        expect(written.players[0].joinedAt).not.toBe(SERVER_TIMESTAMP);
    });

    it("wraps a write failure with the room-creation context", async () => {
        mocks.setDoc.mockRejectedValue(new Error("network down"));

        await expect(createRoom("ABCD", "host-1", "Martin")).rejects.toThrow(
            "Failed to create room: network down",
        );
    });
});

describe("getRoom", () => {
    it("returns the room document's data when it exists", async () => {
        const room = roomWith({ players: [player("host-1", "Martin", 700)] });
        mocks.getDoc.mockResolvedValue(snapshotOf(room));

        await expect(getRoom("ABCD")).resolves.toEqual(room);
    });

    it("returns null for a room code that doesn't exist", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(null));

        await expect(getRoom("ZZZZ")).resolves.toBeNull();
    });

    it("wraps a read failure", async () => {
        mocks.getDoc.mockRejectedValue(new Error("offline"));

        await expect(getRoom("ABCD")).rejects.toThrow("Failed to get room: offline");
    });
});

describe("addPlayerToRoom", () => {
    it("appends the player with arrayUnion so concurrent joins can't clobber", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith()));

        await addPlayerToRoom("ABCD", "p-2", "Ida");

        expect(mocks.arrayUnion).toHaveBeenCalledWith({
            id: "p-2",
            name: "Ida",
            score: 0,
            joinedAt: NOW,
        });
        expect(mocks.updateDoc).toHaveBeenCalledWith(refFor("ABCD"), {
            players: { __arrayUnion: [{ id: "p-2", name: "Ida", score: 0, joinedAt: NOW }] },
        });
    });

    it("rejects a join for a room that doesn't exist", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(null));

        await expect(addPlayerToRoom("ZZZZ", "p-2", "Ida")).rejects.toThrow("Room not found");
        expect(mocks.updateDoc).not.toHaveBeenCalled();
    });

    it("rejects a join once the game has started", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith({ started: true })));

        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).rejects.toThrow(
            "Game has already started",
        );
        expect(mocks.updateDoc).not.toHaveBeenCalled();
    });

    it("is a no-op when the same player id is already in the room", async () => {
        mocks.getDoc.mockResolvedValue(
            snapshotOf(roomWith({ players: [player("host-1", "Martin"), player("p-2", "Ida")] })),
        );

        await addPlayerToRoom("ABCD", "p-2", "Ida");

        expect(mocks.updateDoc).not.toHaveBeenCalled();
    });

    it("adds a second player who drew a name already in the room under their own ID (#131)", async () => {
        // Only the ID identifies a player: skipping on a name match left the
        // newcomer's ID out of the room, and every score they sent was lost.
        mocks.getDoc.mockResolvedValue(
            snapshotOf(roomWith({ players: [player("p-2", "Ida")] })),
        );

        await addPlayerToRoom("ABCD", "p-99", "Ida");

        expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
        const added = (mocks.updateDoc.mock.calls[0][1] as { players: { __arrayUnion: Player[] } }).players.__arrayUnion[0];
        expect(added).toMatchObject({ id: "p-99", name: "Ida", score: 0 });
    });

    it("translates a rules rejection into a message about security rules", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith()));
        mocks.updateDoc.mockRejectedValue(
            Object.assign(new Error("Missing or insufficient permissions."), {
                code: "permission-denied",
            }),
        );

        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).rejects.toThrow(
            "Security rules prevented joining the room",
        );
    });
    it("reports a start that raced the join as started, not as a rules error (#64)", async () => {
        mocks.getDoc
            .mockResolvedValueOnce(snapshotOf(roomWith()))
            .mockResolvedValueOnce(snapshotOf(roomWith({ started: true })));
        mocks.updateDoc.mockRejectedValue(
            Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" }),
        );

        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).rejects.toThrow("Game has already started");
    });

    it("reports a room that filled up or vanished mid-join, and a rejoin that landed anyway", async () => {
        const denied = Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
        mocks.updateDoc.mockRejectedValue(denied);
        const full = Array.from({ length: MAX_PLAYERS }, (_, i) => player(`p-${i + 10}`, `P${i}`));

        mocks.getDoc.mockResolvedValueOnce(snapshotOf(roomWith())).mockResolvedValueOnce(snapshotOf(roomWith({ players: full })));
        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).rejects.toMatchObject({ reason: "full" });

        mocks.getDoc.mockResolvedValueOnce(snapshotOf(roomWith())).mockResolvedValueOnce(snapshotOf(null));
        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).rejects.toMatchObject({ reason: "not-found" });

        mocks.getDoc.mockResolvedValueOnce(snapshotOf(roomWith())).mockResolvedValueOnce(snapshotOf(roomWith({ players: [player("p-2", "Ida")] })));
        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).resolves.toBeUndefined();
    });

    it("keeps the rules refusal when the re-read fails too", async () => {
        mocks.updateDoc.mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
        mocks.getDoc.mockResolvedValueOnce(snapshotOf(roomWith())).mockRejectedValueOnce(new Error("offline"));

        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).rejects.toThrow("Security rules prevented joining the room");
    });

    it("turns a full room away before writing", async () => {
        const full = Array.from({ length: MAX_PLAYERS }, (_, i) => player(`p-${i + 10}`, `P${i}`));
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith({ players: full })));

        const rejection = await addPlayerToRoom("ABCD", "p-2", "Ida").catch((error: unknown) => error);
        expect(rejection).toBeInstanceOf(JoinRejected);
        expect(rejection).toMatchObject({ reason: "full", message: "The room is full (32 players)" });
        expect(mocks.updateDoc).not.toHaveBeenCalled();
        await expect(joinRoom("ABCD", "p-2", "Ida")).rejects.toThrow("Failed to join room: The room is full (32 players)");
    });

    it("lets a player already in the room back in after the start", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith({ started: true, players: [player("p-2", "Ida")] })));

        await expect(joinRoom("ABCD", "p-2", "Ida")).resolves.toBe(true);
        expect(mocks.updateDoc).not.toHaveBeenCalled();
    });

    it("passes on any other write failure", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith()));
        mocks.updateDoc.mockRejectedValue(new Error("offline"));

        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).rejects.toThrow("offline");
        expect(mocks.getDoc).toHaveBeenCalledTimes(1);
    });
});

describe("joinRoom", () => {
    it("returns false for a room code that doesn't exist", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(null));

        await expect(joinRoom("ZZZZ", "p-2", "Ida")).resolves.toBe(false);
        expect(mocks.updateDoc).not.toHaveBeenCalled();
    });

    it("returns false when the host started the game mid-join", async () => {
        mocks.getDoc
            .mockResolvedValueOnce(snapshotOf(roomWith()))
            .mockResolvedValueOnce(snapshotOf(roomWith({ started: true })));
        mocks.updateDoc.mockRejectedValue(
            Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" }),
        );

        await expect(joinRoom("ABCD", "p-2", "Ida")).resolves.toBe(false);
    });

    it("returns false when the game has already started", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith({ started: true })));

        await expect(joinRoom("ABCD", "p-2", "Ida")).resolves.toBe(false);
        expect(mocks.updateDoc).not.toHaveBeenCalled();
    });

    it("treats a rejoin by an already-present player as success without writing", async () => {
        mocks.getDoc.mockResolvedValue(
            snapshotOf(roomWith({ players: [player("p-2", "Ida")] })),
        );

        await expect(joinRoom("ABCD", "p-2", "Ida")).resolves.toBe(true);
        expect(mocks.updateDoc).not.toHaveBeenCalled();
    });

    it("adds a newcomer who drew a name already in the room under their own ID (#131)", async () => {
        mocks.getDoc.mockResolvedValue(
            snapshotOf(roomWith({ players: [player("p-2", "Ida")] })),
        );

        await expect(joinRoom("ABCD", "p-99", "Ida")).resolves.toBe(true);
        expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
        const added = (mocks.updateDoc.mock.calls[0][1] as { players: { __arrayUnion: Player[] } }).players.__arrayUnion[0];
        expect(added).toMatchObject({ id: "p-99", name: "Ida" });
    });

    it("adds a new player and reports success", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith()));

        await expect(joinRoom("ABCD", "p-2", "Ida")).resolves.toBe(true);
        expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
    });

    it("distinguishes a lookup failure from a room that isn't there", async () => {
        // A missing room is `false`; a broken connection has to throw, or the
        // join screen would tell the player their code was wrong.
        mocks.getDoc.mockRejectedValue(new Error("offline"));

        await expect(joinRoom("ABCD", "p-2", "Ida")).rejects.toThrow(
            "Failed to join room: Failed to get room: offline",
        );
    });

    it("surfaces a rules rejection as a join failure rather than a false", async () => {
        mocks.getDoc.mockResolvedValue(snapshotOf(roomWith()));
        mocks.updateDoc.mockRejectedValue(
            Object.assign(new Error("Missing or insufficient permissions."), {
                code: "permission-denied",
            }),
        );

        await expect(joinRoom("ABCD", "p-2", "Ida")).rejects.toThrow(
            "Failed to join room: Security rules prevented access",
        );
    });
});

describe("updatePlayerScore", () => {
    it("writes the new score for that player and leaves the others alone", async () => {
        const update = givenTransactionSees(
            roomWith({ players: [player("p-1", "Martin", 500), player("p-2", "Ida", 1200)] }),
        );

        await updatePlayerScore("ABCD", "p-1", 1500);

        expect(update).toHaveBeenCalledWith(refFor("ABCD"), {
            players: [
                { id: "p-1", name: "Martin", score: 1500 },
                { id: "p-2", name: "Ida", score: 1200 },
            ],
        });
    });

    it("goes through a transaction, not a read-modify-write", async () => {
        // A plain getDoc + updateDoc pair here loses one of two near-
        // simultaneous writes (submitAnswer and handleTimeUp both fire around
        // a question's deadline). See CLAUDE.md's landmines.
        await updatePlayerScore("ABCD", "host-1", 500);

        expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
        expect(mocks.updateDoc).not.toHaveBeenCalled();
    });

    it("refuses a negative score before touching Firestore", async () => {
        await expect(updatePlayerScore("ABCD", "p-1", -1)).rejects.toThrow(
            "Refusing to write invalid score -1 for player p-1",
        );
        expect(mocks.runTransaction).not.toHaveBeenCalled();
    });

    it("refuses NaN and Infinity before touching Firestore", async () => {
        await expect(updatePlayerScore("ABCD", "p-1", Number.NaN)).rejects.toThrow(
            /Refusing to write invalid score/,
        );
        await expect(updatePlayerScore("ABCD", "p-1", Number.POSITIVE_INFINITY)).rejects.toThrow(
            /Refusing to write invalid score/,
        );
        expect(mocks.runTransaction).not.toHaveBeenCalled();
    });

    it("accepts a score of zero", async () => {
        const update = givenTransactionSees(roomWith({ players: [player("p-1", "Martin", 0)] }));

        await updatePlayerScore("ABCD", "p-1", 0);

        expect(update).toHaveBeenCalledWith(refFor("ABCD"), {
            players: [{ id: "p-1", name: "Martin", score: 0 }],
        });
    });

    it("refuses to lower an existing player's score", async () => {
        const update = givenTransactionSees(
            roomWith({ players: [player("p-1", "Martin", 1500)] }),
        );

        await expect(updatePlayerScore("ABCD", "p-1", 1000)).rejects.toThrow(
            "Refusing to lower score for player p-1 in room ABCD (1500 -> 1000)",
        );
        expect(update).not.toHaveBeenCalled();
    });

    it("allows re-writing the same score (an idempotent retry)", async () => {
        const update = givenTransactionSees(
            roomWith({ players: [player("p-1", "Martin", 1500)] }),
        );

        await updatePlayerScore("ABCD", "p-1", 1500);

        expect(update).toHaveBeenCalledTimes(1);
    });

    it("marks a write the room turns down with a reason, so callers needn't parse messages", async () => {
        givenTransactionSees(roomWith({ players: [player("p-1", "Martin", 500)] }));

        await expect(updatePlayerScore("ABCD", "p-1", 100)).rejects.toMatchObject({
            name: "ScoreWriteRejected",
            reason: "lower-score",
            currentScore: 500,
        });
        await expect(updatePlayerScore("ABCD", "ghost", 900)).rejects.toMatchObject({ reason: "unknown-player" });
        await expect(updatePlayerScore("ABCD", "p-1", -1)).rejects.toBeInstanceOf(ScoreWriteRejected);
    });

    it("refuses a score once the room has been finished for the grace period (#142)", async () => {
        const at = (msAgo: number) => ({ toMillis: () => Date.now() - msAgo }) as unknown as Room["phaseStartedAt"];
        const finished = (msAgo: number) =>
            roomWith({ started: true, phase: "results", phaseStartedAt: at(msAgo), players: [player("p-1", "Martin", 500)] });

        const update = givenTransactionSees(finished(31_000));
        await expect(updatePlayerScore("ABCD", "p-1", 900)).rejects.toMatchObject({ reason: "finished" });
        expect(update).not.toHaveBeenCalled();

        // Inside the grace, and while the finish time is still pending, it goes through.
        givenTransactionSees(finished(5_000));
        await expect(updatePlayerScore("ABCD", "p-1", 900)).resolves.toBeUndefined();
        givenTransactionSees(roomWith({ started: true, phase: "results", phaseStartedAt: null, players: [player("p-1", "Martin", 500)] }));
        await expect(updatePlayerScore("ABCD", "p-1", 900)).resolves.toBeUndefined();
    });

    it("passes on a failure that isn't the room's answer (e.g. offline) as a plain error", async () => {
        mocks.runTransaction.mockRejectedValue(new Error("offline"));

        const failure = updatePlayerScore("ABCD", "p-1", 500);
        await expect(failure).rejects.toThrow("Failed to update score: offline");
        await expect(failure).rejects.not.toBeInstanceOf(ScoreWriteRejected);
    });

    it("fails when the room disappeared under the transaction", async () => {
        givenTransactionSees(null);

        await expect(updatePlayerScore("ABCD", "p-1", 500)).rejects.toThrow(
            "Failed to update score: Room ABCD does not exist",
        );
    });

    it("rejects a score for a player who isn't in the room, writing nothing (#131)", async () => {
        const update = givenTransactionSees(roomWith({ players: [player("p-1", "Martin", 500)] }));

        await expect(updatePlayerScore("ABCD", "ghost", 900)).rejects.toThrow(
            "Failed to update score: Room ABCD has no player ghost",
        );
        expect(update).not.toHaveBeenCalled();
    });
});

describe("markPlayerAtMidQuiz", () => {
    it("adds the player server-side with arrayUnion, without reading the room first", async () => {
        await markPlayerAtMidQuiz("ABCD", "p-1");

        expect(mocks.getDoc).not.toHaveBeenCalled();
        expect(mocks.updateDoc).toHaveBeenCalledWith(refFor("ABCD"), {
            playersAtMidQuiz: { __arrayUnion: ["p-1"] },
        });
    });

    it("sends each concurrent mark as its own arrayUnion, so none drops another", async () => {
        // Since #62 every player reaches the break on the same snapshot. With
        // a read-modify-write, two marks read the same list and the second
        // write dropped the first; arrayUnion merges on the server instead.
        await Promise.all([markPlayerAtMidQuiz("ABCD", "p-1"), markPlayerAtMidQuiz("ABCD", "p-2")]);

        expect(mocks.updateDoc.mock.calls.map((call) => call[1])).toEqual([
            { playersAtMidQuiz: { __arrayUnion: ["p-1"] } },
            { playersAtMidQuiz: { __arrayUnion: ["p-2"] } },
        ]);
    });

    it("wraps a failed write, e.g. a room that doesn't exist", async () => {
        mocks.updateDoc.mockRejectedValue(new Error("No document to update"));

        await expect(markPlayerAtMidQuiz("ZZZZ", "p-1")).rejects.toThrow(
            "Failed to mark player as ready: No document to update",
        );
    });
});

describe("startGame", () => {
    it("starts the game and moves the room to question 0 in one write", async () => {
        await startGame("ABCD");

        expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
        expect(mocks.updateDoc).toHaveBeenCalledWith(refFor("ABCD"), {
            started: true,
            phase: "question",
            currentQuestionIndex: 0,
            // firestore.rules requires phaseStartedAt == request.time.
            phaseStartedAt: SERVER_TIMESTAMP,
        });
    });

    it("doesn't retry a rejected start", async () => {
        mocks.updateDoc.mockRejectedValue(
            Object.assign(new Error("denied"), { code: "permission-denied" }),
        );

        await expect(startGame("ABCD")).rejects.toThrow("Failed to start game: denied");
        expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
    });
});

describe("advanceQuestion", () => {
    const onQuestion = (index: number) =>
        roomWith({ started: true, phase: "question", currentQuestionIndex: index });

    it("moves the room to the next question with a fresh server-side start", async () => {
        const update = givenTransactionSees(onQuestion(0));

        await expect(advanceQuestion("ABCD", 0, 15)).resolves.toBe(true);

        expect(update).toHaveBeenCalledWith(refFor("ABCD"), {
            phase: "question",
            currentQuestionIndex: 1,
            phaseStartedAt: SERVER_TIMESTAMP,
        });
    });

    it("takes the mid-quiz break after every fifth question", async () => {
        const update = givenTransactionSees(onQuestion(4));

        await advanceQuestion("ABCD", 4, 15);

        expect(update).toHaveBeenCalledWith(refFor("ABCD"), {
            phase: "mid-scoreboard",
            currentQuestionIndex: 5,
            phaseStartedAt: SERVER_TIMESTAMP,
        });
    });

    it("follows the room's own break setting", async () => {
        const update = givenTransactionSees({ ...onQuestion(3), breakEvery: 4 });

        await advanceQuestion("ABCD", 3, 12);

        expect(update).toHaveBeenCalledWith(refFor("ABCD"), {
            phase: "mid-scoreboard",
            currentQuestionIndex: 4,
            phaseStartedAt: SERVER_TIMESTAMP,
        });
    });

    it("ends the quiz after the last question", async () => {
        const update = givenTransactionSees(onQuestion(14));

        await advanceQuestion("ABCD", 14, 15);

        expect(update).toHaveBeenCalledWith(refFor("ABCD"), {
            phase: "results",
            currentQuestionIndex: 14,
            phaseStartedAt: SERVER_TIMESTAMP,
        });
    });

    it("is a no-op when another client already advanced past this question", async () => {
        // Every client whose clock runs out calls this; only the first write lands.
        const update = givenTransactionSees(onQuestion(3));

        await expect(advanceQuestion("ABCD", 2, 15)).resolves.toBe(false);

        expect(update).not.toHaveBeenCalled();
    });

    it("is a no-op outside the question phase", async () => {
        const update = givenTransactionSees(
            roomWith({ started: true, phase: "mid-scoreboard", currentQuestionIndex: 5 }),
        );

        await expect(advanceQuestion("ABCD", 5, 15)).resolves.toBe(false);

        expect(update).not.toHaveBeenCalled();
    });

    it("wraps a missing room or a rules denial with its own context", async () => {
        givenTransactionSees(null);
        await expect(advanceQuestion("ABCD", 0, 15)).rejects.toThrow(
            "Failed to advance question: Room ABCD does not exist",
        );

        mocks.runTransaction.mockRejectedValueOnce(new Error("permission-denied"));
        await expect(advanceQuestion("ABCD", 0, 15)).rejects.toThrow(
            "Failed to advance question: permission-denied",
        );
    });
});

describe("resumeAfterMidQuiz", () => {
    it("starts the question the break points at, keeping its index", async () => {
        const update = givenTransactionSees(
            roomWith({ started: true, phase: "mid-scoreboard", currentQuestionIndex: 5 }),
        );

        await expect(resumeAfterMidQuiz("ABCD")).resolves.toBe(true);

        expect(update).toHaveBeenCalledWith(refFor("ABCD"), {
            phase: "question",
            phaseStartedAt: SERVER_TIMESTAMP,
            playersAtMidQuiz: [],
        });
    });

    it("is a no-op unless the room is in the break (a double-click can't restart a question)", async () => {
        const update = givenTransactionSees(
            roomWith({ started: true, phase: "question", currentQuestionIndex: 5 }),
        );

        await expect(resumeAfterMidQuiz("ABCD")).resolves.toBe(false);

        expect(update).not.toHaveBeenCalled();
    });

    it("wraps a missing room with its own context", async () => {
        givenTransactionSees(null);

        await expect(resumeAfterMidQuiz("ABCD")).rejects.toThrow(
            "Failed to resume quiz: Room ABCD does not exist",
        );
    });
});

describe("the single-field room writes", () => {

    it("setRoomDifficulty writes only `difficulty`", async () => {
        await setRoomDifficulty("ABCD", "hard");

        expect(mocks.updateDoc).toHaveBeenCalledWith(refFor("ABCD"), { difficulty: "hard" });
    });

    it("setRoomDifficulty writes the break setting with the quiz when given", async () => {
        await setRoomDifficulty("ABCD", "t-quick-fire", 0);

        expect(mocks.updateDoc).toHaveBeenCalledWith(refFor("ABCD"), { difficulty: "t-quick-fire", breakEvery: 0 });
    });

    it("setContinueReady writes the flag in both directions", async () => {
        await setContinueReady("ABCD", true);
        await setContinueReady("ABCD", false);

        expect(mocks.updateDoc).toHaveBeenNthCalledWith(1, refFor("ABCD"), { continueReady: true });
        expect(mocks.updateDoc).toHaveBeenNthCalledWith(2, refFor("ABCD"), {
            continueReady: false,
        });
    });

    it("resetPlayersAtMidQuiz empties the list", async () => {
        await resetPlayersAtMidQuiz("ABCD");

        expect(mocks.updateDoc).toHaveBeenCalledWith(refFor("ABCD"), { playersAtMidQuiz: [] });
    });

    it("wraps each write's failure with its own context", async () => {
        mocks.updateDoc.mockRejectedValue(new Error("offline"));

        await expect(startGame("ABCD")).rejects.toThrow("Failed to start game: offline");
        await expect(setRoomDifficulty("ABCD", "easy")).rejects.toThrow(
            "Failed to set difficulty: offline",
        );
        await expect(setContinueReady("ABCD", true)).rejects.toThrow(
            "Failed to set continue ready state: offline",
        );
        await expect(resetPlayersAtMidQuiz("ABCD")).rejects.toThrow(
            "Failed to reset players at mid-quiz: offline",
        );
    });
});

describe("listenToRoom", () => {
    /** Grab the (onNext, onError) handlers the module handed to onSnapshot. */
    const handlers = () => {
        const call = mocks.onSnapshot.mock.calls[0] as [
            unknown,
            (snapshot: Snapshot) => void,
            (error: Error) => void,
        ];
        return { onNext: call[1], onError: call[2] };
    };

    it("pushes room data to the callback on every snapshot", () => {
        const callback = vi.fn();
        const room = roomWith({ players: [player("p-1", "Martin", 900)] });

        listenToRoom("ABCD", callback);
        handlers().onNext(snapshotOf(room));

        expect(mocks.onSnapshot.mock.calls[0][0]).toEqual(refFor("ABCD"));
        expect(callback).toHaveBeenCalledWith(room);
    });

    it("pushes null when the room is deleted", () => {
        const callback = vi.fn();

        listenToRoom("ABCD", callback);
        handlers().onNext(snapshotOf(null));

        expect(callback).toHaveBeenCalledWith(null);
    });

    it("pushes null instead of throwing when the listener errors", () => {
        const callback = vi.fn();

        listenToRoom("ABCD", callback);
        handlers().onError(new Error("permission-denied"));

        expect(callback).toHaveBeenCalledWith(null);
    });

    it("returns the SDK's unsubscribe so the caller can detach", () => {
        const unsubscribe = vi.fn();
        mocks.onSnapshot.mockReturnValue(unsubscribe);

        const returned = listenToRoom("ABCD", vi.fn());

        expect(returned).toBe(unsubscribe);
    });

    it("degrades to a no-op unsubscribe if attaching the listener throws", () => {
        mocks.onSnapshot.mockImplementation(() => {
            throw new Error("listener setup failed");
        });
        const callback = vi.fn();

        const returned = listenToRoom("ABCD", callback);

        expect(callback).toHaveBeenCalledWith(null);
        expect(() => returned()).not.toThrow();
    });
});

describe("when Firebase never initialized", () => {
    // `src/firebase.ts` can hand back an unusable handle if the VITE_FIREBASE_*
    // env vars are missing from a build. Every exported function is expected to
    // say so, rather than throw an opaque SDK error deep inside a page.
    beforeEach(() => {
        firebaseState.db = undefined;
    });

    it("refuses every read and write with the same message", async () => {
        await expect(createRoom("ABCD", "host-1", "Martin")).rejects.toThrow(
            "Firebase not initialized",
        );
        await expect(getRoom("ABCD")).rejects.toThrow("Firebase not initialized");
        await expect(addPlayerToRoom("ABCD", "p-2", "Ida")).rejects.toThrow(
            "Firebase not initialized",
        );
        await expect(joinRoom("ABCD", "p-2", "Ida")).rejects.toThrow("Firebase not initialized");
        await expect(setRoomDifficulty("ABCD", "easy")).rejects.toThrow(
            "Firebase not initialized",
        );
        await expect(startGame("ABCD")).rejects.toThrow("Firebase not initialized");
        await expect(updatePlayerScore("ABCD", "p-1", 500)).rejects.toThrow(
            "Firebase not initialized",
        );
        await expect(setContinueReady("ABCD", true)).rejects.toThrow("Firebase not initialized");
        await expect(markPlayerAtMidQuiz("ABCD", "p-1")).rejects.toThrow(
            "Firebase not initialized",
        );
        await expect(resetPlayersAtMidQuiz("ABCD")).rejects.toThrow("Firebase not initialized");
        await expect(advanceQuestion("ABCD", 0, 15)).rejects.toThrow("Firebase not initialized");
        await expect(resumeAfterMidQuiz("ABCD")).rejects.toThrow("Firebase not initialized");
    });

    it("reaches Firestore for none of them", async () => {
        await expect(startGame("ABCD")).rejects.toThrow();
        await expect(advanceQuestion("ABCD", 0, 15)).rejects.toThrow();
        await expect(resumeAfterMidQuiz("ABCD")).rejects.toThrow();

        expect(mocks.setDoc).not.toHaveBeenCalled();
        expect(mocks.updateDoc).not.toHaveBeenCalled();
        expect(mocks.getDoc).not.toHaveBeenCalled();
        expect(mocks.runTransaction).not.toHaveBeenCalled();
    });

    it("lets listenToRoom report null instead of throwing at a rendering page", () => {
        const callback = vi.fn();

        const unsubscribe = listenToRoom("ABCD", callback);

        expect(callback).toHaveBeenCalledWith(null);
        expect(mocks.onSnapshot).not.toHaveBeenCalled();
        expect(() => unsubscribe()).not.toThrow();
    });
});

describe("generateRoomCode", () => {
    it("is always four uppercase letters", () => {
        for (let i = 0; i < 200; i += 1) {
            expect(generateRoomCode()).toMatch(/^[A-Z]{4}$/);
        }
    });

    it("maps the bottom of Math.random() to A and the top to Z", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        expect(generateRoomCode()).toBe("AAAA");

        vi.spyOn(Math, "random").mockReturnValue(0.9999999);
        expect(generateRoomCode()).toBe("ZZZZ");
    });
});

describe("setNextRoom", () => {
    it("writes the next round's code on the finished room", async () => {
        mocks.updateDoc.mockResolvedValue(undefined);
        await setNextRoom("ABCD", "EFGH");
        expect(mocks.updateDoc).toHaveBeenCalledWith(refFor("ABCD"), { nextRoomCode: "EFGH" });
    });

    it("needs Firebase", async () => {
        firebaseState.db = undefined;
        await expect(setNextRoom("ABCD", "EFGH")).rejects.toThrow("Firebase not initialized");
    });
});
