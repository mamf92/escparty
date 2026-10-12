import { afterEach, describe, expect, it, vi } from "vitest";
import { firstFreeNumbered, freeNames, nameKey, pickFreeName } from "./freeName";

const POOL = ["Loreen", "Netta", "Lordi"];

afterEach(() => vi.restoreAllMocks());

describe("nameKey", () => {
    it("trims and lower-cases", () => {
        expect(nameKey("  LoReEn ")).toBe("loreen");
    });
});

describe("freeNames", () => {
    it("leaves out taken names, ignoring case and edge spaces", () => {
        expect(freeNames(["loreen", " Netta "], POOL)).toEqual(["Lordi"]);
    });

    it("is empty when the whole pool is taken", () => {
        expect(freeNames(POOL, POOL)).toEqual([]);
    });
});

describe("pickFreeName", () => {
    it("keeps the wanted name when it is free", () => {
        expect(pickFreeName("Loreen", ["Netta"], POOL)).toBe("Loreen");
    });

    it("takes a free pool name when the wanted one is taken (any case)", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        expect(pickFreeName("Loreen", [" LOREEN "], POOL)).toBe("Netta");
    });

    it("numbers the wanted name when the pool is used up, skipping taken numbers", () => {
        expect(pickFreeName("Loreen", [...POOL, "loreen 2"], POOL)).toBe("Loreen 3");
        expect(pickFreeName("Loreen", POOL, POOL)).toBe("Loreen 2");
    });

    it("numbers the wanted name when it is not in an empty pool", () => {
        expect(pickFreeName("Ida", ["Ida"], [])).toBe("Ida 2");
    });
});

describe("firstFreeNumbered", () => {
    it("starts at 2 and skips the numbers whose keys are taken", () => {
        expect(firstFreeNumbered("Loreen", new Set())).toBe("Loreen 2");
        expect(firstFreeNumbered("Loreen", new Set(["loreen 2", "loreen 3"]))).toBe("Loreen 4");
    });
});
