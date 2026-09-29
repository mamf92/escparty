import { describe, expect, it } from "vitest";
import {
    AWARD_NAMES,
    PARTY_BONUSES,
    RATING_TEMPLATES,
    actScore,
    ballotScores,
    categoryProblems,
    isValidRating,
    partyAwards,
    pearson,
    pointsForDistance,
    predictFinal,
    predictSemi,
    predictionLeaderboard,
    rankPositions,
    roomStandings,
    type Ballot,
    type RatingCategory,
} from "./partyModel";

const douze: RatingCategory[] = [{ id: "points", label: "Points", max: 12 }];
const two: RatingCategory[] = [
    { id: "a", label: "A", max: 10 },
    { id: "b", label: "B", max: 5 },
];
const acts = ["se", "no", "fi", "dk", "is"];

/** A douze-points ballot from a list of points in running order (null: unrated). */
const ballot = (guestId: string, points: (number | null)[], bonuses: Record<string, string[]> = {}): Ballot => ({
    guestId,
    name: guestId.toUpperCase(),
    ratings: Object.fromEntries(
        points.flatMap((value, i) => (value === null ? [] : [[acts[i], { points: value }]])),
    ),
    bonuses,
});

describe("templates", () => {
    it("ship the jury, sofa and douze points sheets, each valid", () => {
        expect(RATING_TEMPLATES.map(template => template.id)).toEqual(["jury", "sofa", "douze"]);
        for (const template of RATING_TEMPLATES) expect(categoryProblems(template.categories)).toEqual([]);
        expect(RATING_TEMPLATES[0].categories.map(category => category.label)).toEqual([
            "Vocals", "Performance", "Composition", "Originality", "Overall impression",
        ]);
    });

    it("check custom categories", () => {
        expect(categoryProblems([])).toEqual(["Add at least one category."]);
        expect(categoryProblems([
            { id: "1", label: " ", max: 10 },
            { id: "2", label: "Hair", max: 7 as 10 },
            { id: "3", label: "hair", max: 5 },
            { id: "4", label: "x".repeat(31), max: 5 },
            { id: "5", label: "E", max: 5 },
            { id: "6", label: "F", max: 5 },
            { id: "7", label: "G", max: 5 },
        ])).toEqual([
            "Use at most 6 categories.",
            "Name every category.",
            "Keep category names under 30 characters.",
            "Two categories have the same name.",
            "Pick a scale for every category.",
        ]);
    });

    it("know a valid rating", () => {
        expect(isValidRating(5, two[1])).toBe(true);
        expect(isValidRating(6, two[1])).toBe(false);
        expect(isValidRating(0, two[1])).toBe(false);
        expect(isValidRating(2.5, two[1])).toBe(false);
        expect(isValidRating("5", two[1])).toBe(false);
    });
});

describe("actScore", () => {
    it("averages categories scaled to 0-10, skipping blanks, plus bonuses", () => {
        expect(actScore({ a: 8, b: 5 }, undefined, two)).toBe(9);
        expect(actScore({ a: 8 }, undefined, two)).toBe(8);
        expect(actScore({ a: 8, b: 99 }, undefined, two)).toBe(8);
        expect(actScore({ a: 8 }, ["wind", "language", "nope"], two, PARTY_BONUSES)).toBe(11);
        expect(actScore({}, ["wind"], two, PARTY_BONUSES)).toBeNull();
        expect(actScore(undefined, undefined, two)).toBeNull();
    });

    it("lists a ballot's scored acts", () => {
        const scores = ballotScores(ballot("a", [12, null, 6]), acts, douze);
        expect([...scores.entries()]).toEqual([["se", 10], ["fi", 5]]);
    });
});

describe("rankPositions", () => {
    it("ranks highest first, ties sharing the average place", () => {
        const ranks = rankPositions(new Map([["a", 5], ["b", 9], ["c", 5], ["d", 1]]));
        expect(Object.fromEntries(ranks)).toEqual({ b: 1, a: 2.5, c: 2.5, d: 4 });
    });
});

describe("prediction closeness", () => {
    it("scores 12, 8, 5, 3, 1 then 0 by places off", () => {
        expect([0, 1, 2, 3, 4, 5, 9].map(pointsForDistance)).toEqual([12, 8, 5, 3, 1, 0, 0]);
        expect(pointsForDistance(0.5)).toBe(8);
        expect(pointsForDistance(1.4)).toBe(8);
    });

    const real = { se: 1, no: 2, fi: 3, dk: 4, is: 5 };

    it("gives a perfect ranking 12 per act", () => {
        const scores = ballotScores(ballot("a", [12, 10, 8, 6, 4]), acts, douze);
        expect(predictFinal(scores, real)).toEqual({ points: 60, distance: 0, compared: 5 });
    });

    it("ranks the winner first above ranking it last", () => {
        const first = predictFinal(ballotScores(ballot("a", [12, 1, 2, 3, 4]), acts, douze), real);
        const last = predictFinal(ballotScores(ballot("b", [1, 12, 10, 8, 6]), acts, douze), real);
        expect(first.points).toBeGreaterThan(last.points);
    });

    it("compares only acts with a real place, like with like", () => {
        // Only the top two are in so far; the guest had them 1st and 2nd of the two.
        const scores = ballotScores(ballot("a", [3, 7, 12, 1, 1]), acts, douze);
        expect(predictFinal(scores, { se: 2, no: 1 })).toEqual({ points: 24, distance: 0, compared: 2 });
    });

    it("ranks a guest who skipped acts only against the acts they rated", () => {
        // Rated only Norway and Finland, in the real order: both exact.
        const scores = ballotScores(ballot("a", [null, 10, 8, null, null]), acts, douze);
        expect(predictFinal(scores, real)).toEqual({ points: 24, distance: 0, compared: 2 });
    });

    it("scores nothing for a placed act the guest never rated", () => {
        const scores = ballotScores(ballot("a", [12, null, null, null, null]), acts, douze);
        expect(predictFinal(scores, real)).toEqual({ points: 12, distance: 0, compared: 1 });
    });

    it("calls a semi-final by the guest's top picks", () => {
        const scores = ballotScores(ballot("a", [12, 10, 1, 8, 2]), acts, douze);
        expect(predictSemi(scores, ["se", "fi", "dk"])).toEqual({ points: 24, distance: 1, compared: 5, hits: 2 });
    });

    it("orders the leaderboard by points, then places off, then name", () => {
        const guests = [{ guestId: "c", name: "Cee" }, { guestId: "b", name: "Bee" }, { guestId: "a", name: "Ay" }, { guestId: "x", name: "No ballot" }];
        const predictions = new Map([
            ["a", { points: 20, distance: 4, compared: 5 }],
            ["b", { points: 20, distance: 2, compared: 5 }],
            ["c", { points: 20, distance: 2, compared: 5 }],
        ]);
        expect(predictionLeaderboard(guests, predictions).map(row => row.guestId)).toEqual(["b", "c", "a"]);
    });
});

describe("roomStandings", () => {
    it("averages each act over who rated it, best first, running order on ties", () => {
        const standings = roomStandings([ballot("a", [12, 6, null, 6]), ballot("b", [6, 6, 12, 6])], acts, douze);
        expect(standings).toEqual([
            { actId: "fi", average: 10, votes: 1 },
            { actId: "se", average: 7.5, votes: 2 },
            { actId: "no", average: 5, votes: 2 },
            { actId: "dk", average: 5, votes: 2 },
        ]);
    });
});

describe("pearson", () => {
    it("measures agreement, and is null without a spread", () => {
        expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
        expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
        expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
        expect(pearson([1], [1])).toBeNull();
        expect(pearson([1, 2], [1, 2, 3])).toBeNull();
    });
});

describe("partyAwards", () => {
    // Twins: ann and bob agree. Cat is their opposite. Dan loves everything, evenly.
    const ballots = [
        ballot("ann", [12, 9, 6, 3, 1], { se: ["wind", "keychange"] }),
        ballot("bob", [11, 8, 6, 4, 2]),
        ballot("cat", [1, 2, 5, 8, 11], { fi: ["language"] }),
        ballot("dan", [11, 11, 10, 11, 10]),
    ];
    const byId = (awards: ReturnType<typeof partyAwards>) => Object.fromEntries(awards.map(entry => [entry.id, entry.guestIds]));

    it("names the twins, the opposites and the solo awards", () => {
        const awards = byId(partyAwards(ballots, acts, douze, PARTY_BONUSES));
        expect(awards.twins).toEqual(["ann", "bob"]);
        expect(awards.opposites).toContain("cat");
        expect(awards.euphoria).toEqual(["dan"]);
        expect(awards["nul-points"]).toEqual(["cat"]);
        expect(awards["wind-machine"]).toEqual(["ann"]);
        expect(awards["lasha-tumbai"]).toEqual(["dan"]);
        expect(awards.babushki).toEqual(["ann"]);
        // The room's favourite is Sweden (avg 8.75); cat gave it 1.
        expect(awards.hatari).toEqual(["cat"]);
        expect(awards["johnny-logan"]).toBeUndefined();
    });

    it("tells each award's story in words", () => {
        const twins = partyAwards(ballots, acts, douze).find(entry => entry.id === "twins")!;
        expect(twins.title).toBe("The Jedward Twins");
        expect(twins.detail).toMatch(/rose and fell together over 5 acts \(correlation \d\.\d\d\)/);
        const opposites = partyAwards(ballots, acts, douze).find(entry => entry.id === "opposites")!;
        expect(opposites.detail).toMatch(/scored it down, over 5 acts \(correlation -/);
        for (const names of Object.values(AWARD_NAMES)) {
            expect(names.title && names.for && names.story).toBeTruthy();
        }
    });

    it("crowns the best predictor once there's a result", () => {
        const predictions = new Map(ballots.map(entry => [
            entry.guestId,
            predictFinal(ballotScores(entry, acts, douze), { se: 1, no: 2, fi: 3, dk: 4, is: 5 }),
        ]));
        expect(byId(partyAwards(ballots, acts, douze, [], predictions))["johnny-logan"]).toEqual(["ann"]);
    });

    it("leaves out what the data can't support", () => {
        expect(partyAwards([ballots[0]], acts, douze)).toEqual([]);
        // Two guests with only two acts each: nothing is meaningful.
        expect(partyAwards([ballot("a", [1, 2]), ballot("b", [2, 1])], acts, douze)).toEqual([]);
        // Identical flat ballots: no spread, no generous/tough split, no correlation.
        const flat = partyAwards([ballot("a", [5, 5, 5]), ballot("b", [5, 5, 5])], acts, douze);
        expect(flat.map(entry => entry.id)).toEqual([]);
        // No bonuses in play: no Babushki.
        expect(byId(partyAwards(ballots, acts, douze)).babushki).toBeUndefined();
        // A result nobody scored against: no Johnny Logan.
        expect(byId(partyAwards(ballots, acts, douze, [], new Map([["ann", { points: 0, distance: 9, compared: 5 }]])))["johnny-logan"]).toBeUndefined();
    });

    it("names no opposites when everyone broadly agrees", () => {
        const agreeing = [ballot("a", [12, 9, 6, 3, 1]), ballot("b", [11, 9, 5, 4, 1]), ballot("c", [10, 10, 4, 2, 3])];
        const ids = partyAwards(agreeing, acts, douze).map(entry => entry.id);
        expect(ids).toContain("twins");
        expect(ids).not.toContain("opposites");
    });

    it("doesn't name the same pair twins and opposites", () => {
        const awards = partyAwards([ballot("a", [1, 2, 3]), ballot("b", [1, 2, 4])], acts, douze);
        expect(awards.filter(entry => entry.id === "twins" || entry.id === "opposites").map(entry => entry.id)).toEqual(["twins"]);
    });
});
