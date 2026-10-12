import type { QuizOutcome } from "./QuizStatus";

/** What a wrong answer is told, one per question in turn (not random: every phone in a room says the same). */
const WRONG_LINES = ["Nope!", "So close!", "Better luck next time!"] as const;

const wrongLine = (questionNumber: number) => WRONG_LINES[Math.abs(questionNumber - 1) % WRONG_LINES.length];

/**
 * The verdict on a settled question, big where the clock was: "+478" under
 * "Douze points!" for a right answer, "Nul points" with a line for a wrong
 * one. In Sparkle, with motion allowed, a right answer pops and a wrong one
 * shakes (quiz.css); Calm and reduced motion show it still.
 *
 * The polite status region is always there, empty while the question is
 * open, saying "Answer locked in." once a room player has tapped, and holds one plain sentence for screen readers; the big text is
 * the picture of the same thing, hidden from them.
 */
export const VerdictBurst = ({ questionNumber, picked, correctAnswer, points, outcome, counted = true, locked = false }: {
  /** 1-based; picks the wrong-answer line. */
  questionNumber: number;
  picked: string | null;
  correctAnswer: string;
  /** Points this answer scored. */
  points: number;
  /** How it was settled; null while the question is open (nothing shown). */
  outcome: QuizOutcome | null;
  /** False when the room refused or never got this answer's score. */
  counted?: boolean;
  /** An answer is locked in but its verdict is not out yet (a room still answering). */
  locked?: boolean;
}) => {
  const answer = `The answer was ${correctAnswer}.`;
  let tone: "right" | "wrong" | "still" = "still";
  let lead: string | null = null;
  let big = "";
  let line = "";
  let said = locked && !outcome ? "Answer locked in." : "";

  if (outcome === "restored") {
    big = "Already settled";
    line = answer;
    said = `This question was already settled when you came back. ${answer}`;
  } else if (outcome === "answered" && picked === correctAnswer) {
    tone = "right";
    if (counted) {
      lead = "Douze points!";
      big = `+${points}`;
      said = `Douze points! That's right: +${points} points.`;
    } else {
      big = "Right!";
      line = "The points didn't reach the room.";
      said = "That's right, but the points didn't reach the room.";
    }
  } else if (outcome === "answered") {
    tone = "wrong";
    const quip = wrongLine(questionNumber);
    big = "Nul points";
    line = `${quip} ${answer}`;
    said = `${quip} ${answer}`;
  } else if (outcome === "timed-out") {
    big = "Time's up";
    line = answer;
    said = `Time's up. ${answer}`;
  }

  return (
    <>
      <div role="status" className="esc-visually-hidden">{said}</div>
      {outcome && (
        <div className={`quiz-burst is-${tone}${lead ? " has-number" : ""}`} aria-hidden="true">
          {lead && <span className="quiz-burst-lead">{lead}</span>}
          <span className="quiz-burst-big">{big}</span>
          {line && <span className="quiz-burst-line">{line}</span>}
        </div>
      )}
    </>
  );
};
