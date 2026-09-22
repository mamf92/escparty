import { describe, expect, it } from "vitest";
import {
    BASE_QUESTION_POINTS,
    MAX_TIME_BONUS,
    QUESTION_TIME_LIMIT_MS,
    calculateQuestionScore,
    calculateTimeBonus,
} from "./quizScoring";

// The scoring rule, pinned: 500 for a correct answer plus up to 500 more for
// speed, linear in the time left, rounded down. These are the numbers players
// see on screen, so they're asserted literally rather than recomputed from the
// same formula the implementation uses.
describe("calculateTimeBonus", () => {
    it("awards the full bonus for an instant answer", () => {
        expect(calculateTimeBonus(QUESTION_TIME_LIMIT_MS)).toBe(500);
    });

    it("awards nothing with the clock at zero", () => {
        expect(calculateTimeBonus(0)).toBe(0);
    });

    it("scales linearly with the time left", () => {
        expect(calculateTimeBonus(5000)).toBe(250);
        expect(calculateTimeBonus(2500)).toBe(125);
        expect(calculateTimeBonus(9000)).toBe(450);
    });

    it("rounds a fractional bonus down, never up", () => {
        // 1ms left is 1/10000 of 500 = 0.05 points, which is not a point.
        expect(calculateTimeBonus(1)).toBe(0);
        // 4999ms is 249.95 -> 249, not 250.
        expect(calculateTimeBonus(4999)).toBe(249);
    });

    it("clamps a negative clock to no bonus rather than a penalty", () => {
        // A timer tick can land after the deadline; that must not subtract
        // from the base score.
        expect(calculateTimeBonus(-1)).toBe(0);
        expect(calculateTimeBonus(-5000)).toBe(0);
    });

    it("clamps a clock above the question limit to the maximum bonus", () => {
        // `timeLeft` is reused for the longer feedback countdown in Quiz.tsx,
        // so a stale value can exceed the question's own limit.
        expect(calculateTimeBonus(QUESTION_TIME_LIMIT_MS + 1)).toBe(MAX_TIME_BONUS);
        expect(calculateTimeBonus(60000)).toBe(MAX_TIME_BONUS);
    });
});

describe("calculateQuestionScore", () => {
    it("pays the base points even for the slowest correct answer", () => {
        expect(calculateQuestionScore(0)).toBe(BASE_QUESTION_POINTS);
        expect(calculateQuestionScore(0)).toBe(500);
    });

    it("pays base plus full bonus for an instant correct answer", () => {
        expect(calculateQuestionScore(QUESTION_TIME_LIMIT_MS)).toBe(1000);
    });

    it("never exceeds base plus the maximum bonus", () => {
        expect(calculateQuestionScore(Number.MAX_SAFE_INTEGER)).toBe(
            BASE_QUESTION_POINTS + MAX_TIME_BONUS,
        );
    });

    it("never drops below the base, however stale the clock", () => {
        expect(calculateQuestionScore(-99999)).toBe(BASE_QUESTION_POINTS);
    });

    it("is monotonic: answering sooner is never worth less", () => {
        for (let ms = 0; ms <= QUESTION_TIME_LIMIT_MS; ms += 137) {
            expect(calculateQuestionScore(ms + 137)).toBeGreaterThanOrEqual(
                calculateQuestionScore(ms),
            );
        }
    });
});
