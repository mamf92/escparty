/**
 * Which quiz a key names, and how to load it (#72).
 *
 * A quiz key is what the quiz route (`/quiz/:key`) and a room's
 * `difficulty` field carry:
 *   - `easy` / `medium` / `hard` — the classic sets (QuizDataProvider)
 *   - `t-<templateId>` — a premade quiz from the bank (quizTemplates.ts)
 *   - `c-<quizId>` — a saved custom quiz (customQuizzes.ts)
 * `firestore.rules` accepts only these shapes for a room (a `t-` key that
 * no template names still passes the rules; `isKnownQuizKey` catches it,
 * and a `c-` key whose quiz is gone fails when it loads).
 */
import { QUIZ_TEMPLATES, quizTemplate, type QuizTemplate } from "../data/quizTemplates";
import { loadQuizData, type QuizDifficulty, type QuizQuestion } from "./QuizDataProvider";
import { customQuizId, fetchCustomQuiz, isCustomQuizKey, knownCustomTitle } from "./customQuizzes";
import { setRoomDifficulty } from "./roomsFirestore";
import { DEFAULT_BREAK_EVERY, toPlayable, type AnyQuestion, type BankQuestion, type BreakEvery } from "./quizModel";

export const CLASSIC_KEYS: QuizDifficulty[] = ["easy", "medium", "hard"];
const TEMPLATE_PREFIX = "t-";

export const templateKey = (template: Pick<QuizTemplate, "id">) => `${TEMPLATE_PREFIX}${template.id}`;

const isClassicKey = (key: string): key is QuizDifficulty => (CLASSIC_KEYS as string[]).includes(key);

const templateFor = (key: string): QuizTemplate | undefined =>
    key.startsWith(TEMPLATE_PREFIX) ? quizTemplate(key.slice(TEMPLATE_PREFIX.length)) : undefined;

/** Whether a key names a quiz this build can play. */
export const isKnownQuizKey = (key: string | undefined | null): key is string =>
    !!key && (isClassicKey(key) || templateFor(key) !== undefined || isCustomQuizKey(key));

const CLASSIC_TITLES: Record<QuizDifficulty, string> = {
    easy: "Classic: Easy",
    medium: "Classic: Medium",
    hard: "Classic: Hard",
};

/**
 * A human title for a key: "Classic: Medium", "Nordic Nights". A custom
 * quiz's title is only known here if this device saved it; `useQuizTitle`
 * reads it for everyone else.
 */
export const quizTitle = (key: string | undefined | null): string => {
    if (!key) return "Not chosen";
    if (isClassicKey(key)) return CLASSIC_TITLES[key];
    if (isCustomQuizKey(key)) return knownCustomTitle(customQuizId(key)) ?? "Custom quiz";
    return templateFor(key)?.title ?? "Unknown quiz";
};

/** A key's title, reading a custom quiz from Firestore when needed. */
export const fetchQuizTitle = async (key: string | undefined | null): Promise<string> => {
    if (key && isCustomQuizKey(key)) {
        const quiz = await fetchCustomQuiz(customQuizId(key)).catch(() => null);
        if (quiz) return quiz.title;
    }
    return quizTitle(key);
};

/** Why loading a custom quiz that was deleted (or emptied) fails. */
const QUIZ_NOT_SAVED = "This quiz isn't saved any more.";

/**
 * A custom quiz that was deleted or emptied: retrying won't bring it back,
 * so callers can tell it from a failed connection by type, not by message.
 */
export class QuizNotSavedError extends Error {
    constructor() {
        super(QUIZ_NOT_SAVED);
        this.name = "QuizNotSavedError";
    }
}

export interface LoadedQuiz {
    questions: QuizQuestion[];
    breakEvery: BreakEvery;
    /** True for the classic sets, whose loader can fall back to a tiny built-in bank. */
    classic: boolean;
}

/** Load the questions a key names. Rejects for an unknown key. */
export const loadQuiz = async (key: string): Promise<LoadedQuiz> => {
    if (isClassicKey(key)) {
        return { questions: await loadQuizData(key), breakEvery: DEFAULT_BREAK_EVERY, classic: true };
    }
    if (isCustomQuizKey(key)) {
        const quiz = await fetchCustomQuiz(customQuizId(key));
        if (!quiz || quiz.questions.length === 0) throw new QuizNotSavedError();
        return { questions: quiz.questions.map(toPlayable), breakEvery: quiz.breakEvery, classic: false };
    }
    const template = templateFor(key);
    if (!template) throw new Error(`Unknown quiz: ${key}`);
    // The bank loads only when a premade quiz starts, keeping it out of the main bundle.
    const { bankQuestion } = await import("../data/questionBank");
    const questions = template.questionIds.map(id => {
        const question = bankQuestion(id);
        if (!question) throw new Error(`Quiz ${key} names a question that isn't in the bank: ${id}`);
        return toPlayable(question);
    });
    return { questions, breakEvery: template.breakEvery, classic: false };
};

/**
 * Every premade quiz a host or solo player can pick, classic sets first.
 * `questionCount` is null for the classic sets, which load their questions
 * at play time.
 */
export const QUIZ_CHOICES: { key: string; title: string; tagline: string; questionCount: number | null; breakEvery: BreakEvery }[] = [
    { key: "easy", title: CLASSIC_TITLES.easy, tagline: "You know who Loreen is.", questionCount: null, breakEvery: DEFAULT_BREAK_EVERY },
    { key: "medium", title: CLASSIC_TITLES.medium, tagline: "You know the year Alexander Rybak won.", questionCount: null, breakEvery: DEFAULT_BREAK_EVERY },
    { key: "hard", title: CLASSIC_TITLES.hard, tagline: "You know where Dana International won.", questionCount: null, breakEvery: DEFAULT_BREAK_EVERY },
    ...QUIZ_TEMPLATES.map(template => ({
        key: templateKey(template),
        title: template.title,
        tagline: template.tagline,
        questionCount: template.questionIds.length,
        breakEvery: template.breakEvery,
    })),
];

/**
 * How often a key's mid-quiz break comes, for a room about to play it.
 * Rejects when a custom quiz can't be read or is gone: a room's quiz and
 * break setting are one-shot, so guessing would lock in the wrong one.
 */
export const quizBreakEvery = async (key: string): Promise<BreakEvery> => {
    if (isCustomQuizKey(key)) {
        const quiz = await fetchCustomQuiz(customQuizId(key));
        if (!quiz || quiz.questions.length === 0) throw new QuizNotSavedError();
        return quiz.breakEvery;
    }
    return templateFor(key)?.breakEvery ?? DEFAULT_BREAK_EVERY;
};

/**
 * Set the quiz a room plays together with its break setting, the one way
 * pages should set a room's quiz (a bare setRoomDifficulty leaves the room
 * on the default break). Rejects without writing if the quiz can't be read.
 */
export const setRoomQuiz = async (roomCode: string, key: string): Promise<void> =>
    setRoomDifficulty(roomCode, key, await quizBreakEvery(key));

/**
 * A quiz as the builder starts from it: its title, break setting and the
 * questions with their bank metadata, for copying a premade quiz or
 * editing a saved one. Rejects for an unknown key or a missing quiz.
 */
export const loadQuizForEditing = async (key: string): Promise<{ title: string; breakEvery: BreakEvery; questions: AnyQuestion[] }> => {
    if (isCustomQuizKey(key)) {
        const quiz = await fetchCustomQuiz(customQuizId(key));
        if (!quiz) throw new QuizNotSavedError();
        return quiz;
    }
    const { BANK_QUESTIONS, bankQuestion } = await import("../data/questionBank");
    if (isClassicKey(key)) {
        const questions = BANK_QUESTIONS.filter(question => question.difficulty === key && question.id.startsWith("classic-"));
        return { title: CLASSIC_TITLES[key], breakEvery: DEFAULT_BREAK_EVERY, questions };
    }
    const template = templateFor(key);
    if (!template) throw new Error(`Unknown quiz: ${key}`);
    const questions = template.questionIds
        .map(id => bankQuestion(id))
        .filter((question): question is BankQuestion => question !== undefined);
    return { title: template.title, breakEvery: template.breakEvery, questions };
};
