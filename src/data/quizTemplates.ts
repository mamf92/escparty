/**
 * Premade quizzes (#72): ready-to-play sets built from the question bank,
 * for playing solo or hosting a room. Each one is a fixed list of bank
 * question ids, so every client in a room plays the same questions in the
 * same order.
 *
 * The lists are spelled out (not filtered from the bank) so this file
 * doesn't pull the whole bank into the main bundle: `loadQuiz` imports the
 * bank only when a quiz starts. No question in a quiz may give away the
 * answer to another one (or be answered by the quiz's own title or
 * tagline); `questionBank.test.ts` checks the ids exist.
 */
import type { BreakEvery } from "../utils/quizModel";

export interface QuizTemplate {
    /** Lowercase letters, digits and dashes: it's part of the room's quiz key. */
    id: string;
    title: string;
    tagline: string;
    breakEvery: BreakEvery;
    questionIds: string[];
}

export const QUIZ_TEMPLATES: QuizTemplate[] = [
    {
        id: "road-to-burgas",
        title: "Road to Burgas",
        tagline: "The 2020s so far. A warm-up for next May.",
        breakEvery: 5,
        questionIds: [
            "w-e-02", "w-e-16", "w-e-01", "w-m-07", "w-e-22",
            "w-e-09", "w-e-03", "w-e-17", "classic-26", "w-e-21",
            "w-e-08", "w-h-24", "w-h-17",
        ],
    },
    {
        id: "nordic-nights",
        title: "Nordic Nights",
        tagline: "Melodi Grand Prix, Melodifestivalen and a lot of nul points.",
        breakEvery: 5,
        // classic-30 (Finland's first winning song) is left out: classic-20 gives it away.
        questionIds: [
            "w-e-13", "classic-11", "w-m-03", "w-e-22", "classic-14",
            "w-m-16", "w-h-07", "w-e-14", "classic-20", "w-m-12",
            "w-m-23", "w-m-04", "w-h-20",
        ],
    },
    {
        id: "winners-circle",
        title: "Winners' Circle",
        tagline: "Seventy years of winners, from the first to the latest.",
        breakEvery: 5,
        questionIds: [
            "w-h-01", "classic-2", "w-h-02", "classic-16", "w-h-08",
            "classic-23", "w-m-14", "w-h-14", "w-m-18", "w-e-04",
            "classic-27", "w-e-06", "classic-12", "w-e-05", "w-m-06",
            "w-m-22", "w-m-05", "w-m-11", "w-e-03", "w-e-21",
        ],
    },
    {
        id: "nul-points",
        title: "Nul Points",
        tagline: "Records, rules and glorious last places.",
        breakEvery: 4,
        questionIds: [
            // classic-14 comes before w-m-16, whose "Norwegian singer" would give it away.
            "classic-14", "w-e-18", "w-m-16", "w-h-09", "w-m-17",
            "w-h-21", "classic-7", "w-e-23", "w-h-06", "classic-13",
            "classic-24", "w-h-13",
        ],
    },
    {
        id: "wind-machine",
        title: "Wind Machine",
        tagline: "Costumes, key changes, grannies and a turkey.",
        breakEvery: 0,
        questionIds: [
            "w-e-12", "w-m-20", "w-e-15", "w-m-10", "w-e-19",
            "w-m-25", "w-e-24", "classic-6", "w-m-26", "w-e-25",
            "w-e-26", "w-m-24",
        ],
    },
    {
        id: "quick-fire",
        title: "Quick Fire",
        tagline: "Ten easy ones, for when the show's about to start.",
        breakEvery: 0,
        questionIds: [
            "w-e-10", "classic-2", "w-e-06", "classic-9", "w-e-12",
            "w-e-02", "w-e-20", "classic-10", "w-e-13", "w-e-07",
        ],
    },
];

export const quizTemplate = (id: string): QuizTemplate | undefined =>
    QUIZ_TEMPLATES.find(template => template.id === id);
