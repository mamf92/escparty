import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    doc: vi.fn(),
    collection: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
}));
const firebaseState = vi.hoisted(() => ({ db: {} as unknown }));

vi.mock("../firebase", () => ({
    get db() {
        return firebaseState.db;
    },
}));
vi.mock("firebase/firestore", () => mocks);

const ID = "AbCdEfGhIjKlMnOpQrSt";
const OTHER = "ZzZzZzZzZzZzZzZzZzZz";

const load = async () => {
    vi.resetModules();
    return import("./customQuizzes");
};

const snapshot = (data: Record<string, unknown> | null) => ({
    exists: () => data !== null,
    data: () => data,
});

const custom = { id: "q1", question: "Who sang 'Lipstick'?", options: ["Jedward", "Bros"], correctAnswer: "Jedward", source: "custom" as const };
const bank = {
    id: "w-e-20", question: "Which Irish twins?", options: ["Jedward", "Bros"], correctAnswer: "Jedward",
    source: "bank" as const, difficulty: "easy" as const, category: "songs" as const,
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    firebaseState.db = {};
    mocks.collection.mockReturnValue("quizzes-collection");
    mocks.doc.mockImplementation((...args: unknown[]) => (args.length === 1 ? { id: ID } : { path: args.slice(1).join("/") }));
});

describe("custom quiz keys", () => {
    it("are c- plus a 20-character id", async () => {
        const { customQuizKey, customQuizId, isCustomQuizKey } = await load();
        expect(customQuizKey(ID)).toBe(`c-${ID}`);
        expect(customQuizId(`c-${ID}`)).toBe(ID);
        expect(isCustomQuizKey(`c-${ID}`)).toBe(true);
        expect(isCustomQuizKey("c-short")).toBe(false);
        expect(isCustomQuizKey(`t-${ID}`)).toBe(false);
        expect(isCustomQuizKey(`c-${ID.slice(1)}!`)).toBe(false);
    });
});

describe("saveCustomQuiz", () => {
    it("stores only defined fields, trimmed, with the server's clock, and lists the quiz here", async () => {
        const { saveCustomQuiz, listMyQuizzes, fetchCustomQuiz } = await load();
        const id = await saveCustomQuiz({
            title: "  Jedward's Revenge ",
            breakEvery: 3,
            questions: [{ ...custom, question: " Who sang 'Lipstick'? " }, bank],
        });

        expect(id).toBe(ID);
        expect(mocks.setDoc).toHaveBeenCalledWith({ id: ID }, {
            title: "Jedward's Revenge",
            breakEvery: 3,
            questions: [
                { id: "q1", question: "Who sang 'Lipstick'?", options: ["Jedward", "Bros"], correctAnswer: "Jedward", source: "custom" },
                { ...bank },
            ],
            createdAt: "SERVER_TIMESTAMP",
        });
        expect(listMyQuizzes()).toEqual([
            { id: ID, title: "Jedward's Revenge", questionCount: 2, savedAt: expect.any(Number) },
        ]);
        // The saved quiz is cached: no read needed to play it here.
        await expect(fetchCustomQuiz(ID)).resolves.toMatchObject({ id: ID, title: "Jedward's Revenge" });
        expect(mocks.getDoc).not.toHaveBeenCalled();
    });

    it("takes the place of the quiz it was edited from", async () => {
        const { saveCustomQuiz, rememberMyQuiz, listMyQuizzes } = await load();
        rememberMyQuiz({ id: OTHER, title: "Old", questionCount: 1, savedAt: 1 });
        await saveCustomQuiz({ title: "New", breakEvery: 5, questions: [custom] }, OTHER);
        expect(listMyQuizzes().map(quiz => quiz.id)).toEqual([ID]);
    });

    it("refuses without Firestore", async () => {
        firebaseState.db = undefined;
        const { saveCustomQuiz } = await load();
        await expect(saveCustomQuiz({ title: "x", breakEvery: 5, questions: [custom] })).rejects.toThrow("Firebase not initialized");
    });
});

describe("fetchCustomQuiz", () => {
    it("reads a quiz, keeping bank metadata and dropping questions that can't be played", async () => {
        const { fetchCustomQuiz } = await load();
        mocks.getDoc.mockResolvedValue(snapshot({
            title: "Mixed",
            breakEvery: 4,
            questions: [
                bank,
                { ...custom, id: undefined },
                { ...bank, id: "w-x", category: "not-a-category" },
                { question: "Broken", options: ["Only one"], correctAnswer: "Only one" },
                { question: "Also broken", options: "nope", correctAnswer: "x" },
                null,
            ],
        }));

        const quiz = await fetchCustomQuiz(ID);

        expect(mocks.doc).toHaveBeenCalledWith(firebaseState.db, "quizzes", ID);
        expect(quiz).toEqual({
            id: ID,
            title: "Mixed",
            breakEvery: 4,
            questions: [
                bank,
                { id: "q2", question: custom.question, options: custom.options, correctAnswer: "Jedward", source: "custom" },
                { id: "w-x", question: bank.question, options: bank.options, correctAnswer: "Jedward", source: "custom" },
            ],
        });
    });

    it("falls back for a missing title, a bad break setting or no question list", async () => {
        const { fetchCustomQuiz } = await load();
        mocks.getDoc.mockResolvedValue(snapshot({ breakEvery: 7 }));
        await expect(fetchCustomQuiz(ID)).resolves.toEqual({ id: ID, title: "Untitled quiz", breakEvery: 5, questions: [] });
    });

    it("is null for a quiz that doesn't exist, and reads each id once", async () => {
        const { fetchCustomQuiz } = await load();
        mocks.getDoc.mockResolvedValue(snapshot(null));
        await expect(fetchCustomQuiz(ID)).resolves.toBeNull();
        await expect(fetchCustomQuiz(ID)).resolves.toBeNull();
        expect(mocks.getDoc).toHaveBeenCalledTimes(1);
    });

    it("tries again after a failed read", async () => {
        const { fetchCustomQuiz } = await load();
        mocks.getDoc.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(snapshot({ title: "Back", breakEvery: 5, questions: [custom] }));
        await expect(fetchCustomQuiz(ID)).rejects.toThrow("offline");
        await expect(fetchCustomQuiz(ID)).resolves.toMatchObject({ title: "Back" });
    });

    it("refuses without Firestore", async () => {
        firebaseState.db = undefined;
        const { fetchCustomQuiz } = await load();
        await expect(fetchCustomQuiz(ID)).rejects.toThrow("Firebase not initialized");
    });
});

describe("my quizzes", () => {
    it("lists newest first, skips bad entries, and forgets by id", async () => {
        const { rememberMyQuiz, listMyQuizzes, forgetMyQuiz, knownCustomTitle } = await load();
        rememberMyQuiz({ id: OTHER, title: "Older", questionCount: 3, savedAt: 1 });
        rememberMyQuiz({ id: ID, title: "Newer", questionCount: 5, savedAt: 2 });
        const stored = JSON.parse(localStorage.getItem("escparty.myQuizzes") ?? "[]");
        localStorage.setItem("escparty.myQuizzes", JSON.stringify([...stored, { id: "bad" }, null]));

        expect(listMyQuizzes().map(quiz => quiz.title)).toEqual(["Newer", "Older"]);
        expect(knownCustomTitle(OTHER)).toBe("Older");
        expect(knownCustomTitle("nope")).toBeUndefined();

        forgetMyQuiz(ID);
        expect(listMyQuizzes().map(quiz => quiz.id)).toEqual([OTHER]);
    });

    it("is empty when storage holds something else or can't be read", async () => {
        const { listMyQuizzes, rememberMyQuiz } = await load();
        localStorage.setItem("escparty.myQuizzes", "{\"not\":\"a list\"}");
        expect(listMyQuizzes()).toEqual([]);
        localStorage.setItem("escparty.myQuizzes", "not json");
        expect(listMyQuizzes()).toEqual([]);

        const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("quota");
        });
        expect(() => rememberMyQuiz({ id: ID, title: "x", questionCount: 1, savedAt: 1 })).not.toThrow();
        setItem.mockRestore();
    });
});
