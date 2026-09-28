import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResumeRoom } from "./useResumeRoom";

const mocks = vi.hoisted(() => ({ resumeAfterMidQuiz: vi.fn() }));
vi.mock("../utils/roomsFirestore", () => ({ resumeAfterMidQuiz: mocks.resumeAfterMidQuiz }));

describe("useResumeRoom", () => {
    beforeEach(() => {
        mocks.resumeAfterMidQuiz.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => { });
    });

    it("resumes the room and stays busy until reset (the room's snapshot comes a moment later)", async () => {
        mocks.resumeAfterMidQuiz.mockResolvedValue(true);
        const { result } = renderHook(() => useResumeRoom("ABCD"));
        await act(() => result.current.resume());
        expect(mocks.resumeAfterMidQuiz).toHaveBeenCalledWith("ABCD");
        expect(result.current.resuming).toBe(true);
        expect(result.current.resumeError).toBeNull();
        await act(() => result.current.resume()); // a tap in the gap
        expect(mocks.resumeAfterMidQuiz).toHaveBeenCalledTimes(1);
        act(() => result.current.reset());
        expect(result.current.resuming).toBe(false);
    });

    it("ignores a second tap while a resume is in flight", async () => {
        let finish: (value: boolean) => void = () => { };
        mocks.resumeAfterMidQuiz.mockReturnValue(new Promise<boolean>((resolve) => { finish = resolve; }));
        const { result } = renderHook(() => useResumeRoom("ABCD"));
        let first: Promise<void> = Promise.resolve();
        act(() => {
            first = result.current.resume();
            void result.current.resume(); // same render: the state still says idle
        });
        expect(result.current.resuming).toBe(true);
        await act(async () => { finish(true); await first; });
        expect(mocks.resumeAfterMidQuiz).toHaveBeenCalledTimes(1);
    });

    it("shows a retryable error when the resume fails, and a retry clears it", async () => {
        mocks.resumeAfterMidQuiz.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
        const { result } = renderHook(() => useResumeRoom("ABCD"));
        await act(() => result.current.resume());
        expect(result.current.resumeError).toMatch(/try again/);
        expect(result.current.resuming).toBe(false);
        await act(() => result.current.resume());
        expect(result.current.resumeError).toBeNull();
        expect(mocks.resumeAfterMidQuiz).toHaveBeenCalledTimes(2);
    });

    it("says so when the room wasn't in a break", async () => {
        mocks.resumeAfterMidQuiz.mockResolvedValue(false);
        const { result } = renderHook(() => useResumeRoom("ABCD"));
        await act(() => result.current.resume());
        expect(result.current.resumeError).toMatch(/isn't at a break/);
        expect(result.current.resuming).toBe(false);
        act(() => result.current.reset());
        expect(result.current.resumeError).toBeNull();
    });

    it("drops the result of a resume that settles after a reset (the room moved on meanwhile)", async () => {
        let fail: (error: Error) => void = () => { };
        mocks.resumeAfterMidQuiz.mockReturnValue(new Promise<boolean>((_, reject) => { fail = reject; }));
        const { result } = renderHook(() => useResumeRoom("ABCD"));
        let pending: Promise<void> = Promise.resolve();
        act(() => { pending = result.current.resume(); });
        act(() => result.current.reset());
        await act(async () => { fail(new Error("reply lost")); await pending; });
        expect(result.current.resumeError).toBeNull();
        expect(result.current.resuming).toBe(false);
    });

    it("does nothing without a room", async () => {
        const { result } = renderHook(() => useResumeRoom(null));
        await act(() => result.current.resume());
        expect(mocks.resumeAfterMidQuiz).not.toHaveBeenCalled();
    });
});
