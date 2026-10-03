/** One solo run as stored in localStorage's `quizScores` history. */
export interface ScoreEntry {
    score: number;
    /** The quiz's length; older or hand-edited runs may not have it. */
    total?: number;
    /** The quiz key (see quizCatalog), or "" when unknown. */
    difficulty: string;
    /** An ISO date, or "" when unknown. */
    date: string;
}

/**
 * A stored run, read forgivingly: anything with a numeric score is a run
 * (missing details come back as unknown), and anything else is not one.
 */
export function toScoreEntry(value: unknown): ScoreEntry | null {
    if (typeof value !== "object" || value === null) return null;
    const entry = value as Record<string, unknown>;
    if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) return null;
    return {
        score: entry.score,
        total: typeof entry.total === "number" && Number.isFinite(entry.total) ? entry.total : undefined,
        difficulty: typeof entry.difficulty === "string" ? entry.difficulty : "",
        date: typeof entry.date === "string" ? entry.date : "",
    };
}

/** A run's date as both history screens show it ("16 May 2026"), or "Unknown date". */
export function formatRunDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? "Unknown date"
        : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The solo score history, in stored order. Every reader of `quizScores`
 * should come through here so they agree on which runs count: a broken
 * entry is skipped, and unreadable storage is an empty history.
 */
export function readScoreHistory(): ScoreEntry[] {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem("quizScores") || "[]");
        if (!Array.isArray(stored)) return [];
        return stored.map(toScoreEntry).filter((entry): entry is ScoreEntry => entry !== null);
    } catch {
        return [];
    }
}
