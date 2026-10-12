import type { Ref } from "react";
import { Control, Ground, Marker, Pane } from "../../design";

/**
 * One question and its answers (docs/design/design-system.md): the
 * question as the section's <h2>, straight above a pane of answer
 * controls. Tapping an answer is the answer: the question settles at once.
 * Alone, the right answer then stands proud with a check at its end, and a
 * wrong pick sits pressed in with a cross; the check and cross are the only
 * colour, and the verdict is said in words by QuizStatus. In a room the
 * answer is only locked in at first: the pick turns hot pink and nothing is
 * marked until the verdict is revealed.
 *
 * Presentation only: what's picked and when it settles is Quiz.tsx's.
 */
export const QuestionPane = ({ question, options, picked, correctAnswer, settled, revealed = true, onPick, headingRef }: {
  question: string;
  options: readonly string[];
  picked: string | null;
  correctAnswer: string;
  /** Answered or timed out: no more picking, show the verdict. */
  settled: boolean;
  /** Whether the verdict may show (markers); false while a room is still answering. */
  revealed?: boolean;
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
          const showMarkers = settled && revealed;
          const locked = settled && !revealed;
          const marker = !showMarkers ? undefined
            : option === correctAnswer ? "correct"
            : isPicked ? "wrong"
            : undefined;
          return (
            <Control
              key={option}
              // A pick settles the question at once, so it is shown by its
              // marker (or, locked in, by hot pink) and reads as the one picked.
              aria-pressed={isPicked}
              chosen={locked && isPicked}
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
