/**
 * Premade quizzes (#72): ready-to-play sets built from the question bank,
 * for playing solo or hosting a room. Each one is a fixed list of bank
 * question ids, so every client in a room plays the same questions in the
 * same order.
 */
import type { BreakEvery } from "../utils/quizModel";
import { BANK_QUESTIONS } from "./questionBank";

export interface QuizTemplate {
    /** Lowercase letters, digits and dashes: it's part of the room's quiz key. */
    id: string;
    title: string;
    tagline: string;
    breakEvery: BreakEvery;
    questionIds: string[];
}

const idsWhere = (keep: (question: (typeof BANK_QUESTIONS)[number]) => boolean) =>
    BANK_QUESTIONS.filter(keep).map(question => question.id);

export const QUIZ_TEMPLATES: QuizTemplate[] = [
    {
        id: "road-to-burgas",
        title: "Road to Burgas",
        tagline: "The 2020s so far, from Måneskin to DARA. Warm-up for 2027.",
        breakEvery: 5,
        questionIds: [
            "w-e-02", "classic-5", "w-e-16", "w-e-01", "w-m-07",
            "w-e-09", "w-e-03", "w-e-17", "classic-26", "w-e-21",
            "w-e-08", "w-h-18", "w-e-07", "w-h-24", "w-h-17",
        ],
    },
    {
        id: "nordic-nights",
        title: "Nordic Nights",
        tagline: "Melodi Grand Prix, Melodifestivalen and a lot of nul points.",
        breakEvery: 5,
        questionIds: idsWhere(question => question.category === "nordic"),
    },
    {
        id: "winners-circle",
        title: "Winners' Circle",
        tagline: "From Lys Assia in Lugano to JJ in Basel.",
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
            "w-e-11", "classic-14", "w-m-16", "w-h-09", "w-m-17",
            "w-h-21", "classic-7", "w-e-23", "w-h-06", "classic-13",
            "classic-24", "w-h-13",
        ],
    },
    {
        id: "wind-machine",
        title: "Wind Machine",
        tagline: "Costumes, key changes, grannies and a turkey.",
        breakEvery: 0,
        questionIds: idsWhere(question => question.category === "spectacle"),
    },
    {
        id: "quick-fire",
        title: "Quick Fire",
        tagline: "Ten easy ones, no breaks. For when the show's about to start.",
        breakEvery: 0,
        questionIds: [
            "w-e-10", "classic-2", "w-e-06", "classic-9", "w-e-12",
            "w-e-02", "w-e-20", "classic-10", "w-e-13", "w-e-07",
        ],
    },
];

export const quizTemplate = (id: string): QuizTemplate | undefined =>
    QUIZ_TEMPLATES.find(template => template.id === id);
