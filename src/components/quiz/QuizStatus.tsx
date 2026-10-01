import { CalmNote } from "../CalmPage";

/**
 * The note above a question: the time left while it's open, then the
 * verdict in words once it's settled (the markers' text twin). As text, not
 * colour or a pulse. The clock is a `role="timer"`, which screen readers
 * read on request rather than every second; the verdict is a polite status.
 *
 * Presentation only: Quiz.tsx owns the clock and the scoring.
 */
export const QuizStatus = ({ timeLeft, settled, picked, correctAnswer, points, timerVisible }: {
  /** Whole seconds on the question's clock. */
  timeLeft: number;
  settled: boolean;
  picked: string | null;
  correctAnswer: string;
  /** Points this answer scored (0 for a wrong or unanswered question). */
  points: number;
  /**
   * Still showing the clock after it settled: a question this player
   * answered before a refresh, whose verdict this page never saw.
   */
  timerVisible: boolean;
}) => {
  if (!settled) {
    return (
      <CalmNote role="timer" aria-atomic="true">
        {timeLeft === 1 ? "1 second left" : `${timeLeft} seconds left`}
      </CalmNote>
    );
  }
  return <CalmNote role="status">{verdict({ picked, correctAnswer, points, timerVisible })}</CalmNote>;
};

const verdict = ({ picked, correctAnswer, points, timerVisible }: {
  picked: string | null;
  correctAnswer: string;
  points: number;
  timerVisible: boolean;
}) => {
  if (picked === correctAnswer && points > 0) return `Douze points! That's right: +${points} points.`;
  if (picked === correctAnswer) return `Time ran out before you locked it in. The answer was ${correctAnswer}.`;
  if (picked) return `Nul points this time. The answer was ${correctAnswer}.`;
  if (timerVisible) return `You answered this one before you came back. The answer was ${correctAnswer}.`;
  return `Time's up. The answer was ${correctAnswer}.`;
};
