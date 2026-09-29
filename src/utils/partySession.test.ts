import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    lastPartyCode,
    mergeBallots,
    readPartyIdentity,
    readStoredBallot,
    savePartyIdentity,
    storeBallot,
} from "./partySession";

const me = { guestId: "g1", name: "Jedward", isHost: false, actId: "se" };

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("identity", () => {
    it("is kept per party, and remembers the last party", () => {
        expect(readPartyIdentity("ABBA")).toBeNull();
        expect(lastPartyCode()).toBeNull();
        savePartyIdentity("ABBA", me);
        expect(readPartyIdentity("ABBA")).toEqual(me);
        expect(readPartyIdentity("LORD")).toBeNull();
        expect(lastPartyCode()).toBe("ABBA");
    });

    it("ignores what doesn't look like one", () => {
        localStorage.setItem("escparty.party.ABBA", JSON.stringify({ guestId: "", name: "x", isHost: false }));
        expect(readPartyIdentity("ABBA")).toBeNull();
        localStorage.setItem("escparty.party.ABBA", "{broken");
        expect(readPartyIdentity("ABBA")).toBeNull();
        localStorage.setItem("escparty.lastParty", JSON.stringify("ABBA"));
        expect(lastPartyCode()).toBeNull();
        localStorage.setItem("escparty.lastParty", JSON.stringify("abba"));
        expect(lastPartyCode()).toBeNull();
    });

    it("survives storage that throws", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("full");
        });
        expect(() => savePartyIdentity("ABBA", me)).not.toThrow();
        expect(readPartyIdentity("ABBA")).toBeNull();
    });
});

describe("the stored ballot", () => {
    it("round-trips with a save time", () => {
        vi.spyOn(Date, "now").mockReturnValue(42);
        expect(readStoredBallot("ABBA")).toBeNull();
        storeBallot("ABBA", { ratings: { se: { points: 12 } }, bonuses: {} });
        expect(readStoredBallot("ABBA")).toEqual({ ratings: { se: { points: 12 } }, bonuses: {}, savedAt: 42 });
        localStorage.setItem("escparty.party.ABBA.ballot", JSON.stringify({ ratings: {}, bonuses: null, savedAt: 1 }));
        expect(readStoredBallot("ABBA")).toBeNull();
    });

    it("merges with the server's, this device winning where both rated", () => {
        const server = { ratings: { se: { song: 3, show: 4 }, no: { song: 9 } }, bonuses: { se: ["wind"], no: ["pyro"] } };
        const local = { ratings: { se: { song: 8 }, fi: { song: 10 } }, bonuses: { se: [] } };
        expect(mergeBallots(server, local)).toEqual({
            ratings: { se: { song: 8, show: 4 }, no: { song: 9 }, fi: { song: 10 } },
            bonuses: { se: [], no: ["pyro"] },
        });
        expect(mergeBallots(null, null)).toEqual({ ratings: {}, bonuses: {} });
    });
});
