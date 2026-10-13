import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    doc: vi.fn(),
    collection: vi.fn(),
    getDoc: vi.fn(),
    updateDoc: vi.fn(),
    onSnapshot: vi.fn(),
    arrayUnion: vi.fn((value: unknown) => ({ union: value })),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    Timestamp: { fromMillis: vi.fn((ms: number) => ({ ms })) },
    freeCode: vi.fn(),
    batchSet: vi.fn(),
    batchDelete: vi.fn(),
    batchCommit: vi.fn(),
    writeBatch: vi.fn(),
}));
const firebaseState = vi.hoisted(() => ({ db: {} as unknown }));

vi.mock("../firebase", () => ({
    get db() {
        return firebaseState.db;
    },
}));
vi.mock("firebase/firestore", () => mocks);
vi.mock("./freeCode", () => ({ freeCode: mocks.freeCode }));
// partyFirestore is only here for JOIN_TIMEOUT_MS; keep its Firestore calls out of the way.
vi.mock("./partyFirestore", () => ({ JOIN_TIMEOUT_MS: 10_000 }));

import {
    NIGHT_LIFETIME_DAYS,
    addNightActivity,
    closeNight,
    createNight,
    fetchNightGuest,
    joinNight,
    leaveNight,
    listenToGuests,
    listenToNight,
    moveNight,
    nightExists,
} from "./nightsFirestore";

const snapshot = (data: Record<string, unknown> | null) => ({ exists: () => data !== null, data: () => data });
const denied = Object.assign(new Error("denied"), { code: "permission-denied" });
const expireAt = (now: number) => ({ ms: now + NIGHT_LIFETIME_DAYS * 86_400_000 });

beforeEach(() => {
    vi.clearAllMocks();
    firebaseState.db = {};
    mocks.doc.mockImplementation((_db: unknown, ...path: string[]) => ({ path: path.join("/") }));
    mocks.collection.mockImplementation((_db: unknown, ...path: string[]) => ({ path: path.join("/") }));
    mocks.updateDoc.mockResolvedValue(undefined);
    mocks.writeBatch.mockReturnValue({ set: mocks.batchSet, delete: mocks.batchDelete, commit: mocks.batchCommit });
});

describe("createNight", () => {
    it("writes the night, the host's guest and the host's claim in one batch", async () => {
        vi.spyOn(Date, "now").mockReturnValue(1000);
        mocks.freeCode.mockResolvedValueOnce("NITE");
        expect(await createNight("Saturday at Ola's", "h", "Ola")).toBe("NITE");
        expect(mocks.batchSet.mock.calls).toEqual([
            [{ path: "nights/NITE" }, {
                code: "NITE", hostId: "h", title: "Saturday at Ola's", activities: [], closed: false,
                createdAt: "SERVER_TIMESTAMP", expireAt: expireAt(1000),
            }],
            [{ path: "nights/NITE/names/ola" }, { name: "Ola", guestId: "h", expireAt: expireAt(1000) }],
            [{ path: "nights/NITE/guests/h" }, { name: "Ola", joinedAt: "SERVER_TIMESTAMP", expireAt: expireAt(1000) }],
        ]);
        expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
        vi.mocked(Date.now).mockRestore();
    });

    it("tries another code when one is taken between the check and the write", async () => {
        mocks.freeCode.mockResolvedValueOnce("ABBA").mockResolvedValueOnce("LORD");
        // Taken when the write was refused, then free.
        mocks.getDoc.mockResolvedValueOnce(snapshot({}));
        mocks.batchCommit.mockRejectedValueOnce(denied);
        expect(await createNight("Night", "h", "Ola")).toBe("LORD");
        expect(mocks.getDoc).toHaveBeenCalledWith({ path: "nights/ABBA" });
    });

    it("says so when the host's own guest or claim was refused, or the write failed otherwise", async () => {
        mocks.freeCode.mockResolvedValue("ABBA");
        mocks.getDoc.mockResolvedValue(snapshot(null));
        mocks.batchCommit.mockRejectedValueOnce(denied);
        await expect(createNight("Night", "h", "Ola")).rejects.toBe(denied);
        // Not even readable: the refusal stands.
        mocks.getDoc.mockRejectedValueOnce(new Error("offline"));
        mocks.batchCommit.mockRejectedValueOnce(denied);
        await expect(createNight("Night", "h", "Ola")).rejects.toBe(denied);
        mocks.batchCommit.mockRejectedValueOnce(new Error("offline"));
        await expect(createNight("Night", "h", "Ola")).rejects.toThrow("offline");
    });

    it("gives up after five codes taken between the check and the write", async () => {
        mocks.freeCode.mockResolvedValue("ABBA");
        mocks.getDoc.mockResolvedValue(snapshot({}));
        mocks.batchCommit.mockRejectedValue(denied);
        await expect(createNight("Night", "h", "Ola")).rejects.toThrow(/free night code/);
        expect(mocks.freeCode).toHaveBeenCalledTimes(5);
        mocks.batchCommit.mockReset();
    });

    it("needs Firebase", async () => {
        firebaseState.db = null;
        await expect(createNight("Night", "h", "Ola")).rejects.toThrow("Firebase not initialized");
    });
});

describe("joinNight", () => {
    it("claims the name and writes the guest in one batch", async () => {
        mocks.batchCommit.mockResolvedValueOnce(undefined);
        expect(await joinNight("NITE", "g1", " Loreen ")).toBe(true);
        expect(mocks.batchSet).toHaveBeenCalledWith({ path: "nights/NITE/names/loreen" }, {
            name: " Loreen ", guestId: "g1", expireAt: { ms: expect.any(Number) },
        });
        expect(mocks.batchSet).toHaveBeenCalledWith({ path: "nights/NITE/guests/g1" }, {
            name: " Loreen ", joinedAt: "SERVER_TIMESTAMP", expireAt: { ms: expect.any(Number) },
        });
        expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    });

    it("a refused claim is someone else's name, or this guest's from an earlier try", async () => {
        mocks.batchCommit.mockRejectedValue(denied);
        mocks.getDoc
            .mockResolvedValueOnce(snapshot({ name: "Loreen", guestId: "g2" }))
            .mockResolvedValueOnce(snapshot({ closed: false }));
        expect(await joinNight("NITE", "g1", "Loreen")).toBe(false);
        // Someone else's name in a closed night: the night refused it, not the name.
        mocks.getDoc
            .mockResolvedValueOnce(snapshot({ name: "Loreen", guestId: "g2" }))
            .mockResolvedValueOnce(snapshot({ closed: true }));
        await expect(joinNight("NITE", "g1", "Loreen")).rejects.toBe(denied);
        mocks.getDoc.mockResolvedValueOnce(snapshot({ name: "Loreen", guestId: "g1" }));
        expect(await joinNight("NITE", "g1", "Loreen")).toBe(true);
        // Refused with no claim there (a closed night): not about the name, so the error stands.
        mocks.getDoc.mockResolvedValueOnce(snapshot(null));
        await expect(joinNight("NITE", "g1", "Loreen")).rejects.toBe(denied);
        const offline = Object.assign(new Error("offline"), { code: "unavailable" });
        mocks.batchCommit.mockRejectedValueOnce(offline);
        await expect(joinNight("NITE", "g1", "Loreen")).rejects.toBe(offline);
        mocks.batchCommit.mockReset();
    });

    it("gives up waiting after a while, since an offline write never fails", async () => {
        vi.useFakeTimers();
        mocks.batchCommit.mockReturnValueOnce(new Promise(() => {}));
        const joined = joinNight("NITE", "g1", "Loreen");
        const settled = expect(joined).rejects.toMatchObject({ code: "deadline-exceeded" });
        await vi.advanceTimersByTimeAsync(10_000);
        await settled;
        vi.useRealTimers();
    });
});

describe("leaveNight", () => {
    it("deletes the guest and their claim in one batch", async () => {
        mocks.batchCommit.mockResolvedValueOnce(undefined);
        await leaveNight("NITE", "g1", " Loreen ");
        expect(mocks.batchDelete.mock.calls).toEqual([
            [{ path: "nights/NITE/guests/g1" }],
            [{ path: "nights/NITE/names/loreen" }],
        ]);
        expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    });

    it("counts a retry of a leave that already went through as done", async () => {
        mocks.batchCommit.mockRejectedValueOnce(denied);
        mocks.getDoc.mockResolvedValueOnce(snapshot(null));
        await expect(leaveNight("NITE", "g1", "Loreen")).resolves.toBeUndefined();
        // Still there: the refusal was real.
        mocks.batchCommit.mockRejectedValueOnce(denied);
        mocks.getDoc.mockResolvedValueOnce(snapshot({ name: "Loreen" }));
        await expect(leaveNight("NITE", "g1", "Loreen")).rejects.toBe(denied);
        const offline = Object.assign(new Error("offline"), { code: "unavailable" });
        mocks.batchCommit.mockRejectedValueOnce(offline);
        await expect(leaveNight("NITE", "g1", "Loreen")).rejects.toBe(offline);
    });
});

describe("listeners", () => {
    it("follow the night, null when it's gone, with unusable activities dropped", () => {
        const onNight = vi.fn();
        const onError = vi.fn();
        listenToNight("NITE", onNight, onError);
        const [ref, next, fail] = mocks.onSnapshot.mock.calls[0];
        expect(ref).toEqual({ path: "nights/NITE" });
        const quiz = { kind: "quiz", code: "ABBA", title: "Pub quiz" };
        next(snapshot({ code: "NITE", activities: [quiz, { kind: "karaoke", code: "LORD", title: "x" }, { kind: "scoreboard", code: "lord", title: "x" }, { kind: "quiz", code: "LORD", title: 3 }, null] }));
        next(snapshot({ code: "NITE", activities: "nope" }));
        next(snapshot(null));
        fail(new Error("denied"));
        expect(onNight.mock.calls).toEqual([
            [{ code: "NITE", activities: [quiz] }],
            [{ code: "NITE", activities: [] }],
            [null],
        ]);
        expect(onError).toHaveBeenCalledWith(new Error("denied"));
        listenToNight("NITE", onNight);
        mocks.onSnapshot.mock.calls[1][2](new Error("quiet"));
    });

    it("follow the roster in the order guests joined, a pending join last", () => {
        const onGuests = vi.fn();
        const onError = vi.fn();
        listenToGuests("NITE", onGuests, onError);
        const [ref, next, fail] = mocks.onSnapshot.mock.calls[0];
        expect(ref).toEqual({ path: "nights/NITE/guests" });
        const at = (ms: number) => ({ toMillis: () => ms });
        next({ docs: [
            { id: "g3", data: () => ({ name: "Hatari", joinedAt: null }) },
            { id: "g2", data: () => ({ name: 7, joinedAt: at(20) }) },
            { id: "g1", data: () => ({ name: "Jedward", joinedAt: at(10) }) },
        ] });
        expect(onGuests).toHaveBeenCalledWith([
            { id: "g1", name: "Jedward" },
            { id: "g2", name: "Guest" },
            { id: "g3", name: "Hatari" },
        ]);
        fail(new Error("denied"));
        expect(onError).toHaveBeenCalledWith(new Error("denied"));
        listenToGuests("NITE", onGuests);
        mocks.onSnapshot.mock.calls[1][2](new Error("quiet"));
    });
});

describe("reads", () => {
    it("say whether a night has the code", async () => {
        mocks.getDoc.mockResolvedValueOnce(snapshot({ title: "Night" })).mockResolvedValueOnce(snapshot(null));
        expect(await nightExists("NITE")).toBe(true);
        expect(mocks.getDoc).toHaveBeenLastCalledWith({ path: "nights/NITE" });
        expect(await nightExists("ZZZZ")).toBe(false);
    });

    it("find one guest, or none", async () => {
        mocks.getDoc.mockResolvedValueOnce(snapshot({ name: "Loreen" })).mockResolvedValueOnce(snapshot(null));
        expect(await fetchNightGuest("NITE", "g1")).toEqual({ id: "g1", name: "Loreen" });
        expect(mocks.getDoc).toHaveBeenLastCalledWith({ path: "nights/NITE/guests/g1" });
        expect(await fetchNightGuest("NITE", "g2")).toBeNull();
    });
});

describe("host writes", () => {
    it("list an activity, close the night and move on", async () => {
        const activity = { kind: "quiz" as const, code: "ABBA", title: "Pub quiz" };
        await addNightActivity("NITE", activity);
        await closeNight("NITE");
        await moveNight("NITE", "NEXT");
        expect(mocks.updateDoc.mock.calls).toEqual([
            [{ path: "nights/NITE" }, { activities: { union: activity } }],
            [{ path: "nights/NITE" }, { closed: true }],
            [{ path: "nights/NITE" }, { movedTo: "NEXT", closed: true }],
        ]);
    });

    it("count a retried add or close that already went through as done", async () => {
        const activity = { kind: "quiz" as const, code: "ABBA", title: "Pub quiz" };
        mocks.updateDoc.mockRejectedValue(denied);
        mocks.getDoc.mockResolvedValue(snapshot({ activities: [activity], closed: true, movedTo: "NEXT" }));
        await expect(addNightActivity("NITE", activity)).resolves.toBeUndefined();
        await expect(closeNight("NITE")).resolves.toBeUndefined();
        await expect(moveNight("NITE", "NEXT")).resolves.toBeUndefined();
        // Same code, other title: not the add that landed.
        await expect(addNightActivity("NITE", { ...activity, title: "Other" })).rejects.toBe(denied);
        // Moved, but elsewhere: not this move.
        await expect(moveNight("NITE", "ELSE")).rejects.toBe(denied);
        // Not there, or still open: the refusal was real.
        mocks.getDoc.mockResolvedValue(snapshot({ activities: [], closed: false }));
        await expect(addNightActivity("NITE", activity)).rejects.toBe(denied);
        await expect(closeNight("NITE")).rejects.toBe(denied);
        mocks.getDoc.mockResolvedValue(snapshot(null));
        await expect(addNightActivity("NITE", activity)).rejects.toBe(denied);
        await expect(closeNight("NITE")).rejects.toBe(denied);
        const offline = Object.assign(new Error("offline"), { code: "unavailable" });
        mocks.updateDoc.mockRejectedValue(offline);
        await expect(addNightActivity("NITE", activity)).rejects.toBe(offline);
        await expect(closeNight("NITE")).rejects.toBe(offline);
        mocks.updateDoc.mockReset();
        mocks.getDoc.mockReset();
    });
});
