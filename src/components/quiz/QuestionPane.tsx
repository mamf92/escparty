import { useId } from "react";
import { Control, Ground, Marker, Pane } from "../../design";

/**
 * One question and its answers (docs/design/design-system.md): the
 * question as the section's <h2>, straight above a pane of answer
 * controls. Picking an answer sinks it (chosen, `aria-pressed`). Once the
 * question is settled the right answer stands proud with a check at its
 * end, and a wrong pick sits pressed in with a cross. The check and cross
 * are the only colour; the verdict is said in words by QuizStatus.
 *
 * Presentation only: what's picked and when it settles is Quiz.tsx's.
 */
export const QuestionPane = ({ question, options, picked, correctAnswer, settled, onPick }: {
  question: string;
  options: readonly string[];
  picked: string | null;
  correctAnswer: string;
  /** Answered or timed out: no more picking, show the verdict. */
  settled: boolean;
  onPick: (option: string) => void;
}) => {
  const headingId = useId();
  return (
    <>
      <h2 id={headingId} className="esc-heading quiz-question">{question}</h2>
      <Ground>
        <Pane role="group" aria-label="Answers" className="quiz-answers">
          {options.map(option => {
            const isPicked = picked === option;
            const marker = !settled ? undefined
              : option === correctAnswer ? "correct"
              : isPicked ? "wrong"
              : undefined;
            return (
              <Control
                key={option}
                // The sink is for a pick still open; a settled pick is shown
                // by its marker instead, but still reads as the one picked.
                chosen={!settled && isPicked}
                aria-pressed={isPicked}
                disabled={settled}
                className={marker && `is-marked ${marker === "correct" ? "is-high" : "is-low"}`}
                onClick={() => onPick(option)}
              >
                {marker && <Marker kind={marker} />}
                {option}
              </Control>
            );
          })}
        </Pane>
      </Ground>
    </>
  );
};
