import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    doc: vi.fn(),
    collection: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    onSnapshot: vi.fn(),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    Timestamp: { fromMillis: vi.fn((ms: number) => ({ ms })) },
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

import {
    PARTY_LIFETIME_DAYS,
    createParty,
    fetchBallot,
    fetchContest,
    isAct,
    listenToBallots,
    listenToParty,
    saveBallot,
    setPartyResults,
    setPartyRevealed,
    updatePartyActs,
    type NewParty,
} from "./partyFirestore";
import { CONTESTS_2027 } from "../data/contests2027";

const snapshot = (data: Record<string, unknown> | null) => ({ exists: () => data !== null, data: () => data });
const act = { id: "se", country: "Sweden", flag: "🇸🇪", artist: "Loreen", song: "Tattoo" };
const final = CONTESTS_2027[2];

beforeEach(() => {
    vi.clearAllMocks();
    firebaseState.db = {};
    mocks.doc.mockImplementation((_db: unknown, ...path: string[]) => ({ path: path.join("/") }));
    mocks.collection.mockImplementation((_db: unknown, ...path: string[]) => ({ path: path.join("/") }));
});

describe("fetchContest", () => {
    it("uses the lineup in Firestore when there is one", async () => {
        mocks.getDoc.mockResolvedValue(snapshot({ title: "Real final", kind: "final", date: "2027-05-15", acts: [act, { id: "BAD" }] }));
        const contest = await fetchContest(final.id);
        expect(mocks.doc).toHaveBeenCalledWith(firebaseState.db, "contests", final.id);
        expect(contest).toEqual({ id: final.id, title: "Real final", kind: "final", qualifiers: undefined, date: "2027-05-15", acts: [act] });
    });

    it("fills gaps in the Firestore doc from the bundled show", async () => {
        mocks.getDoc.mockResolvedValue(snapshot({ acts: [act] }));
        const semi = CONTESTS_2027[0];
        expect(await fetchContest(semi.id)).toEqual({ ...semi, acts: [act] });
        expect(await fetchContest("unknown")).toEqual({ id: "unknown", title: "unknown", kind: "final", qualifiers: undefined, date: "", acts: [act] });
    });

    it("falls back to the bundled lineup when there's none or it can't be read", async () => {
        mocks.getDoc.mockResolvedValueOnce(snapshot(null));
        expect(await fetchContest(final.id)).toBe(final);
        mocks.getDoc.mockResolvedValueOnce(snapshot({ acts: "nope" }));
        expect(await fetchContest(final.id)).toBe(final);
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.getDoc.mockRejectedValueOnce(new Error("offline"));
        expect(await fetchContest(final.id)).toBe(final);
    });
});

it("knows an act", () => {
    expect(isAct(act)).toBe(true);
    expect(isAct({ ...act, id: "Sweden!" })).toBe(false);
    expect(isAct({ ...act, song: 1 })).toBe(false);
    expect(isAct(null)).toBe(false);
});

describe("createParty", () => {
    const party: NewParty = {
        hostId: "h", title: final.title, contestId: final.id, kind: "final", qualifiers: 0, acts: [act],
        template: { id: "douze", name: "Douze", blurb: "", categories: [{ id: "points", label: "Points", max: 12 }] },
        bonuses: true, showNames: false,
    };

    it("takes a free code, with an expiry for the TTL policy", async () => {
        vi.spyOn(Date, "now").mockReturnValue(1000);
        mocks.generateRoomCode.mockReturnValueOnce("ABBA").mockReturnValueOnce("LORD");
        mocks.getDoc.mockResolvedValueOnce(snapshot({})).mockResolvedValueOnce(snapshot(null));
        expect(await createParty(party)).toBe("LORD");
        expect(mocks.setDoc).toHaveBeenCalledWith({ path: "parties/LORD" }, {
            ...party, code: "LORD", results: {}, revealed: false, createdAt: "SERVER_TIMESTAMP",
            expireAt: { ms: 1000 + PARTY_LIFETIME_DAYS * 86_400_000 },
        });
        vi.mocked(Date.now).mockRestore();
    });

    it("tries another code when one is taken between the check and the write", async () => {
        mocks.generateRoomCode.mockReturnValueOnce("ABBA").mockReturnValueOnce("LORD");
        mocks.getDoc.mockResolvedValue(snapshot(null));
        mocks.setDoc.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "permission-denied" }));
        expect(await createParty(party)).toBe("LORD");
        mocks.setDoc.mockRejectedValueOnce(new Error("offline"));
        await expect(createParty(party)).rejects.toThrow("offline");
    });

    it("gives up after five taken codes", async () => {
        mocks.generateRoomCode.mockReturnValue("ABBA");
        mocks.getDoc.mockResolvedValue(snapshot({}));
        await expect(createParty(party)).rejects.toThrow(/free party code/);
        expect(mocks.getDoc).toHaveBeenCalledTimes(5);
    });

    it("needs Firebase", async () => {
        firebaseState.db = null;
        await expect(createParty(party)).rejects.toThrow("Firebase not initialized");
    });
});

describe("listeners", () => {
    it("follow the party, null when it's gone", () => {
        const onParty = vi.fn();
        const onError = vi.fn();
        listenToParty("ABBA", onParty, onError);
        const [ref, next, fail] = mocks.onSnapshot.mock.calls[0];
        expect(ref).toEqual({ path: "parties/ABBA" });
        next(snapshot({ code: "ABBA" }));
        next(snapshot(null));
        fail(new Error("denied"));
        expect(onParty.mock.calls).toEqual([[{ code: "ABBA" }], [null]]);
        expect(onError).toHaveBeenCalledWith(new Error("denied"));
        listenToParty("ABBA", onParty);
        mocks.onSnapshot.mock.calls[1][2](new Error("quiet"));
    });

    it("follow the ballots, tidying bad fields", () => {
        const onBallots = vi.fn();
        listenToBallots("ABBA", onBallots);
        const [ref, next, fail] = mocks.onSnapshot.mock.calls[0];
        expect(ref).toEqual({ path: "parties/ABBA/ballots" });
        next({ docs: [
            { id: "g1", data: () => ({ name: "Jedward", ratings: { se: { points: 12 } }, bonuses: { se: ["wind"] } }) },
            { id: "g2", data: () => ({ name: 3, ratings: [], bonuses: null }) },
            { id: "g3", data: () => ({ name: "Hatari", ratings: { se: { points: "12", show: 4 }, no: 5 }, bonuses: { se: "wind", no: [1, "pyro"] } }) },
        ] });
        expect(onBallots).toHaveBeenCalledWith([
            { guestId: "g1", name: "Jedward", ratings: { se: { points: 12 } }, bonuses: { se: ["wind"] } },
            { guestId: "g2", name: "Guest", ratings: {}, bonuses: {} },
            { guestId: "g3", name: "Hatari", ratings: { se: { show: 4 } }, bonuses: { no: ["pyro"] } },
        ]);
        fail(new Error("ignored without a handler"));
    });
});

describe("ballots and host writes", () => {
    it("save and read a ballot", async () => {
        await saveBallot("ABBA", { guestId: "g1", name: "Jedward", ratings: { se: { points: 12 } }, bonuses: {} });
        expect(mocks.setDoc).toHaveBeenCalledWith({ path: "parties/ABBA/ballots/g1" }, {
            name: "Jedward", ratings: { se: { points: 12 } }, bonuses: {}, updatedAt: "SERVER_TIMESTAMP", expireAt: { ms: expect.any(Number) },
        });
        mocks.getDoc.mockResolvedValueOnce(snapshot({ name: "Jedward", ratings: {}, bonuses: {} })).mockResolvedValueOnce(snapshot(null));
        expect(await fetchBallot("ABBA", "g1")).toEqual({ guestId: "g1", name: "Jedward", ratings: {}, bonuses: {} });
        expect(await fetchBallot("ABBA", "g2")).toBeNull();
    });

    it("update the running order, the result and the awards", async () => {
        await updatePartyActs("ABBA", [act]);
        await updatePartyActs("ABBA", [act], { places: { no: 1, se: 2 } });
        await setPartyResults("ABBA", { places: { se: 1 } });
        await setPartyRevealed("ABBA", true);
        expect(mocks.updateDoc.mock.calls).toEqual([
            [{ path: "parties/ABBA" }, { acts: [act] }],
            [{ path: "parties/ABBA" }, { acts: [act], results: { places: { se: 1 } } }],
            [{ path: "parties/ABBA" }, { results: { places: { se: 1 } } }],
            [{ path: "parties/ABBA" }, { revealed: true }],
        ]);
    });
});
