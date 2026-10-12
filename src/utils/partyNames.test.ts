import { describe, expect, it } from "vitest";
import {
    PARTY_NAMES,
    availablePartyNames,
    distinctNames,
    randomPartyName,
    withDistinctNames,
} from "./partyNames";

describe("randomPartyName", () => {
    it("is one of the participant names", () => {
        expect(PARTY_NAMES).toContain(randomPartyName());
    });
});

describe("availablePartyNames", () => {
    it("leaves out the taken names, ignoring case and edge spaces", () => {
        const free = availablePartyNames(["loreen", " Netta "]);
        expect(free).not.toContain("Loreen");
        expect(free).not.toContain("Netta");
        expect(free).toHaveLength(PARTY_NAMES.length - 2);
    });

    it("offers every name when all are taken", () => {
        expect(availablePartyNames(PARTY_NAMES)).toEqual(PARTY_NAMES);
    });
});

describe("distinctNames", () => {
    it("numbers the later ones of a shared name, by guest ID", () => {
        const names = distinctNames([
            { id: "c", name: "Lordi" },
            { id: "a", name: "Lordi" },
            { id: "b", name: "lordi" },
            { id: "d", name: "Netta" },
        ]);
        expect(names.get("a")).toBe("Lordi");
        expect(names.get("b")).toBe("lordi 2");
        expect(names.get("c")).toBe("Lordi 3");
        expect(names.get("d")).toBe("Netta");
    });
});

describe("distinctNames suffixes", () => {
    it("skips a number another guest really has", () => {
        const names = distinctNames([
            { id: "a", name: "Loreen" },
            { id: "b", name: "Loreen" },
            { id: "c", name: "Loreen 2" },
        ]);
        expect(names.get("a")).toBe("Loreen");
        expect(names.get("b")).toBe("Loreen 3");
        expect(names.get("c")).toBe("Loreen 2");
    });
});

describe("withDistinctNames", () => {
    it("keeps the order and everything else of the ballots", () => {
        const ballots = [{ guestId: "b", name: "Lordi", n: 1 }, { guestId: "a", name: "Lordi", n: 2 }];
        expect(withDistinctNames(ballots)).toEqual([
            { guestId: "b", name: "Lordi 2", n: 1 },
            { guestId: "a", name: "Lordi", n: 2 },
        ]);
    });
});

describe("distinctNames, who keeps the bare name", () => {
    it("goes to the lowest guest ID, whatever the order given", () => {
        const names = distinctNames([
            { id: "b", name: "Lordi" },
            { id: "a", name: "Lordi" },
        ]);
        expect(names.get("a")).toBe("Lordi");
        expect(names.get("b")).toBe("Lordi 2");
    });

    it("doesn't change when a guest rates (ratings play no part)", () => {
        const before = distinctNames([{ id: "a", name: "Lordi" }, { id: "z", name: "Lordi" }]);
        const after = distinctNames([
            { id: "a", name: "Lordi" },
            { id: "z", name: "Lordi", ratings: { a1: { c: 3 } } } as { id: string; name: string },
        ]);
        expect(after).toEqual(before);
    });
});
