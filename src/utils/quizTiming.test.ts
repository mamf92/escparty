import { describe, expect, it } from "vitest";
import {
    FEEDBACK_MS,
    QUESTION_MS,
    QUESTION_SLOT_MS,
    hasLeftBreak,
    phaseAfterQuestion,
    questionClock,
    startedAtMillis,
} from "./quizTiming";

describe("phaseAfterQuestion", () => {
    it("moves to the next question inside a block of five", () => {
        expect(phaseAfterQuestion(0, 15)).toEqual({ phase: "question", currentQuestionIndex: 1 });
        expect(phaseAfterQuestion(3, 15)).toEqual({ phase: "question", currentQuestionIndex: 4 });
        expect(phaseAfterQuestion(5, 15)).toEqual({ phase: "question", currentQuestionIndex: 6 });
    });

    it("breaks for the mid-quiz scoreboard after every fifth question, pointing at the next one", () => {
        // Question 5 is index 4; the break leads into index 5, so no question is skipped.
        expect(phaseAfterQuestion(4, 15)).toEqual({ phase: "mid-scoreboard", currentQuestionIndex: 5 });
        expect(phaseAfterQuestion(9, 15)).toEqual({ phase: "mid-scoreboard", currentQuestionIndex: 10 });
    });

    it("goes to results after the last question, even on a multiple of five", () => {
        expect(phaseAfterQuestion(14, 15)).toEqual({ phase: "results", currentQuestionIndex: 14 });
        expect(phaseAfterQuestion(9, 10)).toEqual({ phase: "results", currentQuestionIndex: 9 });
    });

    it("treats an index past the end as finished", () => {
        expect(phaseAfterQuestion(20, 15)).toEqual({ phase: "results", currentQuestionIndex: 20 });
    });
});

describe("questionClock", () => {
    const start = 1_000_000;

    it("is fully open at the start", () => {
        expect(questionClock(start, start)).toEqual({
            elapsedMs: 0,
            timeLeftMs: QUESTION_MS,
            answeringOpen: true,
            slotOver: false,
        });
    });

    it("clamps a start in the future (a fast server clock) to zero elapsed", () => {
        expect(questionClock(start + 2_000, start).elapsedMs).toBe(0);
    });

    it("closes answering at QUESTION_MS but keeps the slot open for feedback", () => {
        const clock = questionClock(start, start + QUESTION_MS);
        expect(clock.timeLeftMs).toBe(0);
        expect(clock.answeringOpen).toBe(false);
        expect(clock.slotOver).toBe(false);
    });

    it("ends the slot after answering plus feedback", () => {
        expect(QUESTION_SLOT_MS).toBe(QUESTION_MS + FEEDBACK_MS);
        expect(questionClock(start, start + QUESTION_SLOT_MS - 1).slotOver).toBe(false);
        expect(questionClock(start, start + QUESTION_SLOT_MS).slotOver).toBe(true);
    });

    it("catches a returning client straight up to the right point", () => {
        // A tab backgrounded for a minute doesn't replay its own stale timer.
        const clock = questionClock(start, start + 60_000);
        expect(clock.answeringOpen).toBe(false);
        expect(clock.slotOver).toBe(true);
    });
});

describe("startedAtMillis", () => {
    it("reads a Firestore Timestamp", () => {
        expect(startedAtMillis({ toMillis: () => 1234 })).toBe(1234);
    });

    it("is null while the serverTimestamp() write is pending, or the field is absent", () => {
        expect(startedAtMillis(null)).toBeNull();
        expect(startedAtMillis(undefined)).toBeNull();
        expect(startedAtMillis({ _methodName: "serverTimestamp" })).toBeNull();
    });
});

describe("hasLeftBreak", () => {
    it("stays while the room is still in this break", () => {
        expect(hasLeftBreak("mid-scoreboard", 5, 5)).toBe(false);
    });

    it("leaves once the room is back on a question", () => {
        expect(hasLeftBreak("question", 5, 5)).toBe(true);
        expect(hasLeftBreak("question", 7, 5)).toBe(true);
    });

    it("leaves if the room already reached a later break or the results (a late snapshot)", () => {
        expect(hasLeftBreak("mid-scoreboard", 10, 5)).toBe(true);
        expect(hasLeftBreak("results", 9, 5)).toBe(true);
    });

    it("stays for a room with no phase, or one still in the lobby", () => {
        expect(hasLeftBreak(undefined, 0, 5)).toBe(false);
        expect(hasLeftBreak("lobby", 0, 5)).toBe(false);
    });
});
