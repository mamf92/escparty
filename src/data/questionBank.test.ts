import { describe, expect, it } from "vitest";
import { BANK_QUESTIONS, bankQuestion } from "./questionBank";
import { QUIZ_TEMPLATES } from "./quizTemplates";
import { CATEGORY_LABELS, questionProblems } from "../utils/quizModel";

describe("the question bank", () => {
    it("has only playable questions", () => {
        const broken = BANK_QUESTIONS
            .map(question => ({ id: question.id, problems: questionProblems(question) }))
            .filter(entry => entry.problems.length > 0);
        expect(broken).toEqual([]);
    });

    it("has unique ids and unique question texts", () => {
        const ids = BANK_QUESTIONS.map(question => question.id);
        expect(new Set(ids).size).toBe(ids.length);
        const texts = BANK_QUESTIONS.map(question => question.question.toLowerCase());
        expect(new Set(texts).size).toBe(texts.length);
    });

    it("covers every difficulty and category", () => {
        for (const difficulty of ["easy", "medium", "hard"]) {
            expect(BANK_QUESTIONS.filter(question => question.difficulty === difficulty).length).toBeGreaterThanOrEqual(30);
        }
        for (const category of Object.keys(CATEGORY_LABELS)) {
            expect(BANK_QUESTIONS.some(question => question.category === category)).toBe(true);
        }
    });

    it("doesn't always put the right answer in the same place", () => {
        const positions = new Set(BANK_QUESTIONS.map(question => question.options.indexOf(question.correctAnswer)));
        expect(positions.size).toBeGreaterThan(2);
    });

    it("finds a question by id", () => {
        expect(bankQuestion("classic-1")?.correctAnswer).toBe("Sweden and Ireland");
        expect(bankQuestion("nope")).toBeUndefined();
    });
});

describe("the premade quizzes", () => {
    it("only name questions that are in the bank, once each", () => {
        for (const template of QUIZ_TEMPLATES) {
            expect(template.questionIds.every(id => bankQuestion(id)), template.id).toBe(true);
            expect(new Set(template.questionIds).size, template.id).toBe(template.questionIds.length);
        }
    });

    it("have ids firestore.rules accepts and a sensible length", () => {
        for (const template of QUIZ_TEMPLATES) {
            expect(`t-${template.id}`).toMatch(/^t-[a-z0-9-]{1,40}$/);
            expect(template.questionIds.length).toBeGreaterThanOrEqual(8);
            expect(template.questionIds.length).toBeLessThanOrEqual(50);
        }
        expect(new Set(QUIZ_TEMPLATES.map(template => template.id)).size).toBe(QUIZ_TEMPLATES.length);
    });
});
