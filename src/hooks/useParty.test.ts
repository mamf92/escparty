import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useParty } from "./useParty";
import type { Party } from "../utils/partyFirestore";

const mocks = vi.hoisted(() => ({ listenToParty: vi.fn(), stop: vi.fn() }));
vi.mock("../utils/partyFirestore", () => ({ listenToParty: mocks.listenToParty }));

const party = { code: "LENA", hostId: "h", acts: [] } as unknown as Party;

describe("useParty", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.listenToParty.mockReturnValue(mocks.stop);
    });

    it("is loading until the party arrives, then follows it, and stops on unmount", () => {
        const { result, unmount } = renderHook(() => useParty("LENA"));
        expect(result.current).toBeUndefined();
        act(() => mocks.listenToParty.mock.calls[0][1](party));
        expect(result.current).toBe(party);
        unmount();
        expect(mocks.stop).toHaveBeenCalled();
    });

    it("tells a missing party (null) from one still loading", () => {
        const { result } = renderHook(() => useParty("LENA"));
        act(() => mocks.listenToParty.mock.calls[0][1](null));
        expect(result.current).toBeNull();
    });

    it("reads a listener that fails, or can't attach, as no party", () => {
        const { result } = renderHook(() => useParty("LENA"));
        act(() => mocks.listenToParty.mock.calls[0][2](new Error("denied")));
        expect(result.current).toBeNull();
        mocks.listenToParty.mockImplementationOnce(() => {
            throw new Error("no db");
        });
        const other = renderHook(() => useParty("LORD"));
        expect(other.result.current).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(2);
    });

    it("doesn't show the last party while switching to another", () => {
        const { result, rerender } = renderHook(({ code }) => useParty(code), { initialProps: { code: "LENA" } });
        act(() => mocks.listenToParty.mock.calls[0][1](party));
        rerender({ code: "LORD" });
        expect(result.current).toBeUndefined();
        expect(mocks.listenToParty.mock.calls[1][0]).toBe("LORD");
    });

    it("has no party without a code", () => {
        const { result } = renderHook(() => useParty(undefined));
        expect(result.current).toBeNull();
        expect(mocks.listenToParty).not.toHaveBeenCalled();
    });
});
