import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePartyData } from "./usePartyData";
import { makeBallot, makeParty } from "../test/partyFixtures";

const mocks = vi.hoisted(() => ({ listenToParty: vi.fn(), listenToBallots: vi.fn(), stopParty: vi.fn(), stopBallots: vi.fn() }));
vi.mock("../utils/partyFirestore", () => ({ listenToParty: mocks.listenToParty, listenToBallots: mocks.listenToBallots }));

describe("usePartyData", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.listenToParty.mockReturnValue(mocks.stopParty);
        mocks.listenToBallots.mockReturnValue(mocks.stopBallots);
    });

    it("follows the party and its ballots, and stops on unmount", () => {
        const { result, unmount } = renderHook(() => usePartyData("ABBA"));
        expect(result.current).toMatchObject({ party: undefined, ballots: undefined, error: null });
        const [code, onParty, onPartyError] = mocks.listenToParty.mock.calls[0];
        const [, onBallots] = mocks.listenToBallots.mock.calls[0];
        expect(code).toBe("ABBA");

        act(() => onPartyError(new Error("offline")));
        expect(result.current.error).toMatch(/couldn't be reached/);
        act(() => {
            onParty(makeParty());
            onBallots([makeBallot("g", "Jedward", [12])]);
        });
        expect(result.current.party?.code).toBe("ABBA");
        expect(result.current.ballots).toHaveLength(1);
        expect(result.current.error).toBeNull();

        unmount();
        expect(mocks.stopParty).toHaveBeenCalled();
        expect(mocks.stopBallots).toHaveBeenCalled();
    });

    it("doesn't show the last party's data while switching to another", () => {
        const { result, rerender } = renderHook(({ code }) => usePartyData(code), { initialProps: { code: "ABBA" } });
        act(() => {
            mocks.listenToParty.mock.calls[0][1](makeParty());
            mocks.listenToBallots.mock.calls[0][1]([makeBallot("g", "Jedward", [12])]);
        });
        rerender({ code: "LORD" });
        expect(mocks.stopParty).toHaveBeenCalled();
        expect(result.current).toMatchObject({ party: undefined, ballots: undefined, error: null });
        expect(mocks.listenToParty.mock.calls[1][0]).toBe("LORD");
    });

    it("has no party without a code", () => {
        const { result } = renderHook(() => usePartyData(undefined));
        expect(result.current.party).toBeNull();
        expect(mocks.listenToParty).not.toHaveBeenCalled();
    });

    it("keeps saying the ratings stopped when the party updates, until a retry", () => {
        const { result } = renderHook(() => usePartyData("ABBA"));
        const [, onParty] = mocks.listenToParty.mock.calls[0];
        const [, onBallots, onBallotsError] = mocks.listenToBallots.mock.calls[0];
        act(() => {
            onParty(makeParty());
            onBallots([makeBallot("g", "Jedward", [12])]);
            onBallotsError(new Error("permission-denied"));
        });
        act(() => onParty(makeParty({ revealed: true })));
        expect(result.current.error).toMatch(/couldn't be reached/);

        // A retry attaches both listeners afresh and keeps what's on screen.
        act(() => result.current.retry());
        expect(mocks.stopParty).toHaveBeenCalled();
        expect(mocks.stopBallots).toHaveBeenCalled();
        expect(mocks.listenToParty).toHaveBeenCalledTimes(2);
        expect(mocks.listenToBallots).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBeNull();
        expect(result.current.party?.revealed).toBe(true);
        expect(result.current.ballots).toHaveLength(1);
    });

    it("reports a listener that can't start", () => {
        mocks.listenToParty.mockImplementation(() => {
            throw new Error("Firebase not initialized");
        });
        const { result } = renderHook(() => usePartyData("ABBA"));
        expect(result.current.error).toMatch(/couldn't be reached/);
    });
});
