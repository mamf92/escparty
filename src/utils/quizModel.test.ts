import { describe, expect, it } from "vitest";
import {
    BREAK_CHOICES,
    DEFAULT_BREAK_EVERY,
    badOptions,
    isBreakAfter,
    isPlayableQuestion,
    questionFieldProblems,
    questionProblems,
    quizFieldProblems,
    quizProblems,
    seededShuffle,
    toBreakEvery,
    toPlayable,
} from "./quizModel";

const good = { question: "Who won in 1974?", options: ["ABBA", "Lulu"], correctAnswer: "ABBA" };

describe("questionProblems", () => {
    it("accepts a question with two distinct answers and one marked correct", () => {
        expect(questionProblems(good)).toEqual([]);
        expect(isPlayableQuestion(good)).toBe(true);
    });

    it("needs the question text", () => {
        expect(questionProblems({ ...good, question: "   " })).toContain("Write the question.");
    });

    it("needs at least two answers and at most six", () => {
        expect(questionProblems({ ...good, options: ["ABBA"] })).toContain("Give at least 2 answers.");
        expect(questionProblems({ ...good, options: ["ABBA", "a", "b", "c", "d", "e", "f"] })).toContain("Give at most 6 answers.");
    });

    it("rejects an empty answer and duplicate answers, ignoring case and spaces", () => {
        expect(questionProblems({ ...good, options: ["ABBA", ""] })).toContain("Fill in every answer, or remove the empty one.");
        expect(questionProblems({ ...good, options: ["ABBA", " abba "] })).toContain("Two answers are the same.");
    });

    it("needs the correct answer to be one of the answers", () => {
        expect(questionProblems({ ...good, correctAnswer: "" })).toContain("Mark which answer is correct.");
        expect(questionProblems({ ...good, correctAnswer: "Bucks Fizz" })).toContain("Mark which answer is correct.");
    });

    it("limits lengths", () => {
        expect(questionProblems({ ...good, question: "x".repeat(201) })).toContain("Keep the question under 200 characters.");
        expect(questionProblems({ ...good, options: ["ABBA", "y".repeat(81)] })).toContain("Keep each answer under 80 characters.");
    });
});

describe("questionFieldProblems", () => {
    it("tags each problem with the field it's about", () => {
        const problems = questionFieldProblems({ question: "", options: ["ABBA", "abba", ""], correctAnswer: "Lulu" });
        expect(problems).toEqual([
            { field: "question", message: "Write the question." },
            { field: "answers", message: "Fill in every answer, or remove the empty one." },
            { field: "answers", message: "Two answers are the same." },
            { field: "correct", message: "Mark which answer is correct." },
        ]);
    });
});

describe("badOptions", () => {
    it("marks the empty, too long and repeated answers, and agrees with the problems", () => {
        const options = ["ABBA", " abba", "", "y".repeat(81), "Lulu"];
        expect(badOptions(options)).toEqual([true, true, true, true, false]);
        expect(badOptions(good.options)).toEqual([false, false]);
    });
});

describe("quizFieldProblems", () => {
    it("tags name, question and break problems", () => {
        expect(quizFieldProblems({ title: "", questions: [], breakEvery: 7 as never }).map(problem => problem.field))
            .toEqual(["name", "questions", "break"]);
    });
});

describe("quizProblems", () => {
    const quiz = { title: "Eurovision night", questions: [{ ...good, id: "c1", source: "custom" as const }], breakEvery: DEFAULT_BREAK_EVERY };

    it("accepts a named quiz with playable questions", () => {
        expect(quizProblems(quiz)).toEqual([]);
    });

    it("needs a name, a question, a valid break setting, and playable questions", () => {
        expect(quizProblems({ ...quiz, title: " " })).toContain("Give the quiz a name.");
        expect(quizProblems({ ...quiz, title: "t".repeat(61) })).toContain("Keep the name under 60 characters.");
        expect(quizProblems({ ...quiz, questions: [] })).toContain("Add at least one question.");
        expect(quizProblems({ ...quiz, breakEvery: 7 as never })).toContain("Pick when the scoreboard shows.");
        expect(quizProblems({ ...quiz, questions: [{ ...quiz.questions[0], options: ["x"] }] })).toContain("1 question needs fixing.");
        expect(quizProblems({ ...quiz, questions: [{ ...quiz.questions[0], options: ["x"] }, { ...quiz.questions[0], options: [] }] }))
            .toContain("2 questions need fixing.");
    });

    it("caps a quiz at 50 questions", () => {
        const many = Array.from({ length: 51 }, (_, i) => ({ ...quiz.questions[0], id: `c${i}` }));
        expect(quizProblems({ ...quiz, questions: many })).toContain("A quiz can have at most 50 questions.");
    });
});

describe("toPlayable", () => {
    it("trims and drops the source metadata", () => {
        expect(toPlayable({ id: "b1", question: " Q? ", options: [" A ", "B"], correctAnswer: " A ", disabled: false }))
            .toEqual({ id: "b1", question: "Q?", options: ["A", "B"], correctAnswer: "A" });
    });
});

describe("isBreakAfter", () => {
    it("breaks after every Nth question but never after the last", () => {
        expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(i => isBreakAfter(i, 10, 5))).toEqual([4]);
        expect([0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => isBreakAfter(i, 9, 3))).toEqual([2, 5]);
    });

    it("never breaks when the setting is 0", () => {
        expect([0, 1, 2, 3, 4, 5].some(i => isBreakAfter(i, 20, 0))).toBe(false);
    });
});

describe("toBreakEvery", () => {
    it("keeps an allowed value and falls back to the default otherwise", () => {
        for (const choice of BREAK_CHOICES) expect(toBreakEvery(choice)).toBe(choice);
        expect(toBreakEvery(7)).toBe(DEFAULT_BREAK_EVERY);
        expect(toBreakEvery("5")).toBe(DEFAULT_BREAK_EVERY);
    });
});

describe("seededShuffle", () => {
    it("is a permutation, the same for the same seed, and leaves the input alone", () => {
        const items = [1, 2, 3, 4, 5, 6, 7, 8];
        const a = seededShuffle(items, 42);
        expect([...a].sort()).toEqual(items);
        expect(seededShuffle(items, 42)).toEqual(a);
        expect(seededShuffle(items, 43)).not.toEqual(a);
        expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
});
