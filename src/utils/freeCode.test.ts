import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    doc: vi.fn(),
    getDoc: vi.fn(),
    generateRoomCode: vi.fn(),
}));
const firebaseState = vi.hoisted(() => ({ db: {} as unknown }));

vi.mock("../firebase", () => ({
    get db() {
        return firebaseState.db;
    },
}));
vi.mock("firebase/firestore", () => mocks);
vi.mock("./roomsFirestore", () => ({ generateRoomCode: mocks.generateRoomCode }));

import { freeCode } from "./freeCode";

const snapshot = (exists: boolean) => ({ exists: () => exists });
/** getDoc answering by path: only the listed `collection/code` paths exist. */
const takenAt = (...paths: string[]) =>
    mocks.getDoc.mockImplementation(async (ref: { path: string }) => snapshot(paths.includes(ref.path)));

beforeEach(() => {
    vi.clearAllMocks();
    firebaseState.db = {};
    mocks.doc.mockImplementation((_db: unknown, ...path: string[]) => ({ path: path.join("/") }));
});

describe("freeCode", () => {
    it("returns a code nothing has, after looking in rooms, parties and nights", async () => {
        mocks.generateRoomCode.mockReturnValue("ABBA");
        takenAt();
        expect(await freeCode()).toBe("ABBA");
        expect(mocks.getDoc.mock.calls.map(([ref]) => ref.path).sort()).toEqual(["nights/ABBA", "parties/ABBA", "rooms/ABBA"]);
    });

    it("draws again when any of the three has the code", async () => {
        mocks.generateRoomCode.mockReturnValueOnce("ABBA").mockReturnValueOnce("LORD").mockReturnValueOnce("NETT").mockReturnValueOnce("FREE");
        takenAt("rooms/ABBA", "parties/LORD", "nights/NETT");
        expect(await freeCode()).toBe("FREE");
        expect(mocks.generateRoomCode).toHaveBeenCalledTimes(4);
    });

    it("counts a collection it can't read as free, rather than failing", async () => {
        mocks.generateRoomCode.mockReturnValue("ABBA");
        mocks.getDoc.mockImplementation(async (ref: { path: string }) => {
            if (ref.path === "nights/ABBA") throw Object.assign(new Error("denied"), { code: "permission-denied" });
            return snapshot(false);
        });
        expect(await freeCode()).toBe("ABBA");
    });

    it("fails on any other lookup failure, so an offline host hears about it", async () => {
        mocks.generateRoomCode.mockReturnValue("ABBA");
        const offline = Object.assign(new Error("offline"), { code: "unavailable" });
        mocks.getDoc.mockRejectedValue(offline);
        await expect(freeCode()).rejects.toBe(offline);
    });

    it("gives up with a friendly error after five taken codes", async () => {
        mocks.generateRoomCode.mockReturnValue("ABBA");
        takenAt("nights/ABBA");
        await expect(freeCode()).rejects.toThrow("Couldn't find a free code. Try again.");
        expect(mocks.generateRoomCode).toHaveBeenCalledTimes(5);
    });

    it("needs Firebase", async () => {
        firebaseState.db = null;
        await expect(freeCode()).rejects.toThrow("Firebase not initialized");
    });
});
