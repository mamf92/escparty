import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOwnBallot } from "./useOwnBallot";
import type { Ballot } from "../utils/partyModel";
import { readStoredBallot, storeBallot } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ saveBallot: vi.fn(), joinParty: vi.fn() }));
vi.mock("../utils/partyFirestore", () => ({ saveBallot: mocks.saveBallot, joinParty: mocks.joinParty }));

const me = { guestId: "g1", name: "Jedward", isHost: false };

describe("useOwnBallot", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.saveBallot.mockResolvedValue(undefined);
        mocks.joinParty.mockResolvedValue(true);
    });
    afterEach(() => vi.useRealTimers());

    it("keeps each tap on the device and saves the ballot a moment later", async () => {
        const { result } = renderHook(() => useOwnBallot("ABBA", me, undefined));
        act(() => {
            result.current.rate("se", "points", 12);
            result.current.toggleBonus("se", "wind");
        });
        expect(result.current.ballot).toEqual({ ratings: { se: { points: 12 } }, bonuses: { se: ["wind"] } });
        expect(readStoredBallot("ABBA")?.ratings).toEqual({ se: { points: 12 } });
        expect(mocks.saveBallot).not.toHaveBeenCalled();

        await act(() => vi.advanceTimersByTimeAsync(400));
        expect(mocks.saveBallot).toHaveBeenCalledTimes(1);
        expect(mocks.saveBallot).toHaveBeenCalledWith("ABBA", { guestId: "g1", name: "Jedward", ratings: { se: { points: 12 } }, bonuses: { se: ["wind"] } });
        expect(result.current.state).toBe("saved");

        act(() => result.current.toggleBonus("se", "wind"));
        expect(result.current.ballot.bonuses).toEqual({ se: [] });
    });

    it("retries a failed save until it lands", async () => {
        mocks.saveBallot.mockRejectedValueOnce(new Error("offline"));
        const { result } = renderHook(() => useOwnBallot("ABBA", me, undefined));
        act(() => result.current.rate("se", "points", 8));
        await act(() => vi.advanceTimersByTimeAsync(400));
        expect(result.current.state).toBe("offline");
        await act(() => vi.advanceTimersByTimeAsync(5_000));
        expect(mocks.saveBallot).toHaveBeenCalledTimes(2);
        expect(result.current.state).toBe("saved");
    });

    it("merges the server's copy with the device's when it arrives", async () => {
        storeBallot("ABBA", { ratings: { se: { points: 10 } }, bonuses: {} });
        const server: Ballot = { guestId: "g1", name: "Jedward", ratings: { se: { points: 3 }, no: { points: 7 } }, bonuses: {} };
        const { result, rerender } = renderHook(({ ballots }) => useOwnBallot("ABBA", me, ballots), {
            initialProps: { ballots: undefined as Ballot[] | undefined },
        });
        expect(result.current.ballot.ratings).toEqual({ se: { points: 10 } });
        rerender({ ballots: [server] });
        expect(result.current.ballot.ratings).toEqual({ se: { points: 10 }, no: { points: 7 } });
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(mocks.saveBallot).toHaveBeenCalledTimes(1);
        // Only once: later snapshots don't overwrite what the guest is doing.
        rerender({ ballots: [{ ...server, ratings: {} }] });
        expect(result.current.ballot.ratings).toEqual({ se: { points: 10 }, no: { points: 7 } });
    });

    it("doesn't re-save a server copy that already matches", async () => {
        const server: Ballot = { guestId: "g1", name: "Jedward", ratings: { se: { points: 3 } }, bonuses: {} };
        renderHook(() => useOwnBallot("ABBA", me, [server]));
        await act(() => vi.advanceTimersByTimeAsync(1_000));
        expect(mocks.saveBallot).not.toHaveBeenCalled();
    });

    it("joins (claiming the name) and saves as soon as the party's ballots arrive without one", async () => {
        const other: Ballot = { guestId: "g2", name: "Lordi", ratings: {}, bonuses: {} };
        const { result } = renderHook(() => useOwnBallot("ABBA", me, [other]));
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(mocks.joinParty).toHaveBeenCalledWith("ABBA", "g1", "Jedward");
        expect(mocks.saveBallot).toHaveBeenCalledTimes(1);
        expect(mocks.saveBallot).toHaveBeenCalledWith("ABBA", { guestId: "g1", name: "Jedward", ratings: {}, bonuses: {} });
        // Joined once: later saves are plain ballot writes.
        act(() => result.current.rate("se", "points", 3));
        await act(() => vi.advanceTimersByTimeAsync(400));
        expect(mocks.joinParty).toHaveBeenCalledTimes(1);
        expect(mocks.saveBallot).toHaveBeenCalledTimes(2);
    });

    it("keeps the ratings on the device when the name turns out to be someone else's", async () => {
        mocks.joinParty.mockResolvedValue(false);
        const { result } = renderHook(() => useOwnBallot("ABBA", me, []));
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(mocks.saveBallot).not.toHaveBeenCalled();
        expect(result.current.state).toBe("offline");
        // No retry loop: another try can't change whose name it is.
        await act(() => vi.advanceTimersByTimeAsync(20_000));
        expect(mocks.joinParty).toHaveBeenCalledTimes(1);
    });

    it("doesn't join again once this guest's ballot shows up", async () => {
        const { result, rerender } = renderHook(({ ballots }) => useOwnBallot("ABBA", me, ballots), { initialProps: { ballots: [] as Ballot[] } });
        rerender({ ballots: [{ ...me, ratings: {}, bonuses: {} }] });
        await act(() => vi.advanceTimersByTimeAsync(0));
        act(() => result.current.rate("se", "points", 3));
        await act(() => vi.advanceTimersByTimeAsync(400));
        expect(mocks.joinParty).not.toHaveBeenCalled();
        expect(mocks.saveBallot).toHaveBeenCalled();
    });

    it("doesn't join when the server already has this guest's ballot", async () => {
        renderHook(() => useOwnBallot("ABBA", me, [{ ...me, ratings: {}, bonuses: {} }]));
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(mocks.joinParty).not.toHaveBeenCalled();
    });

    it("doesn't save before the guest has joined", async () => {
        const { result, unmount } = renderHook(() => useOwnBallot("ABBA", null, []));
        act(() => result.current.rate("se", "points", 1));
        await act(() => vi.advanceTimersByTimeAsync(400));
        expect(mocks.saveBallot).not.toHaveBeenCalled();
        act(() => result.current.rate("se", "points", 2));
        unmount();
        expect(mocks.saveBallot).not.toHaveBeenCalled();
        const none = renderHook(() => useOwnBallot(undefined, me, undefined));
        expect(none.result.current.ballot).toEqual({ ratings: {}, bonuses: {} });
    });

    it("sends a waiting save when the page closes, trying once", async () => {
        mocks.saveBallot.mockRejectedValue(new Error("offline"));
        const { result, unmount } = renderHook(() => useOwnBallot("ABBA", me, undefined));
        act(() => result.current.rate("se", "points", 12));
        unmount();
        expect(mocks.saveBallot).toHaveBeenCalledTimes(1);
        expect(mocks.saveBallot.mock.calls[0][1].ratings).toEqual({ se: { points: 12 } });
        await act(() => vi.advanceTimersByTimeAsync(10_000));
        expect(mocks.saveBallot).toHaveBeenCalledTimes(1);
    });
});
