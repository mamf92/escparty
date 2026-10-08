import { countdownLabel } from "../../utils/quizTiming";
import { CalmNote } from "../CalmPage";

/**
 * How a question was settled, as Quiz.tsx saw it happen: answered by a
 * tap, closed by the clock, or found already settled after a refresh
 * (where this page never saw which).
 */
export type QuizOutcome = "answered" | "timed-out" | "restored";

/**
 * The head of the question screen: which question this is, the points so
 * far, and the clock big in the middle; once the question is settled the
 * clock's slot says the verdict in words (the markers' text twin). The
 * clock is a `role="timer"` named with the real seconds, which screen
 * readers read on request rather than every second. The verdict's polite
 * status region is there from the start, empty while the question is open,
 * so the verdict is announced when it arrives.
 *
 * Presentation only: Quiz.tsx owns the clock and the scoring.
 */
export const QuizStatus = ({ questionNumber, questionCount, score, timeLeft, settled, picked, correctAnswer, points, outcome, counted = true, nextIn }: {
  /** 1-based, for "Question 3 of 10". */
  questionNumber: number;
  questionCount: number;
  /** The player's points so far. */
  score: number;
  /** Whole seconds on the question's clock. */
  timeLeft: number;
  settled: boolean;
  picked: string | null;
  correctAnswer: string;
  /** Points this answer scored (0 for a wrong or unanswered question). */
  points: number;
  /** How it was settled; null while the question is open. */
  outcome: QuizOutcome | null;
  /** False when the room refused or never got this answer's score. */
  counted?: boolean;
  /** What follows and when, where the room sets the pace ("Next question in 4s"). */
  nextIn?: string;
}) => (
  <div className="quiz-head">
    <div className="quiz-head-row">
      <p className="quiz-count">Question {questionNumber} of {questionCount}</p>
      <p className="quiz-points">Points so far: <strong>{score}</strong></p>
    </div>
    {/* One slot for the clock and then the verdict, so the question below
        doesn't move when one replaces the other. */}
    <div className="quiz-slot">
      {!settled && (
        <div
          className="quiz-clock"
          role="timer"
          aria-atomic="true"
          aria-label={timeLeft === 1 ? "1 second left" : `${timeLeft} seconds left`}
        >
          <span aria-hidden="true">{countdownLabel(timeLeft)}</span>
        </div>
      )}
      <div role="status">
        {settled && <CalmNote>{verdict({ picked, correctAnswer, points, outcome, counted })}</CalmNote>}
      </div>
      {settled && nextIn && <CalmNote>{nextIn}</CalmNote>}
    </div>
  </div>
);

const verdict = ({ picked, correctAnswer, points, outcome, counted }: {
  picked: string | null;
  correctAnswer: string;
  points: number;
  outcome: QuizOutcome | null;
  counted: boolean;
}) => {
  if (outcome === "restored") return `This question was already settled when you came back. The answer was ${correctAnswer}.`;
  if (outcome === "answered") {
    if (picked === correctAnswer && !counted) return "That's right, but the points didn't reach the room.";
    return picked === correctAnswer
      ? `Douze points! That's right: +${points} points.`
      : `Nul points this time. The answer was ${correctAnswer}.`;
  }
  return `Time's up. The answer was ${correctAnswer}.`;
};
