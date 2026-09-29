import { describe, expect, it } from "vitest";
import type { Party } from "./partyFirestore";
import type { Ballot } from "./partyModel";
import {
    actIdsOf,
    awardWinners,
    awardsFor,
    formatScore,
    hasResults,
    ordinal,
    partyBonusList,
    partyLink,
    resultsFor,
    predictionFor,
    predictionsFor,
} from "./partyResults";

const acts = ["se", "no", "fi", "dk"].map(id => ({ id, country: id.toUpperCase(), flag: "", artist: "A", song: "S" }));
const party = (change: Partial<Party> = {}): Party => ({
    code: "ABBA", hostId: "h", title: "Final", contestId: "c", kind: "final", qualifiers: 0, acts,
    template: { id: "douze", name: "Douze", blurb: "", categories: [{ id: "points", label: "Points", max: 12 }] },
    bonuses: false, showNames: true, results: {}, revealed: false, ...change,
});
const ballot = (guestId: string, points: number[]): Ballot => ({
    guestId, name: guestId, bonuses: {},
    ratings: Object.fromEntries(points.map((value, i) => [acts[i].id, { points: value }])),
});

describe("partyResults", () => {
    it("lists acts and bonuses", () => {
        expect(actIdsOf(party())).toEqual(["se", "no", "fi", "dk"]);
        expect(partyBonusList(party())).toEqual([]);
        expect(partyBonusList(party({ bonuses: true })).length).toBeGreaterThan(0);
    });

    it("knows when there's a result", () => {
        expect(hasResults(party())).toBe(false);
        expect(hasResults(party({ results: { places: { se: 1 } } }))).toBe(true);
        expect(hasResults(party({ kind: "semi" }))).toBe(false);
        expect(hasResults(party({ kind: "semi", results: { qualifiers: ["se"] } }))).toBe(true);
    });

    it("scores closeness for a final and a semi, none before a result", () => {
        const guest = ballot("a", [12, 10, 8, 6]);
        expect(predictionFor(party(), guest)).toBeNull();
        expect(predictionFor(party({ results: { places: { se: 1, no: 2 } } }), guest)).toEqual({ points: 24, distance: 0, compared: 2 });
        expect(predictionFor(party({ kind: "semi", qualifiers: 2, results: { qualifiers: ["se", "fi"] } }), guest))
            .toEqual({ points: 12, distance: 1, compared: 4, hits: 1 });
        const withResult = party({ results: { places: { se: 1 } } });
        expect([...predictionsFor(withResult, [guest, ballot("b", [])]).keys()]).toEqual(["a"]);
        expect(predictionsFor(party(), [guest]).size).toBe(0);
    });

    it("hands out awards", () => {
        const ids = awardsFor(party({ results: { places: { se: 1, no: 2, fi: 3, dk: 4 } } }), [
            ballot("a", [12, 10, 8, 6]), ballot("b", [11, 9, 7, 5]), ballot("c", [1, 3, 5, 12]),
        ]).map(award => award.id);
        expect(ids).toContain("twins");
        expect(ids).toContain("johnny-logan");
    });

    it("writes places and scores", () => {
        expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
            "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th",
        ]);
        expect(formatScore(7)).toBe("7");
        expect(formatScore(7.25)).toBe("7.3");
    });

    it("names winners, or keeps them anonymous", () => {
        const names = new Map([["a", "Jedward"], ["b", "Lordi"]]);
        expect(awardWinners(["a", "b"], names, true, "a")).toEqual({ who: "Jedward & Lordi", mine: true });
        expect(awardWinners(["x"], names, true, undefined)).toEqual({ who: "A guest", mine: false });
        expect(awardWinners(["a"], names, false, "a")).toEqual({ who: "You", mine: true });
        expect(awardWinners(["a"], names, false, "b")).toEqual({ who: "One of you", mine: false });
        expect(awardWinners(["a", "b"], names, false, "b")).toEqual({ who: "You and one other guest", mine: true });
        expect(awardWinners(["a", "b"], names, false, undefined)).toEqual({ who: "Two of you", mine: false });
    });

    it("links to the party", () => {
        expect(partyLink("ABBA")).toBe(`${window.location.origin}${window.location.pathname}#/party/ABBA`);
    });

    it("trims a result to the acts in the show, renumbering places", () => {
        expect(resultsFor(acts, { places: { xx: 1, fi: 3, se: 2 }, qualifiers: ["xx", "no"] }))
            .toEqual({ places: { se: 1, fi: 2 }, qualifiers: ["no"] });
        expect(resultsFor(acts, {})).toEqual({});
        // A removed act doesn't count against a guest.
        const guest = ballot("a", [12, 10]);
        expect(predictionFor(party({ results: { places: { xx: 1, se: 2, no: 3 } } }), guest)).toEqual({ points: 24, distance: 0, compared: 2 });
    });
});
