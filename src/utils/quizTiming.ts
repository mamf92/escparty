import type { RoomPhase } from "./roomsFirestore";
import { DEFAULT_BREAK_EVERY, isBreakAfter } from "./quizModel";

// Per-question timing for multiplayer (#62). Every client derives its
// countdown from the room's `phaseStartedAt` using these numbers, and
// firestore.rules refuses to end a question before QUESTION_SLOT_MS has
// passed — keep `duration.value(15, 's')` in isAdvancingPhase in sync.
export const QUESTION_MS = 10_000; // time to answer
export const FEEDBACK_MS = 5_000; // answer feedback before the next question
export const QUESTION_SLOT_MS = QUESTION_MS + FEEDBACK_MS;
// How long after a room reaches the results a late score write still
// counts (#142): enough for the last answer's write and Quiz.tsx's retries.
// firestore.rules hardcodes it in isNotFinished — keep the two in sync.
export const RESULTS_GRACE_MS = 30_000;
// How long a guest waits for the host to start the reveal (#207) before
// being offered the results on their own phone: the host may have left.
export const RESULTS_WAIT_FALLBACK_MS = 60_000;

/**
 * A mid-quiz scoreboard break follows every Nth question, unless the room
 * says otherwise (`Room.breakEvery`, where 0 means never).
 */
export const MID_QUIZ_EVERY = DEFAULT_BREAK_EVERY;

export interface PhaseAfterQuestion {
    phase: RoomPhase;
    currentQuestionIndex: number;
}

/**
 * What the room moves to once question `index` (0-based) of `totalQuestions`
 * is over: the next question, the mid-quiz break before it, or the results.
 * `breakEvery` is the room's break setting (0: no breaks); firestore.rules
 * checks the same arithmetic in isAdvancingPhase.
 */
export const phaseAfterQuestion = (
    index: number,
    totalQuestions: number,
    breakEvery: number = MID_QUIZ_EVERY,
): PhaseAfterQuestion => {
    if (index >= totalQuestions - 1) {
        return { phase: "results", currentQuestionIndex: index };
    }
    const next = index + 1;
    return {
        phase: isBreakAfter(index, totalQuestions, breakEvery) ? "mid-scoreboard" : "question",
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

/**
 * Whether a player at the mid-quiz break before question `breakIndex` should
 * leave it, given the room's current state (#63). True once the room is
 * anywhere past this break: back on a question, at a later break, or at the
 * results. A player whose snapshot arrives late (a locked phone) still gets
 * moved on, whatever the room did in the meantime. A snapshot from before
 * this break (a question ahead of it, e.g. served from cache) isn't a reason
 * to leave. Pass a negative `breakIndex` when the break isn't known.
 */
export const hasLeftBreak = (
    phase: RoomPhase | undefined,
    roomIndex: number,
    breakIndex: number,
): boolean => {
    if (!phase || phase === "lobby") return false;
    if (phase === "mid-scoreboard") return roomIndex > breakIndex;
    if (phase === "question") return roomIndex >= breakIndex;
    return true;
};
