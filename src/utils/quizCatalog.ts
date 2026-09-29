/**
 * Which quiz a key names, and how to load it (#72).
 *
 * A quiz key is what the quiz route (`/quiz/:key`) and a room's
 * `difficulty` field carry:
 *   - `easy` / `medium` / `hard` — the classic sets (QuizDataProvider)
 *   - `t-<templateId>` — a premade quiz from the bank (quizTemplates.ts)
 * `firestore.rules` accepts only these shapes for a room (a `t-` key that
 * no template names still passes the rules; `isKnownQuizKey` catches it).
 */
import { QUIZ_TEMPLATES, quizTemplate, type QuizTemplate } from "../data/quizTemplates";
import { loadQuizData, type QuizDifficulty, type QuizQuestion } from "./QuizDataProvider";
import { DEFAULT_BREAK_EVERY, toPlayable, type BreakEvery } from "./quizModel";

export const CLASSIC_KEYS: QuizDifficulty[] = ["easy", "medium", "hard"];
const TEMPLATE_PREFIX = "t-";

export const templateKey = (template: Pick<QuizTemplate, "id">) => `${TEMPLATE_PREFIX}${template.id}`;

const isClassicKey = (key: string): key is QuizDifficulty => (CLASSIC_KEYS as string[]).includes(key);

const templateFor = (key: string): QuizTemplate | undefined =>
    key.startsWith(TEMPLATE_PREFIX) ? quizTemplate(key.slice(TEMPLATE_PREFIX.length)) : undefined;

/** Whether a key names a quiz this build can play. */
export const isKnownQuizKey = (key: string | undefined | null): key is string =>
    !!key && (isClassicKey(key) || templateFor(key) !== undefined);

const CLASSIC_TITLES: Record<QuizDifficulty, string> = {
    easy: "Classic: Easy",
    medium: "Classic: Medium",
    hard: "Classic: Hard",
};

/** A human title for a key: "Classic: Medium", "Nordic Nights". */
export const quizTitle = (key: string | undefined | null): string => {
    if (!key) return "Not chosen";
    if (isClassicKey(key)) return CLASSIC_TITLES[key];
    return templateFor(key)?.title ?? "Unknown quiz";
};

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
