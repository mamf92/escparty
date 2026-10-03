import type { Ref } from "react";
import { Control, Ground, Marker, Pane } from "../../design";

/**
 * One question and its answers (docs/design/design-system.md): the
 * question as the section's <h2>, straight above a pane of answer
 * controls. Picking an answer sinks it (chosen, `aria-pressed`). Once the
 * question is settled the right answer stands proud with a check at its
 * end, and a wrong pick that was locked in sits pressed in with a cross
 * (a pick the clock beat to it gets no cross: it was never an answer). The check and cross
 * are the only colour; the verdict is said in words by QuizStatus.
 *
 * Presentation only: what's picked and when it settles is Quiz.tsx's.
 */
export const QuestionPane = ({ question, options, picked, correctAnswer, settled, lockedIn = true, onPick, headingRef }: {
  question: string;
  options: readonly string[];
  picked: string | null;
  correctAnswer: string;
  /** Answered or timed out: no more picking, show the verdict. */
  settled: boolean;
  /** The pick was locked in as the answer, not left open when time ran out. */
  lockedIn?: boolean;
  onPick: (option: string) => void;
  /** Where Quiz.tsx puts focus when the control it was on is disabled. */
  headingRef?: Ref<HTMLHeadingElement>;
}) => (
  <>
    <h2 className="esc-heading" ref={headingRef} tabIndex={-1}>{question}</h2>
    <Ground>
      <Pane role="group" aria-label="Answers">
        {options.map(option => {
          const isPicked = picked === option;
          const marker = !settled ? undefined
            : option === correctAnswer ? "correct"
            : isPicked && lockedIn ? "wrong"
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
