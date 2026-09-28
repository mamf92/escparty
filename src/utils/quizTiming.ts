import type { RoomPhase } from "./roomsFirestore";

// Per-question timing for multiplayer (#62). Every client derives its
// countdown from the room's `phaseStartedAt` using these numbers, and
// firestore.rules refuses to end a question before QUESTION_SLOT_MS has
// passed — keep `duration.value(15, 's')` in isAdvancingPhase in sync.
export const QUESTION_MS = 10_000; // time to answer
export const FEEDBACK_MS = 5_000; // answer feedback before the next question
export const QUESTION_SLOT_MS = QUESTION_MS + FEEDBACK_MS;

/** A mid-quiz scoreboard break follows every Nth question. */
export const MID_QUIZ_EVERY = 5;

export interface PhaseAfterQuestion {
    phase: RoomPhase;
    currentQuestionIndex: number;
}

/**
 * What the room moves to once question `index` (0-based) of `totalQuestions`
 * is over: the next question, the mid-quiz break before it, or the results.
 */
export const phaseAfterQuestion = (index: number, totalQuestions: number): PhaseAfterQuestion => {
    if (index >= totalQuestions - 1) {
        return { phase: "results", currentQuestionIndex: index };
    }
    const next = index + 1;
    return {
        phase: next % MID_QUIZ_EVERY === 0 ? "mid-scoreboard" : "question",
        currentQuestionIndex: next,
    };
};

export interface QuestionClock {
    /** Milliseconds since the question started, never negative. */
    elapsedMs: number;
    /** Milliseconds of answering time left, 0 once answering has closed. */
    timeLeftMs: number;
    /** Whether answers are still accepted. */
    answeringOpen: boolean;
    /** Whether the whole slot (answering + feedback) is over. */
    slotOver: boolean;
}

/** Where a question started at `startedAtMs` is at `nowMs`. */
export const questionClock = (startedAtMs: number, nowMs: number): QuestionClock => {
    const elapsedMs = Math.max(0, nowMs - startedAtMs);
    const timeLeftMs = Math.max(0, QUESTION_MS - elapsedMs);
    return {
        elapsedMs,
        timeLeftMs,
        answeringOpen: timeLeftMs > 0,
        slotOver: elapsedMs >= QUESTION_SLOT_MS,
    };
};

/**
 * `room.phaseStartedAt` as epoch milliseconds, or null while the writer's own
 * snapshot still holds the pending serverTimestamp() (it reads as null until
 * the server confirms the write).
 */
export const startedAtMillis = (value: unknown): number | null => {
    const toMillis = (value as { toMillis?: unknown } | null | undefined)?.toMillis;
    return typeof toMillis === "function" ? (toMillis.call(value) as number) : null;
};
