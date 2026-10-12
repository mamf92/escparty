import { describe, expect, it } from "vitest";
import {
    PARTY_NAMES,
    displayNameOf,
    availablePartyNames,
    distinctNames,
    freePartyName,
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
    const rated = { a1: { c: 3 } };

    it("goes to a guest with ratings over one without, whatever the guest IDs", () => {
        const names = distinctNames([
            { id: "a", name: "Lordi" },
            { id: "z", name: "Lordi", ratings: rated },
        ]);
        expect(names.get("z")).toBe("Lordi");
        expect(names.get("a")).toBe("Lordi 2");
    });

    it("counts a ticked bonus as taking part", () => {
        const names = distinctNames([
            { id: "a", name: "Lordi", ratings: {}, bonuses: {} },
            { id: "z", name: "Lordi", ratings: {}, bonuses: { a1: ["wind"] } },
        ]);
        expect(names.get("z")).toBe("Lordi");
        expect(names.get("a")).toBe("Lordi 2");
    });

    it("falls back to guest ID order when both or neither have taken part", () => {
        const names = distinctNames([
            { id: "b", name: "Lordi", ratings: rated },
            { id: "a", name: "Lordi", ratings: rated },
        ]);
        expect(names.get("a")).toBe("Lordi");
        expect(names.get("b")).toBe("Lordi 2");
    });
});

describe("displayNameOf", () => {
    const ballots = [{ guestId: "a", name: "Lordi" }, { guestId: "b", name: "Lordi" }];

    it("is the numbered name the lists show", () => {
        expect(displayNameOf(ballots, "a", "Lordi")).toBe("Lordi");
        expect(displayNameOf(ballots, "b", "Lordi")).toBe("Lordi 2");
    });

    it("is the fallback while the ballots or the guest's ballot aren't there", () => {
        expect(displayNameOf(undefined, "b", "Lordi")).toBe("Lordi");
        expect(displayNameOf(ballots, "c", "Netta")).toBe("Netta");
    });
});
