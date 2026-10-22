import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
    Timestamp: { fromMillis: vi.fn((ms: number) => ({ ms })) },
}));

import { expiryFromNow } from "./expiry";

describe("expiryFromNow", () => {
    afterEach(() => vi.restoreAllMocks());

    it("is the given number of days from now", () => {
        vi.spyOn(Date, "now").mockReturnValue(1000);
        expect(expiryFromNow(30)).toEqual({ ms: 1000 + 30 * 86_400_000 });
    });
});
