/**
 * Quiz scoring math.
 *
 * Extracted verbatim from `Quiz.tsx`'s `submitAnswer` so the thing players
 * would most obviously notice being wrong can be tested directly instead of
 * only through a 700-line component. The numbers and the rounding here are
 * the product rule, not an implementation detail — change them deliberately.
 */

/** How long a player has to answer one question. */
export const QUESTION_TIME_LIMIT_MS = 10000;

/** Awarded for any correct answer, however slow. */
export const BASE_QUESTION_POINTS = 500;

/** Awarded on top of the base for answering instantly. */
export const MAX_TIME_BONUS = 500;

/**
 * The speed component of a correct answer's score: a linear share of
 * `MAX_TIME_BONUS` proportional to the time left on the clock, rounded down.
 *
 * `timeLeftMs` is clamped to `[0, QUESTION_TIME_LIMIT_MS]` first, so a stale
 * timer tick (negative, or left over from a longer feedback countdown) can't
 * push the bonus outside `[0, MAX_TIME_BONUS]`.
 */
export const calculateTimeBonus = (timeLeftMs: number): number => {
    const clampedTimeLeftMs = Math.max(0, Math.min(timeLeftMs, QUESTION_TIME_LIMIT_MS));
    return Math.floor((clampedTimeLeftMs / QUESTION_TIME_LIMIT_MS) * MAX_TIME_BONUS);
};

/**
 * Points for answering one question correctly, given the time left on the
 * clock. A wrong answer scores nothing — no partial credit, no penalty — so
 * callers gate on correctness rather than passing the verdict in here.
 */
export const calculateQuestionScore = (timeLeftMs: number): number =>
    BASE_QUESTION_POINTS + calculateTimeBonus(timeLeftMs);
