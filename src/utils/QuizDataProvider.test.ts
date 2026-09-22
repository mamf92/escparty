import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizQuestion } from "./QuizDataProvider";
import { filterEnabledQuestions, loadQuizData } from "./QuizDataProvider";

// `loadQuizData` has three tiers and two orderings: in development it tries a
// bundled `import()` first and falls back to fetching from /quizdata, in
// production it does the reverse, and either way a hardcoded array is the last
// resort. Which tier answered is invisible to callers, so each tier here
// returns a recognisably different question id.
//
// The lever for "the bundled import is unusable" is the `hard` bank: its mock
// resolves to a non-array, which is exactly the shape check the real loader
// rejects. That avoids re-mocking modules mid-file.

const IMPORTED_EASY: QuizQuestion[] = [
    { id: 101, question: "Imported easy Q", options: ["a", "b"], correctAnswer: "a" },
    { id: 102, question: "Imported easy Q2", options: ["a", "b"], correctAnswer: "b" },
];
const IMPORTED_MEDIUM: QuizQuestion[] = [
    { id: 201, question: "Imported medium Q", options: ["a", "b"], correctAnswer: "a" },
];
const FETCHED: QuizQuestion[] = [
    { id: 301, question: "Fetched Q", options: ["a", "b"], correctAnswer: "b" },
];

const mocks = vi.hoisted(() => ({
    isDevelopmentEnvironment: vi.fn(),
    getAssetPath: vi.fn(),
}));

vi.mock("./pathUtils", () => ({
    isDevelopmentEnvironment: mocks.isDevelopmentEnvironment,
    isProductionPreview: vi.fn(() => false),
    getBasePath: vi.fn(() => "/"),
    getAssetPath: mocks.getAssetPath,
}));

vi.mock("../data/escBeginnerQuiz.json", () => ({ default: IMPORTED_EASY }));
vi.mock("../data/escIntermediateQuiz.json", () => ({ default: IMPORTED_MEDIUM }));
// Deliberately the wrong shape: this is the "bundled import is unusable" lever.
vi.mock("../data/escAdvancedQuiz.json", () => ({ default: { notAnArray: true } }));

const okResponse = (body: unknown) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
});

const notFoundResponse = () => ({
    ok: false,
    status: 404,
    statusText: "Not Found",
    json: async () => ({}),
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => { });
    vi.spyOn(console, "warn").mockImplementation(() => { });
    vi.spyOn(console, "error").mockImplementation(() => { });

    mocks.getAssetPath.mockImplementation((path: string) => `/escparty/${path}`);
    mocks.isDevelopmentEnvironment.mockReturnValue(false);

    fetchMock = vi.fn().mockResolvedValue(okResponse(FETCHED));
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    // `restoreMocks` doesn't cover stubbed globals, and a leaked `fetch` would
    // follow this file's worker into the next one.
    vi.unstubAllGlobals();
});

describe("loadQuizData in development", () => {
    beforeEach(() => {
        mocks.isDevelopmentEnvironment.mockReturnValue(true);
    });

    it("serves the bundled import and never hits the network", async () => {
        await expect(loadQuizData("easy")).resolves.toEqual(IMPORTED_EASY);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("falls back to fetching /quizdata when the bundled import is unusable", async () => {
        await expect(loadQuizData("hard")).resolves.toEqual(FETCHED);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(mocks.getAssetPath).toHaveBeenCalledWith("quizdata/escAdvancedQuiz.json");
        expect(fetchMock.mock.calls[0][0]).toBe("/escparty/quizdata/escAdvancedQuiz.json");
    });

    it("falls back to the hardcoded bank when both the import and the fetch fail", async () => {
        fetchMock.mockRejectedValue(new Error("offline"));

        const questions = await loadQuizData("hard");

        // The hardcoded hard bank, not the imported or fetched ones.
        expect(questions.map((question) => question.id)).toEqual([21, 22]);
        expect(questions[0].question).toMatch(/Dana International/);
    });
});

describe("loadQuizData in production", () => {
    beforeEach(() => {
        mocks.isDevelopmentEnvironment.mockReturnValue(false);
    });

    it("fetches /quizdata first, in preference to the bundled import", async () => {
        const questions = await loadQuizData("easy");

        expect(questions).toEqual(FETCHED);
        expect(questions).not.toEqual(IMPORTED_EASY);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("asks for a fresh copy rather than a cached one", async () => {
        await loadQuizData("easy");

        const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
        expect(init.headers).toEqual({ "Cache-Control": "no-cache" });
    });

    it("falls back to the bundled import when the fetch rejects", async () => {
        fetchMock.mockRejectedValue(new Error("DNS failure"));

        await expect(loadQuizData("easy")).resolves.toEqual(IMPORTED_EASY);
    });

    it("treats a 404 as a failed fetch, not as empty data", async () => {
        fetchMock.mockResolvedValue(notFoundResponse());

        await expect(loadQuizData("medium")).resolves.toEqual(IMPORTED_MEDIUM);
    });

    it("treats a non-array payload as a failed fetch", async () => {
        // A misconfigured host that answers 200 with an HTML error page would
        // otherwise poison the quiz with a non-array.
        fetchMock.mockResolvedValue(okResponse({ message: "not a quiz" }));

        await expect(loadQuizData("medium")).resolves.toEqual(IMPORTED_MEDIUM);
    });

    it("falls back to the hardcoded bank when the fetch fails and the import is unusable", async () => {
        fetchMock.mockRejectedValue(new Error("offline"));

        const questions = await loadQuizData("hard");

        expect(questions.map((question) => question.id)).toEqual([21, 22]);
    });
});

describe("loadQuizData difficulty handling", () => {
    it("maps each difficulty to its own data file", async () => {
        await loadQuizData("easy");
        await loadQuizData("medium");
        await loadQuizData("hard");

        expect(mocks.getAssetPath.mock.calls.map((call) => call[0])).toEqual([
            "quizdata/escBeginnerQuiz.json",
            "quizdata/escIntermediateQuiz.json",
            "quizdata/escAdvancedQuiz.json",
        ]);
    });

    it("defaults to easy when called with no difficulty", async () => {
        await loadQuizData();

        expect(mocks.getAssetPath).toHaveBeenCalledWith("quizdata/escBeginnerQuiz.json");
    });

    it("normalises an unrecognised difficulty to easy rather than failing", async () => {
        // Difficulty arrives from a route param, so it can be anything.
        await loadQuizData("impossible" as Parameters<typeof loadQuizData>[0]);

        expect(mocks.getAssetPath).toHaveBeenCalledWith("quizdata/escBeginnerQuiz.json");
    });

    it("serves the easy bank's questions for an unrecognised difficulty", async () => {
        // Normalisation has to reach the data, not just the file name the
        // fetch tier asks for.
        mocks.isDevelopmentEnvironment.mockReturnValue(true);

        const questions = await loadQuizData("nonsense" as Parameters<typeof loadQuizData>[0]);

        expect(questions).toEqual(IMPORTED_EASY);
    });
});

describe("filterEnabledQuestions", () => {
    const enabled: QuizQuestion = {
        id: 1,
        question: "Enabled",
        options: ["a", "b"],
        correctAnswer: "a",
    };
    const explicitlyEnabled: QuizQuestion = { ...enabled, id: 2, disabled: false };
    const retired: QuizQuestion = { ...enabled, id: 3, disabled: true };

    it("drops questions flagged disabled", () => {
        expect(filterEnabledQuestions([enabled, retired])).toEqual([enabled]);
    });

    it("keeps questions with the flag absent or false", () => {
        expect(filterEnabledQuestions([enabled, explicitlyEnabled])).toEqual([
            enabled,
            explicitlyEnabled,
        ]);
    });

    it("can filter everything out", () => {
        expect(filterEnabledQuestions([retired])).toEqual([]);
    });

    it("leaves the input array alone", () => {
        const input = [enabled, retired];

        filterEnabledQuestions(input);

        expect(input).toHaveLength(2);
    });

    it("is the step that filters — loading deliberately isn't", async () => {
        // If loading ever starts filtering too, a quiz editor silently loses
        // sight of retired questions. Pin the split.
        fetchMock.mockResolvedValue(okResponse([enabled, retired]));

        const loaded = await loadQuizData("easy");

        expect(loaded).toHaveLength(2);
        expect(filterEnabledQuestions(loaded)).toEqual([enabled]);
    });
});
