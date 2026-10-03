import { CalmNote } from "../CalmPage";

/**
 * How a question was settled, as Quiz.tsx saw it happen: locked in by the
 * player, closed by the clock, or found already settled after a refresh
 * (where this page never saw which).
 */
export type QuizOutcome = "answered" | "timed-out" | "restored";

/**
 * The note above a question: the time left while it's open, then the
 * verdict in words once it's settled (the markers' text twin). As text, not
 * colour or a pulse. The clock is a `role="timer"`, which screen readers
 * read on request rather than every second. The verdict's polite status
 * region is there from the start, empty while the question is open, so the
 * verdict is announced when it arrives.
 *
 * Presentation only: Quiz.tsx owns the clock and the scoring.
 */
export const QuizStatus = ({ timeLeft, settled, picked, correctAnswer, points, outcome, counted = true }: {
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
}) => (
  // One slot for the clock and then the verdict, so the question below
  // doesn't move when one replaces the other.
  <div className="quiz-status">
    {!settled && (
      <CalmNote role="timer" aria-atomic="true">
        {timeLeft === 1 ? "1 second left" : `${timeLeft} seconds left`}
      </CalmNote>
    )}
    <div role="status">
      {settled && <CalmNote>{verdict({ picked, correctAnswer, points, outcome, counted })}</CalmNote>}
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
  if (picked) return `Time ran out before you locked it in. The answer was ${correctAnswer}.`;
  return `Time's up. The answer was ${correctAnswer}.`;
};
