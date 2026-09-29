import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOwnBallot } from "./useOwnBallot";
import type { Ballot } from "../utils/partyModel";
import { readStoredBallot, storeBallot } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ saveBallot: vi.fn() }));
vi.mock("../utils/partyFirestore", () => ({ saveBallot: mocks.saveBallot }));

const me = { guestId: "g1", name: "Jedward", isHost: false };

describe("useOwnBallot", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.saveBallot.mockResolvedValue(undefined);
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

    it("doesn't save before the guest has joined", async () => {
        const { result, unmount } = renderHook(() => useOwnBallot("ABBA", null, []));
        act(() => result.current.rate("se", "points", 1));
        await act(() => vi.advanceTimersByTimeAsync(400));
        expect(mocks.saveBallot).not.toHaveBeenCalled();
        act(() => result.current.rate("se", "points", 2));
        unmount();
        const none = renderHook(() => useOwnBallot(undefined, me, undefined));
        expect(none.result.current.ballot).toEqual({ ratings: {}, bonuses: {} });
    });
});
