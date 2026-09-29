import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useQuizTitle } from "./useQuizTitle";

const fetchQuizTitle = vi.hoisted(() => vi.fn());
vi.mock("../utils/quizCatalog", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../utils/quizCatalog")>()),
    fetchQuizTitle,
}));

describe("useQuizTitle", () => {
    it("names classic and premade quizzes without a read", () => {
        const { result } = renderHook(() => useQuizTitle("t-nordic-nights"));
        expect(result.current).toBe("Nordic Nights");
        expect(fetchQuizTitle).not.toHaveBeenCalled();
    });

    it("reads a saved quiz's title, showing a placeholder until it arrives", async () => {
        fetchQuizTitle.mockResolvedValue("Jedward's Revenge");
        const { result } = renderHook(() => useQuizTitle("c-AbCdEfGhIjKlMnOpQrSt"));
        expect(result.current).toBe("Custom quiz");
        await waitFor(() => expect(result.current).toBe("Jedward's Revenge"));
    });

    it("ignores a title that arrives after the key changed", async () => {
        let resolve: (title: string) => void = () => {};
        fetchQuizTitle.mockReturnValueOnce(new Promise(r => { resolve = r; }));
        const { result, rerender } = renderHook(({ key }) => useQuizTitle(key), {
            initialProps: { key: "c-AbCdEfGhIjKlMnOpQrSt" as string | undefined },
        });
        rerender({ key: "easy" });
        resolve("Too late");
        await Promise.resolve();
        expect(result.current).toBe("Classic: Easy");
    });
});
