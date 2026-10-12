import { describe, expect, it } from "vitest";
import {
    PARTY_NAMES,
    availablePartyNames,
    distinctNames,
    freePartyName,
    nameClash,
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

describe("freePartyName", () => {
    it("picks a name nobody has", () => {
        const taken = PARTY_NAMES.slice(1);
        expect(freePartyName(taken)).toBe(PARTY_NAMES[0]);
    });

    it("numbers a name when all are taken, past numbers already used", () => {
        expect(PARTY_NAMES).toContain(freePartyName(PARTY_NAMES).replace(/ 2$/, ""));
        expect(freePartyName(PARTY_NAMES)).toMatch(/ 2$/);
        const taken = [...PARTY_NAMES, ...PARTY_NAMES.map(name => `${name} 2`)];
        expect(freePartyName(taken)).toMatch(/ 3$/);
    });
});

describe("nameClash", () => {
    const me = { guestId: "b", name: "Lordi" };

    it("is true when an earlier guest ID has the name, in any case", () => {
        expect(nameClash([{ guestId: "a", name: " lordi " }], me)).toBe(true);
    });

    it("is false when the other guest's ID sorts after, so exactly one gives up", () => {
        expect(nameClash([{ guestId: "c", name: "Lordi" }], me)).toBe(false);
        expect(nameClash([{ guestId: "b", name: "Lordi" }, { guestId: "a", name: "Netta" }], me)).toBe(false);
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

describe("withDistinctNames", () => {
    it("keeps the order and everything else of the ballots", () => {
        const ballots = [{ guestId: "b", name: "Lordi", n: 1 }, { guestId: "a", name: "Lordi", n: 2 }];
        expect(withDistinctNames(ballots)).toEqual([
            { guestId: "b", name: "Lordi 2", n: 1 },
            { guestId: "a", name: "Lordi", n: 2 },
        ]);
    });
});
