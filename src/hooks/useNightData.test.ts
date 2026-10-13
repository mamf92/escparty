import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNightData } from "./useNightData";
import { makeNight } from "../test/nightFixtures";

const mocks = vi.hoisted(() => ({ listenToNight: vi.fn(), listenToGuests: vi.fn(), stopNight: vi.fn(), stopGuests: vi.fn() }));
vi.mock("../utils/nightsFirestore", () => ({ listenToNight: mocks.listenToNight, listenToGuests: mocks.listenToGuests }));

describe("useNightData", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.listenToNight.mockReturnValue(mocks.stopNight);
        mocks.listenToGuests.mockReturnValue(mocks.stopGuests);
    });

    it("follows the night and its guests, and stops on unmount", () => {
        const { result, unmount } = renderHook(() => useNightData("ABBA"));
        expect(result.current).toMatchObject({ night: undefined, guests: undefined, error: null });
        const [code, onNight] = mocks.listenToNight.mock.calls[0];
        const [, onGuests] = mocks.listenToGuests.mock.calls[0];
        expect(code).toBe("ABBA");

        act(() => {
            onNight(makeNight());
            onGuests([{ id: "g", name: "Jedward" }]);
        });
        expect(result.current.night?.code).toBe("ABBA");
        expect(result.current.guests).toHaveLength(1);

        unmount();
        expect(mocks.stopNight).toHaveBeenCalled();
        expect(mocks.stopGuests).toHaveBeenCalled();
    });

    it("tells a missing night (null) from one still loading", () => {
        const { result } = renderHook(() => useNightData("ABBA"));
        act(() => mocks.listenToNight.mock.calls[0][1](null));
        expect(result.current.night).toBeNull();
    });

    it("doesn't show the last night's data while switching to another", () => {
        const { result, rerender } = renderHook(({ code }) => useNightData(code), { initialProps: { code: "ABBA" } });
        act(() => {
            mocks.listenToNight.mock.calls[0][1](makeNight());
            mocks.listenToGuests.mock.calls[0][1]([{ id: "g", name: "Jedward" }]);
        });
        rerender({ code: "LORD" });
        expect(mocks.stopNight).toHaveBeenCalled();
        expect(result.current).toMatchObject({ night: undefined, guests: undefined, error: null });
        expect(mocks.listenToNight.mock.calls[1][0]).toBe("LORD");
    });

    it("has no night without a code", () => {
        const { result } = renderHook(() => useNightData(undefined));
        expect(result.current.night).toBeNull();
        expect(mocks.listenToNight).not.toHaveBeenCalled();
    });

    it("keeps saying it stopped when the night updates, until a retry", () => {
        const { result } = renderHook(() => useNightData("ABBA"));
        const [, onNight] = mocks.listenToNight.mock.calls[0];
        const [, onGuests, onGuestsError] = mocks.listenToGuests.mock.calls[0];
        act(() => {
            onNight(makeNight());
            onGuests([{ id: "g", name: "Jedward" }]);
            onGuestsError(new Error("permission-denied"));
        });
        act(() => onNight(makeNight({ title: "Later" })));
        expect(result.current.error).toMatch(/couldn't be reached/);

        act(() => result.current.retry());
        expect(mocks.stopNight).toHaveBeenCalled();
        expect(mocks.stopGuests).toHaveBeenCalled();
        expect(mocks.listenToNight).toHaveBeenCalledTimes(2);
        expect(mocks.listenToGuests).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBeNull();
        expect(result.current.night?.title).toBe("Later");
        expect(result.current.guests).toHaveLength(1);
    });

    it("reports a listener that can't start, naming the one", () => {
        mocks.listenToGuests.mockImplementation(() => {
            throw new Error("Firebase not initialized");
        });
        const { result, unmount } = renderHook(() => useNightData("ABBA"));
        expect(result.current.error).toMatch(/couldn't be reached/);
        expect(console.error).toHaveBeenCalledWith("Couldn't follow the night's guests:", expect.any(Error));
        unmount();
        expect(mocks.stopNight).toHaveBeenCalled();
    });

    it("reports a night listener that can't start", () => {
        mocks.listenToNight.mockImplementation(() => {
            throw new Error("Firebase not initialized");
        });
        const { result } = renderHook(() => useNightData("ABBA"));
        expect(result.current.error).toMatch(/couldn't be reached/);
        expect(console.error).toHaveBeenCalledWith("Couldn't follow the night's details:", expect.any(Error));
    });
});
