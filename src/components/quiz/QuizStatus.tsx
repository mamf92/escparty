import { countdownLabel } from "../../utils/quizTiming";
import { CalmNote } from "../CalmPage";
import { Badge } from "../../design";
import { VerdictBurst } from "./VerdictBurst";

/**
 * How a question was settled, as Quiz.tsx saw it happen: answered by a
 * tap, closed by the clock, or found already settled after a refresh
 * (where this page never saw which).
 */
export type QuizOutcome = "answered" | "timed-out" | "restored";

/**
 * The head of the question screen: which question this is, the points so
 * far in a badge, and the clock big in the middle; once the question is
 * settled and revealed the clock's slot holds the verdict burst. In a room
 * an answer is locked in first (`settled` but not `revealed`): the clock
 * stays, with "Answer locked in" under it, until answering closes for
 * everyone. The clock is a `role="timer"` named with the real seconds,
 * which screen readers read on request rather than every second.
 *
 * Presentation only: Quiz.tsx owns the clock and the scoring.
 */
export const QuizStatus = ({ questionNumber, questionCount, score, timeLeft, settled, revealed = true, picked, correctAnswer, points, outcome, counted = true, nextIn }: {
  /** 1-based, for "Question 3 of 10". */
  questionNumber: number;
  questionCount: number;
  /** The player's points so far, as far as they may be shown. */
  score: number;
  /** Whole seconds on the clock: answering time left, while the clock shows. */
  timeLeft: number;
  settled: boolean;
  /** Whether a settled question's verdict may be shown; false while a room is still answering. */
  revealed?: boolean;
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
}) => {
  const showVerdict = settled && revealed;
  const locked = settled && !revealed;
  return (
    <div className="quiz-head">
      <div className="quiz-head-row">
        <p className="quiz-count">Question {questionNumber} of {questionCount}</p>
        <Badge className="quiz-points-badge" label="Points" value={score} />
      </div>
      {/* One slot for the clock and then the verdict, so the question below
          doesn't move when one replaces the other. */}
      <div className="quiz-slot">
        {!showVerdict && (
          <div
            className="quiz-clock"
            role="timer"
            aria-atomic="true"
            aria-label={timeLeft === 1 ? "1 second left" : `${timeLeft} seconds left`}
          >
            <span aria-hidden="true">{countdownLabel(timeLeft)}</span>
          </div>
        )}
        {locked && <p className="quiz-locked" aria-hidden="true">Answer locked in</p>}
        <VerdictBurst
          questionNumber={questionNumber}
          picked={showVerdict ? picked : null}
          correctAnswer={correctAnswer}
          points={points}
          outcome={showVerdict ? outcome : null}
          counted={counted}
          locked={locked}
        />
        {showVerdict && nextIn && <CalmNote>{nextIn}</CalmNote>}
      </div>
    </div>
  );
};
