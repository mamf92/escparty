/**
 * Saved custom quizzes (#76): a host's own mix of bank questions and
 * questions they wrote, stored in Firestore's `quizzes` collection so every
 * player in a room can load it.
 *
 * There's no sign-in, so a quiz's random document id is what lets someone
 * read it (firestore.rules allows a get by id, never a list), and "my
 * quizzes" is a list of ids kept in this browser's localStorage. A saved quiz
 * never changes: editing saves a new one and swaps it into the list, so a
 * room that's already playing the old one isn't affected. Quizzes aren't
 * portable across devices yet; deleting only forgets the id here.
 */
import { collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { QuizDifficulty } from "./QuizDataProvider";
import {
    CATEGORY_LABELS,
    isPlayableQuestion,
    toBreakEvery,
    type AnyQuestion,
    type BreakEvery,
    type QuestionCategory,
} from "./quizModel";

const PREFIX = "c-";
const ID_PATTERN = /^[A-Za-z0-9]{20}$/;

/** The quiz key a room or the quiz route uses for a saved quiz. */
export const customQuizKey = (id: string) => `${PREFIX}${id}`;

/** Whether a key names a saved quiz: `c-` plus a 20-character document id. */
export const isCustomQuizKey = (key: string): boolean =>
    key.startsWith(PREFIX) && ID_PATTERN.test(key.slice(PREFIX.length));

/** The document id in a custom quiz key. */
export const customQuizId = (key: string) => key.slice(PREFIX.length);

export interface SavedQuiz {
    id: string;
    title: string;
    breakEvery: BreakEvery;
    questions: AnyQuestion[];
}

export type NewQuiz = Omit<SavedQuiz, "id">;

const DIFFICULTIES: QuizDifficulty[] = ["easy", "medium", "hard"];

/** A question as stored: only defined fields (Firestore refuses undefined). */
const storedQuestion = (question: AnyQuestion) => ({
    id: String(question.id),
    question: question.question.trim(),
    options: question.options.map(option => option.trim()),
    correctAnswer: question.correctAnswer.trim(),
    source: question.source,
    ...(question.source === "bank" ? { difficulty: question.difficulty, category: question.category } : {}),
});

/** Read one stored question back, or null if it isn't a playable question. */
const parseQuestion = (value: unknown, index: number): AnyQuestion | null => {
    const raw = value as Record<string, unknown> | null;
    if (!raw || typeof raw.question !== "string" || typeof raw.correctAnswer !== "string") return null;
    if (!Array.isArray(raw.options) || !raw.options.every(option => typeof option === "string")) return null;
    const base = {
        id: typeof raw.id === "string" && raw.id ? raw.id : `q${index + 1}`,
        question: raw.question,
        options: raw.options as string[],
        correctAnswer: raw.correctAnswer,
    };
    if (!isPlayableQuestion(base)) return null;
    const isBank = raw.source === "bank" &&
        DIFFICULTIES.includes(raw.difficulty as QuizDifficulty) &&
        typeof raw.category === "string" && raw.category in CATEGORY_LABELS;
    return isBank
        ? { ...base, source: "bank", difficulty: raw.difficulty as QuizDifficulty, category: raw.category as QuestionCategory }
        : { ...base, source: "custom" };
};

// Saved quizzes never change, so one read per id is enough for the page's life.
const cache = new Map<string, Promise<SavedQuiz | null>>();

/**
 * Load a saved quiz by id. Null when there's no such quiz. Questions that
 * aren't playable are dropped (the rules can't check each one), the same
 * way on every client, so a room still plays one list.
 */
export const fetchCustomQuiz = (id: string): Promise<SavedQuiz | null> => {
    const cached = cache.get(id);
    if (cached) return cached;
    const loading = (async () => {
        if (!db) throw new Error("Firebase not initialized");
        const snapshot = await getDoc(doc(db, "quizzes", id));
        if (!snapshot.exists()) return null;
        const data = snapshot.data() as Record<string, unknown>;
        const questions = (Array.isArray(data.questions) ? data.questions : [])
            .map(parseQuestion)
            .filter((question): question is AnyQuestion => question !== null);
        return {
            id,
            title: typeof data.title === "string" && data.title ? data.title : "Untitled quiz",
            breakEvery: toBreakEvery(data.breakEvery),
            questions,
        };
    })();
    // A failed read (offline) shouldn't stick: the next call tries again.
    loading.catch(() => cache.delete(id));
    cache.set(id, loading);
    return loading;
};

/** Save a new quiz, add it to this device's list, and return its id. */
export const saveCustomQuiz = async (quiz: NewQuiz, replacesId?: string): Promise<string> => {
    if (!db) throw new Error("Firebase not initialized");
    const ref = doc(collection(db, "quizzes"));
    const title = quiz.title.trim();
    await setDoc(ref, {
        title,
        breakEvery: quiz.breakEvery,
        questions: quiz.questions.map(storedQuestion),
        createdAt: serverTimestamp(),
    });
    cache.set(ref.id, Promise.resolve({ ...quiz, id: ref.id, title }));
    rememberMyQuiz({ id: ref.id, title, questionCount: quiz.questions.length, savedAt: Date.now() }, replacesId);
    return ref.id;
};

// ---- "My quizzes": the ids this browser saved ----

export interface MyQuiz {
    id: string;
    title: string;
    questionCount: number;
    savedAt: number;
}

const MY_QUIZZES_KEY = "escparty.myQuizzes";

const isMyQuiz = (value: unknown): value is MyQuiz => {
    const entry = value as MyQuiz | null;
    return !!entry && typeof entry.id === "string" && ID_PATTERN.test(entry.id) &&
        typeof entry.title === "string" && typeof entry.questionCount === "number" &&
        typeof entry.savedAt === "number";
};

/** This device's saved quizzes, newest first. Empty if storage is unavailable. */
export const listMyQuizzes = (): MyQuiz[] => {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(MY_QUIZZES_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter(isMyQuiz).sort((a, b) => b.savedAt - a.savedAt) : [];
    } catch {
        return [];
    }
};

const writeMyQuizzes = (quizzes: MyQuiz[]) => {
    try {
        localStorage.setItem(MY_QUIZZES_KEY, JSON.stringify(quizzes));
    } catch {
        // Private mode or full storage: the quiz is still saved, just not listed.
    }
};

/** Add a quiz to the list, in place of the one it replaces (an edit). */
export const rememberMyQuiz = (entry: MyQuiz, replacesId?: string) => {
    writeMyQuizzes([entry, ...listMyQuizzes().filter(quiz => quiz.id !== entry.id && quiz.id !== replacesId)]);
};

/** Take a quiz off this device's list. The saved quiz itself stays readable by id. */
export const forgetMyQuiz = (id: string) => {
    writeMyQuizzes(listMyQuizzes().filter(quiz => quiz.id !== id));
};

/** A saved quiz's title if this device knows it without a read. */
export const knownCustomTitle = (id: string): string | undefined =>
    listMyQuizzes().find(quiz => quiz.id === id)?.title;
