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
import { customQuizId, customQuizKey, fetchCustomQuiz, isCustomQuizKey, knownCustomTitle, type MyQuiz } from "./customQuizzes";
import { setRoomDifficulty } from "./roomsFirestore";
import { QUESTION_SLOT_MS } from "./quizTiming";
import { DEFAULT_BREAK_EVERY, isBreakAfter, toPlayable, type AnyQuestion, type BankQuestion, type BreakEvery } from "./quizModel";

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

/** Each classic set's question count (the JSON files in src/data hold this many; quizCatalog.test.ts checks). */
export const CLASSIC_QUESTION_COUNT = 10;

export interface QuizChoice {
    key: string;
    title: string;
    /** One sentence on what the quiz covers. */
    tagline: string;
    level: QuizDifficulty;
    questionCount: number;
    breakEvery: BreakEvery;
}

/** Every premade quiz a host or solo player can pick, classic sets first. */
export const QUIZ_CHOICES: QuizChoice[] = [
    { key: "easy", title: CLASSIC_TITLES.easy, tagline: "Ten classics for anyone who knows who Loreen is.", level: "easy", questionCount: CLASSIC_QUESTION_COUNT, breakEvery: DEFAULT_BREAK_EVERY },
    { key: "medium", title: CLASSIC_TITLES.medium, tagline: "Ten classics for anyone who knows the year Alexander Rybak won.", level: "medium", questionCount: CLASSIC_QUESTION_COUNT, breakEvery: DEFAULT_BREAK_EVERY },
    { key: "hard", title: CLASSIC_TITLES.hard, tagline: "Ten classics for anyone who knows where Dana International won.", level: "hard", questionCount: CLASSIC_QUESTION_COUNT, breakEvery: DEFAULT_BREAK_EVERY },
    ...QUIZ_TEMPLATES.map(template => ({
        key: templateKey(template),
        title: template.title,
        tagline: template.tagline,
        level: template.level,
        questionCount: template.questionIds.length,
        breakEvery: template.breakEvery,
    })),
];

/** Time a mid-quiz scoreboard break adds to a room's quiz. */
const BREAK_MS = 30_000;

/**
 * About how many minutes a quiz takes in a room: each question's slot plus
 * a half minute for every mid-quiz break, rounded up to whole minutes.
 * `breakEvery` 0 means no breaks.
 */
export const quizMinutes = (questionCount: number, breakEvery: number): number => {
    let breaks = 0;
    for (let index = 0; index < questionCount; index++) {
        if (isBreakAfter(index, questionCount, breakEvery)) breaks++;
    }
    return Math.max(1, Math.ceil((questionCount * QUESTION_SLOT_MS + breaks * BREAK_MS) / 60_000));
};

/** What a quiz card shows. `level` is null for a quiz built on this device. */
export interface QuizCardInfo {
    key: string;
    title: string;
    level: QuizDifficulty | null;
    questionCount: number;
    minutes: number;
    description: string;
}

const LEVEL_WORDS = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

/** The card's tag: the quiz's level, or "Your quiz" for a quiz built on this device. */
export const quizLevelWord = (quiz: QuizCardInfo): string => (quiz.level ? LEVEL_WORDS[quiz.level] : "Your quiz");

/**
 * How long a quiz is, short enough for a card two to a row: shown as
 * "10 Qs · ca. 3 min", spoken as "10 questions, about 3 minutes".
 */
export const quizLength = (quiz: QuizCardInfo): { shown: string; spoken: string } => ({
    shown: `${quiz.questionCount} ${quiz.questionCount === 1 ? "Q" : "Qs"} · ca. ${quiz.minutes} min`,
    spoken: `${quiz.questionCount} ${quiz.questionCount === 1 ? "question" : "questions"}, about ${quiz.minutes} ${quiz.minutes === 1 ? "minute" : "minutes"}`,
});

/**
 * The cards for every quiz this device can pick, in one order for the
 * library and the green room: the device's own quizzes first, then the
 * premade ones.
 */
export const quizCardsFor = (myQuizzes: Pick<MyQuiz, "id" | "title" | "questionCount">[]): QuizCardInfo[] => [
    ...myQuizzes.map(quiz => ({
        key: customQuizKey(quiz.id),
        title: quiz.title,
        level: null,
        questionCount: quiz.questionCount,
        minutes: quizMinutes(quiz.questionCount, DEFAULT_BREAK_EVERY),
        description: "Built by you on this device.",
    })),
    ...QUIZ_CHOICES.map(choice => ({
        key: choice.key,
        title: choice.title,
        level: choice.level,
        questionCount: choice.questionCount,
        minutes: quizMinutes(choice.questionCount, choice.breakEvery),
        description: choice.tagline,
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
