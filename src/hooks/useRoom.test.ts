import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoom } from "./useRoom";
import type { Room } from "../utils/roomsFirestore";

const mocks = vi.hoisted(() => ({ listenToRoom: vi.fn(), stop: vi.fn() }));
vi.mock("../utils/roomsFirestore", () => ({ listenToRoom: mocks.listenToRoom }));

const room = { id: "ABBA", hostId: "h", players: [] } as unknown as Room;

describe("useRoom", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listenToRoom.mockReturnValue(mocks.stop);
    });

    it("is loading until the room arrives, then follows it, and stops on unmount", () => {
        const { result, unmount } = renderHook(() => useRoom("ABBA"));
        expect(result.current).toBeUndefined();
        act(() => mocks.listenToRoom.mock.calls[0][1](room));
        expect(result.current).toBe(room);
        unmount();
        expect(mocks.stop).toHaveBeenCalled();
    });

    it("tells a missing room (null) from one still loading", () => {
        const { result } = renderHook(() => useRoom("ABBA"));
        act(() => mocks.listenToRoom.mock.calls[0][1](null));
        expect(result.current).toBeNull();
    });

    it("doesn't show the last room while switching to another", () => {
        const { result, rerender } = renderHook(({ code }) => useRoom(code), { initialProps: { code: "ABBA" } });
        act(() => mocks.listenToRoom.mock.calls[0][1](room));
        rerender({ code: "LORD" });
        expect(result.current).toBeUndefined();
        expect(mocks.listenToRoom.mock.calls[1][0]).toBe("LORD");
    });

    it("has no room without a code", () => {
        const { result } = renderHook(() => useRoom(undefined));
        expect(result.current).toBeNull();
        expect(mocks.listenToRoom).not.toHaveBeenCalled();
    });
});
