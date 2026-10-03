import { afterEach, describe, expect, it } from "vitest";
import { formatRunDate, readScoreHistory, toScoreEntry } from "./scoreHistory";

describe("toScoreEntry", () => {
    it("keeps a complete run as it is", () => {
        const run = { score: 7, total: 10, difficulty: "easy", date: "2026-05-16T00:00:00Z" };
        expect(toScoreEntry(run)).toEqual(run);
    });

    it("defaults the details a run is missing", () => {
        expect(toScoreEntry({ score: 12, date: "2026-05-16T00:00:00Z" })).toEqual({
            score: 12, total: undefined, difficulty: "", date: "2026-05-16T00:00:00Z",
        });
        expect(toScoreEntry({ score: 3, total: "ten", difficulty: 4, date: null })).toEqual({
            score: 3, total: undefined, difficulty: "", date: "",
        });
    });

    it("rejects anything without a numeric score", () => {
        for (const value of [null, 5, "run", [], { score: "lots" }, { score: NaN }, { total: 10 }]) {
            expect(toScoreEntry(value)).toBeNull();
        }
    });
});

describe("formatRunDate", () => {
    it("shows a stored date, or says it's unknown", () => {
        expect(formatRunDate("2026-05-16T12:00:00Z")).toBe(new Date("2026-05-16T12:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }));
        expect(formatRunDate("")).toBe("Unknown date");
        expect(formatRunDate("not a date")).toBe("Unknown date");
    });
});

describe("readScoreHistory", () => {
    afterEach(() => localStorage.clear());

    it("is empty with nothing stored", () => {
        expect(readScoreHistory()).toEqual([]);
    });

    it("is empty for unreadable or non-list storage", () => {
        localStorage.setItem("quizScores", "{not json");
        expect(readScoreHistory()).toEqual([]);
        localStorage.setItem("quizScores", JSON.stringify({ score: 5 }));
        expect(readScoreHistory()).toEqual([]);
    });

    it("skips broken entries and keeps the rest in stored order", () => {
        localStorage.setItem("quizScores", JSON.stringify([
            null, { score: 2, total: 5, difficulty: "hard", date: "d1" }, { score: "lots" }, { score: 9 },
        ]));
        expect(readScoreHistory().map(entry => entry.score)).toEqual([2, 9]);
    });
});
