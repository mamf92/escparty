import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    QUIZ_CHOICES,
    fetchQuizTitle,
    isKnownQuizKey,
    loadQuiz,
    loadQuizForEditing,
    quizBreakEvery,
    quizTitle,
    templateKey,
} from "./quizCatalog";
import { QUIZ_TEMPLATES } from "../data/quizTemplates";
import { bankQuestion } from "../data/questionBank";

const mocks = vi.hoisted(() => ({ loadQuizData: vi.fn(), fetchCustomQuiz: vi.fn() }));
vi.mock("./QuizDataProvider", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./QuizDataProvider")>()),
    loadQuizData: mocks.loadQuizData,
}));
vi.mock("./customQuizzes", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./customQuizzes")>()),
    fetchCustomQuiz: mocks.fetchCustomQuiz,
}));

const CUSTOM = "c-AbCdEfGhIjKlMnOpQrSt";
const saved = {
    id: "AbCdEfGhIjKlMnOpQrSt",
    title: "Jedward's Revenge",
    breakEvery: 3,
    questions: [{ id: "q1", question: " Who? ", options: ["A", "B"], correctAnswer: "A", source: "custom" }],
};

beforeEach(() => {
    localStorage.clear();
    mocks.loadQuizData.mockResolvedValue([{ id: 1, question: "Q", options: ["a", "b"], correctAnswer: "a" }]);
    mocks.fetchCustomQuiz.mockResolvedValue(saved);
});

describe("isKnownQuizKey", () => {
    it("knows the classic difficulties and every template", () => {
        expect(isKnownQuizKey("easy")).toBe(true);
        expect(isKnownQuizKey("hard")).toBe(true);
        for (const template of QUIZ_TEMPLATES) expect(isKnownQuizKey(templateKey(template))).toBe(true);
    });

    it("knows the shape of a saved quiz's key", () => {
        expect(isKnownQuizKey(CUSTOM)).toBe(true);
        expect(isKnownQuizKey("c-short")).toBe(false);
    });

    it("rejects anything else", () => {
        for (const key of [undefined, null, "", "impossible", "t-", "t-no-such-quiz", "nordic-nights"]) {
            expect(isKnownQuizKey(key)).toBe(false);
        }
    });
});

describe("quizTitle", () => {
    it("names classic sets and templates", () => {
        expect(quizTitle("medium")).toBe("Classic: Medium");
        expect(quizTitle("t-nordic-nights")).toBe("Nordic Nights");
        expect(quizTitle(undefined)).toBe("Not chosen");
        expect(quizTitle("t-gone")).toBe("Unknown quiz");
    });

    it("names a saved quiz only if this device saved it", () => {
        expect(quizTitle(CUSTOM)).toBe("Custom quiz");
        localStorage.setItem("escparty.myQuizzes", JSON.stringify([{ id: saved.id, title: "Mine", questionCount: 1, savedAt: 1 }]));
        expect(quizTitle(CUSTOM)).toBe("Mine");
    });
});

describe("fetchQuizTitle", () => {
    it("reads a saved quiz's title, and falls back when it can't", async () => {
        await expect(fetchQuizTitle(CUSTOM)).resolves.toBe("Jedward's Revenge");
        mocks.fetchCustomQuiz.mockResolvedValueOnce(null);
        await expect(fetchQuizTitle(CUSTOM)).resolves.toBe("Custom quiz");
        mocks.fetchCustomQuiz.mockRejectedValueOnce(new Error("offline"));
        await expect(fetchQuizTitle(CUSTOM)).resolves.toBe("Custom quiz");
        await expect(fetchQuizTitle("t-nordic-nights")).resolves.toBe("Nordic Nights");
    });
});

describe("quizBreakEvery", () => {
    it("is the quiz's own setting, or the default", async () => {
        await expect(quizBreakEvery(CUSTOM)).resolves.toBe(3);
        mocks.fetchCustomQuiz.mockRejectedValueOnce(new Error("offline"));
        await expect(quizBreakEvery(CUSTOM)).resolves.toBe(5);
        await expect(quizBreakEvery("t-quick-fire")).resolves.toBe(0);
        await expect(quizBreakEvery("easy")).resolves.toBe(5);
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

    it("loads a saved quiz with its break setting", async () => {
        const loaded = await loadQuiz(CUSTOM);
        expect(loaded).toEqual({
            questions: [{ id: "q1", question: "Who?", options: ["A", "B"], correctAnswer: "A" }],
            breakEvery: 3,
            classic: false,
        });
    });

    it("rejects a saved quiz that's gone or has nothing playable", async () => {
        mocks.fetchCustomQuiz.mockResolvedValueOnce(null);
        await expect(loadQuiz(CUSTOM)).rejects.toThrow("This quiz isn't saved any more.");
        mocks.fetchCustomQuiz.mockResolvedValueOnce({ ...saved, questions: [] });
        await expect(loadQuiz(CUSTOM)).rejects.toThrow("This quiz isn't saved any more.");
    });

    it("rejects an unknown key", async () => {
        await expect(loadQuiz("t-no-such-quiz")).rejects.toThrow("Unknown quiz: t-no-such-quiz");
    });
});

describe("loadQuizForEditing", () => {
    it("starts from a template with its bank metadata", async () => {
        const start = await loadQuizForEditing("t-nul-points");
        expect(start.title).toBe("Nul Points");
        expect(start.breakEvery).toBe(4);
        expect(start.questions[0]).toMatchObject({ source: "bank", category: expect.any(String) });
        expect(start.questions.map(question => question.id)).toEqual(QUIZ_TEMPLATES.find(t => t.id === "nul-points")!.questionIds);
    });

    it("starts from a classic set's bank questions", async () => {
        const start = await loadQuizForEditing("hard");
        expect(start.title).toBe("Classic: Hard");
        expect(start.questions.length).toBeGreaterThan(0);
        expect(start.questions.every(question => question.source === "bank" && question.difficulty === "hard" && String(question.id).startsWith("classic-"))).toBe(true);
    });

    it("edits a saved quiz, and rejects one that's gone or an unknown key", async () => {
        await expect(loadQuizForEditing(CUSTOM)).resolves.toBe(saved);
        mocks.fetchCustomQuiz.mockResolvedValueOnce(null);
        await expect(loadQuizForEditing(CUSTOM)).rejects.toThrow("This quiz isn't saved any more.");
        await expect(loadQuizForEditing("t-gone")).rejects.toThrow("Unknown quiz: t-gone");
    });
});

describe("QUIZ_CHOICES", () => {
    it("lists the classics first, then every template once", () => {
        expect(QUIZ_CHOICES.slice(0, 3).map(choice => choice.key)).toEqual(["easy", "medium", "hard"]);
        expect(QUIZ_CHOICES.slice(3).map(choice => choice.key)).toEqual(QUIZ_TEMPLATES.map(templateKey));
    });
});
