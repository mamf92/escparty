/**
 * The quiz data model (#70): questions from the bank or written by a host,
 * and quizzes built from any mix of them.
 *
 * A question keeps the shape the quiz screen already plays
 * (`question`/`options`/`correctAnswer`, answer matched by its text), and
 * adds where it came from and, for bank questions, its difficulty and
 * category. A quiz is an ordered list of questions plus where the mid-quiz
 * scoreboard goes. Pure functions only: no React, no Firestore.
 */
import type { QuizDifficulty, QuizQuestion } from "./QuizDataProvider";

export type QuestionCategory = "winners" | "hosts" | "records" | "songs" | "nordic" | "spectacle";

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
    winners: "Winners",
    hosts: "Hosts & venues",
    records: "Records & rules",
    songs: "Songs & artists",
    nordic: "Nordic nights",
    spectacle: "Costumes & spectacle",
};

export const DIFFICULTY_LABELS: Record<QuizDifficulty, string> = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
};

/** A question from the built-in bank. */
export interface BankQuestion extends QuizQuestion {
    id: string;
    source: "bank";
    difficulty: QuizDifficulty;
    category: QuestionCategory;
}

/** A question a host wrote themselves. */
export interface CustomQuestion extends QuizQuestion {
    id: string;
    source: "custom";
}

export type AnyQuestion = BankQuestion | CustomQuestion;

/** Limits every question has to fit, custom or not. */
export const QUESTION_LIMITS = {
    minOptions: 2,
    maxOptions: 6,
    maxQuestionLength: 200,
    maxOptionLength: 80,
} as const;

/** Limits on a whole quiz (a room carries the questions, so keep it small). */
export const QUIZ_LIMITS = {
    minQuestions: 1,
    maxQuestions: 50,
    maxTitleLength: 60,
} as const;

/**
 * How often the mid-quiz scoreboard shows: after every Nth question, or
 * never (0). The allowed values are what `firestore.rules` accepts.
 */
export const BREAK_CHOICES = [0, 3, 4, 5, 10] as const;
export type BreakEvery = (typeof BREAK_CHOICES)[number];
export const DEFAULT_BREAK_EVERY: BreakEvery = 5;

export interface QuizDefinition {
    id: string;
    title: string;
    questions: AnyQuestion[];
    breakEvery: BreakEvery;
}

/** Which part of the question editor a problem is about. */
export type QuestionField = "question" | "answers" | "correct";

/** Which part of the quiz form a problem is about. */
export type QuizField = "name" | "questions" | "break";

export interface Problem<Field extends string> {
    field: Field;
    message: string;
}

/** Why each answer can't stand: empty, too long, or a repeat of another. */
const optionFaults = (options: string[]) => {
    const trimmed = options.map(option => option.trim());
    return trimmed.map((option, index) => ({
        empty: !option,
        tooLong: option.length > QUESTION_LIMITS.maxOptionLength,
        repeated: !!option && trimmed.some((other, i) => i !== index && other.toLowerCase() === option.toLowerCase()),
    }));
};

/** Which answers are wrong (empty, too long or a repeat), by position. */
export const badOptions = (options: string[]): boolean[] =>
    optionFaults(options).map(fault => fault.empty || fault.tooLong || fault.repeated);

/**
 * What's wrong with a question, each problem tagged with the field it's
 * about, so an editor can say it beside that field. Empty when it's
 * playable: a question, 2-6 distinct non-empty answers, and exactly one of
 * them marked correct.
 */
export const questionFieldProblems = (
    question: Pick<QuizQuestion, "question" | "options" | "correctAnswer">,
): Problem<QuestionField>[] => {
    const problems: Problem<QuestionField>[] = [];
    const add = (field: QuestionField, message: string) => problems.push({ field, message });
    const text = question.question.trim();
    const options = question.options.map(option => option.trim());
    const faults = optionFaults(question.options);

    if (!text) add("question", "Write the question.");
    if (text.length > QUESTION_LIMITS.maxQuestionLength) {
        add("question", `Keep the question under ${QUESTION_LIMITS.maxQuestionLength} characters.`);
    }
    if (options.length < QUESTION_LIMITS.minOptions) {
        add("answers", `Give at least ${QUESTION_LIMITS.minOptions} answers.`);
    }
    if (options.length > QUESTION_LIMITS.maxOptions) {
        add("answers", `Give at most ${QUESTION_LIMITS.maxOptions} answers.`);
    }
    if (faults.some(fault => fault.empty)) add("answers", "Fill in every answer, or remove the empty one.");
    if (faults.some(fault => fault.tooLong)) {
        add("answers", `Keep each answer under ${QUESTION_LIMITS.maxOptionLength} characters.`);
    }
    if (faults.some(fault => fault.repeated)) add("answers", "Two answers are the same.");
    if (!options.includes(question.correctAnswer.trim())) add("correct", "Mark which answer is correct.");

    return problems;
};

/**
 * What's wrong with a question, as sentences a host can act on. Empty when
 * it's playable.
 */
export const questionProblems = (question: Pick<QuizQuestion, "question" | "options" | "correctAnswer">): string[] =>
    questionFieldProblems(question).map(problem => problem.message);

export const isPlayableQuestion = (question: Pick<QuizQuestion, "question" | "options" | "correctAnswer">) =>
    questionProblems(question).length === 0;

/**
 * What's wrong with a quiz as a whole (its questions are checked
 * separately), each problem tagged with the field it's about.
 */
export const quizFieldProblems = (
    quiz: Pick<QuizDefinition, "title" | "questions" | "breakEvery">,
): Problem<QuizField>[] => {
    const problems: Problem<QuizField>[] = [];
    const add = (field: QuizField, message: string) => problems.push({ field, message });
    if (!quiz.title.trim()) add("name", "Give the quiz a name.");
    if (quiz.title.trim().length > QUIZ_LIMITS.maxTitleLength) {
        add("name", `Keep the name under ${QUIZ_LIMITS.maxTitleLength} characters.`);
    }
    if (quiz.questions.length < QUIZ_LIMITS.minQuestions) add("questions", "Add at least one question.");
    if (quiz.questions.length > QUIZ_LIMITS.maxQuestions) {
        add("questions", `A quiz can have at most ${QUIZ_LIMITS.maxQuestions} questions.`);
    }
    if (!(BREAK_CHOICES as readonly number[]).includes(quiz.breakEvery)) add("break", "Pick when the scoreboard shows.");
    const broken = quiz.questions.filter(question => !isPlayableQuestion(question)).length;
    if (broken > 0) add("questions", `${broken} ${broken === 1 ? "question needs" : "questions need"} fixing.`);
    return problems;
};

/** What's wrong with a quiz as a whole, as sentences. */
export const quizProblems = (quiz: Pick<QuizDefinition, "title" | "questions" | "breakEvery">): string[] =>
    quizFieldProblems(quiz).map(problem => problem.message);

/**
 * The question as the quiz screen plays it: trimmed, with the source
 * metadata dropped so a room only carries what players need.
 */
export const toPlayable = (question: QuizQuestion): QuizQuestion => ({
    id: question.id,
    question: question.question.trim(),
    options: question.options.map(option => option.trim()),
    correctAnswer: question.correctAnswer.trim(),
});

/**
 * Whether the mid-quiz scoreboard comes after the question at `index`
 * (0-based), in a quiz of `total` questions. Never after the last one:
 * the results come next.
 */
export const isBreakAfter = (index: number, total: number, breakEvery: number): boolean =>
    breakEvery > 0 && index < total - 1 && (index + 1) % breakEvery === 0;

/** Parse a stored break setting, falling back to the default for anything unknown. */
export const toBreakEvery = (value: unknown): BreakEvery =>
    (BREAK_CHOICES as readonly unknown[]).includes(value) ? (value as BreakEvery) : DEFAULT_BREAK_EVERY;

/** Deterministic shuffle (mulberry32), so every client in a room shuffles alike. */
export const seededShuffle = <T,>(items: readonly T[], seed: number): T[] => {
    const out = [...items];
    let state = seed >>> 0;
    const random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};
