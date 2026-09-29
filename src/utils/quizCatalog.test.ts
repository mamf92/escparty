import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUIZ_CHOICES, isKnownQuizKey, loadQuiz, quizTitle, templateKey } from "./quizCatalog";
import { QUIZ_TEMPLATES } from "../data/quizTemplates";
import { bankQuestion } from "../data/questionBank";

const mocks = vi.hoisted(() => ({ loadQuizData: vi.fn() }));
vi.mock("./QuizDataProvider", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./QuizDataProvider")>()),
    loadQuizData: mocks.loadQuizData,
}));

beforeEach(() => {
    mocks.loadQuizData.mockResolvedValue([{ id: 1, question: "Q", options: ["a", "b"], correctAnswer: "a" }]);
});

describe("isKnownQuizKey", () => {
    it("knows the classic difficulties and every template", () => {
        expect(isKnownQuizKey("easy")).toBe(true);
        expect(isKnownQuizKey("hard")).toBe(true);
        for (const template of QUIZ_TEMPLATES) expect(isKnownQuizKey(templateKey(template))).toBe(true);
    });

    it("rejects anything else", () => {
        for (const key of [undefined, null, "", "impossible", "t-", "t-no-such-quiz", "nordic-nights"]) {
            expect(isKnownQuizKey(key)).toBe(false);
        }
    });
});

describe("quizTitle", () => {
    it("names classic sets and templates", () => {
        expect(quizTitle("medium")).toBe("Medium");
        expect(quizTitle("t-nordic-nights")).toBe("Nordic Nights");
        expect(quizTitle(undefined)).toBe("Not chosen");
        expect(quizTitle("t-gone")).toBe("Unknown quiz");
    });
});

describe("loadQuiz", () => {
    it("loads a classic set through QuizDataProvider, with the default break", async () => {
        const loaded = await loadQuiz("easy");
        expect(mocks.loadQuizData).toHaveBeenCalledWith("easy");
        expect(loaded).toMatchObject({ breakEvery: 5, classic: true });
        expect(loaded.questions).toHaveLength(1);
    });

    it("builds a template from the bank, in order, with its own break setting", async () => {
        const template = QUIZ_TEMPLATES.find(entry => entry.breakEvery === 0)!;
        const loaded = await loadQuiz(templateKey(template));
        expect(loaded.classic).toBe(false);
        expect(loaded.breakEvery).toBe(0);
        expect(loaded.questions.map(question => question.id)).toEqual(template.questionIds);
        // Only what players need goes out: no source/difficulty/category.
        expect(Object.keys(loaded.questions[0]).sort()).toEqual(["correctAnswer", "id", "options", "question"]);
        expect(loaded.questions[0].correctAnswer).toBe(bankQuestion(template.questionIds[0])!.correctAnswer);
    });

    it("rejects an unknown key", async () => {
        await expect(loadQuiz("t-no-such-quiz")).rejects.toThrow("Unknown quiz: t-no-such-quiz");
    });
});

describe("QUIZ_CHOICES", () => {
    it("lists the classics first, then every template once", () => {
        expect(QUIZ_CHOICES.slice(0, 3).map(choice => choice.key)).toEqual(["easy", "medium", "hard"]);
        expect(QUIZ_CHOICES.slice(3).map(choice => choice.key)).toEqual(QUIZ_TEMPLATES.map(templateKey));
    });
});
