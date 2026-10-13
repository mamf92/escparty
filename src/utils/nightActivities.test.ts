import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    fetchBallot: vi.fn(),
    fetchParty: vi.fn(),
    leaveParty: vi.fn(),
    getRoom: vi.fn(),
    removePlayerFromRoom: vi.fn(),
}));
vi.mock("./partyFirestore", () => ({ fetchBallot: mocks.fetchBallot, fetchParty: mocks.fetchParty, leaveParty: mocks.leaveParty }));
vi.mock("./roomsFirestore", () => ({ getRoom: mocks.getRoom, removePlayerFromRoom: mocks.removePlayerFromRoom }));

import { leaveNightActivities, nextQuizTitle, quizStage } from "./nightActivities";
import { readPartyIdentity, savePartyIdentity } from "./partySession";
import type { Room } from "./roomsFirestore";

const me = { guestId: "g-me", name: "Lordi" };
const quiz = (code: string) => ({ kind: "quiz" as const, code, title: "Quiz" });
const board = (code: string) => ({ kind: "scoreboard" as const, code, title: "Semi-final 1" });
const self = { id: "g-me", name: "Lordi", score: 0 };
const party = (change: Record<string, unknown> = {}) =>
    ({ code: "LENA", hostId: "host-1", kind: "final", results: {}, revealed: false, ...change });
const room = (change: Partial<Room> = {}) => ({ id: "ABBA", hostId: "host-1", started: false, phase: "lobby", players: [self], ...change }) as unknown as Room;

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.leaveParty.mockResolvedValue(undefined);
    mocks.fetchParty.mockResolvedValue(party());
    mocks.removePlayerFromRoom.mockResolvedValue(undefined);
});

describe("nextQuizTitle", () => {
    it("calls the first quiz Quiz, then numbers the rest, counting quizzes only", () => {
        expect(nextQuizTitle([])).toBe("Quiz");
        expect(nextQuizTitle([board("LENA")])).toBe("Quiz");
        expect(nextQuizTitle([quiz("ABBA"), board("LENA")])).toBe("Quiz 2");
        expect(nextQuizTitle([quiz("ABBA"), quiz("LORD"), board("LENA")])).toBe("Quiz 3");
    });
});

describe("quizStage", () => {
    it("tells a lobby from a running quiz and the results", () => {
        expect(quizStage(room())).toBe("lobby");
        expect(quizStage(room({ phase: undefined }))).toBe("lobby");
        expect(quizStage(room({ phase: "question", started: true }))).toBe("running");
        expect(quizStage(room({ phase: "mid-scoreboard", started: true }))).toBe("running");
        // A room from before phases, started.
        expect(quizStage(room({ phase: undefined, started: true }))).toBe("running");
        expect(quizStage(room({ phase: "results", started: true }))).toBe("results");
    });
});

describe("leaveNightActivities", () => {
    it("leaves each scoreboard that has the guest's ballot, with the name on it, and forgets the party", async () => {
        savePartyIdentity("LENA", { guestId: "g-me", name: "Lordi", isHost: false });
        mocks.fetchBallot.mockResolvedValue({ guestId: "g-me", name: "Lordi", ratings: {}, bonuses: {} });
        await leaveNightActivities([board("LENA")], me);
        expect(mocks.fetchBallot).toHaveBeenCalledWith("LENA", "g-me");
        expect(mocks.leaveParty).toHaveBeenCalledWith("LENA", "g-me", "Lordi");
        expect(readPartyIdentity("LENA")).toBeNull();
    });

    it("has nothing to leave in a scoreboard the guest never rated in, but still forgets it", async () => {
        savePartyIdentity("LENA", { guestId: "g-me", name: "Lordi", isHost: false });
        mocks.fetchBallot.mockResolvedValue(null);
        await leaveNightActivities([board("LENA")], me);
        expect(mocks.leaveParty).not.toHaveBeenCalled();
        expect(readPartyIdentity("LENA")).toBeNull();
    });

    it("keeps a scoreboard the guest hosts, ballot and stored identity both", async () => {
        savePartyIdentity("LENA", { guestId: "g-me", name: "Lordi", isHost: true });
        mocks.fetchParty.mockResolvedValue(party({ hostId: "g-me" }));
        mocks.fetchBallot.mockResolvedValue({ guestId: "g-me", name: "Lordi", ratings: {}, bonuses: {} });
        await leaveNightActivities([board("LENA")], me);
        expect(mocks.leaveParty).not.toHaveBeenCalled();
        expect(readPartyIdentity("LENA")).not.toBeNull();
    });

    it.each([
        ["real places are entered", { results: { places: { a: 1 } } }],
        ["qualifiers are entered", { kind: "semi", results: { qualifiers: ["a"] } }],
        ["the awards are open", { revealed: true }],
    ])("keeps the ballot once %s, and forgets only the stored identity", async (_what, change) => {
        savePartyIdentity("LENA", { guestId: "g-me", name: "Lordi", isHost: false });
        mocks.fetchParty.mockResolvedValue(party(change));
        mocks.fetchBallot.mockResolvedValue({ guestId: "g-me", name: "Lordi", ratings: {}, bonuses: {} });
        await leaveNightActivities([board("LENA")], me);
        expect(mocks.leaveParty).not.toHaveBeenCalled();
        expect(readPartyIdentity("LENA")).toBeNull();
    });

    it("only forgets the stored identity of a scoreboard that is gone", async () => {
        savePartyIdentity("LENA", { guestId: "g-me", name: "Lordi", isHost: false });
        mocks.fetchParty.mockResolvedValue(null);
        await leaveNightActivities([board("LENA")], me);
        expect(mocks.leaveParty).not.toHaveBeenCalled();
        expect(readPartyIdentity("LENA")).toBeNull();
    });

    it("takes the guest out of a quiz still in its lobby", async () => {
        mocks.getRoom.mockResolvedValue(room());
        await leaveNightActivities([quiz("ABBA")], me);
        expect(mocks.removePlayerFromRoom).toHaveBeenCalledWith("ABBA", self);
    });

    it("leaves a quiz alone that is the guest's own, has started, is gone or doesn't list them", async () => {
        mocks.getRoom
            .mockResolvedValueOnce(room({ hostId: "g-me" }))
            .mockResolvedValueOnce(room({ phase: "question", started: true }))
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(room({ players: [] }));
        await leaveNightActivities([quiz("AAAA"), quiz("BBBB"), quiz("CCCC"), quiz("DDDD")], me);
        expect(mocks.removePlayerFromRoom).not.toHaveBeenCalled();
    });

    it("logs a failure and goes on with the rest", async () => {
        mocks.fetchBallot.mockRejectedValue(new Error("offline"));
        mocks.getRoom.mockResolvedValue(room());
        await expect(leaveNightActivities([board("LENA"), quiz("ABBA")], me)).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalled();
        expect(mocks.removePlayerFromRoom).toHaveBeenCalled();
    });
});
