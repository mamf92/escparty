import type { Ref } from "react";
import { ChoiceCard, ChoiceGrid, Ground } from "../design";
import { quizLength, quizLevelWord, type QuizCardInfo } from "../utils/quizCatalog";
import { radioGroupKeys, radioTabIndex } from "../utils/radioGroupKeys";

interface QuizCardGridProps {
    /** The group's accessible name, unless `labelledBy` names a visible heading. */
    label?: string;
    labelledBy?: string;
    quizzes: QuizCardInfo[];
    /** The picked quiz's key, or null. */
    picked: string | null;
    onPick: (key: string) => void;
    disabled?: boolean;
    ref?: Ref<HTMLDivElement>;
}

/**
 * The quizzes to pick from, two to a row: a radio group of cards, with the
 * arrow keys moving the pick and one tab stop (the picked card, or the
 * first). Shared by the quiz library and the green room.
 */
export const QuizCardGrid = ({ label, labelledBy, quizzes, picked, onPick, disabled, ref }: QuizCardGridProps) => {
    const pickedIndex = quizzes.findIndex(quiz => quiz.key === picked);
    return (
        <Ground>
            <ChoiceGrid
                ref={ref}
                role="radiogroup"
                aria-label={labelledBy ? undefined : label}
                aria-labelledby={labelledBy}
            >
                {quizzes.map((quiz, index) => (
                    <ChoiceCard
                        key={quiz.key}
                        role="radio"
                        aria-checked={picked === quiz.key}
                        tabIndex={radioTabIndex(index, pickedIndex >= 0 ? pickedIndex : null)}
                        chosen={picked === quiz.key}
                        disabled={disabled}
                        title={quiz.title}
                        tag={quizLevelWord(quiz)}
                        meta={<QuizLength quiz={quiz} />}
                        sub={quiz.description}
                        onClick={() => onPick(quiz.key)}
                        onKeyDown={event => radioGroupKeys(event, index, quizzes.length, next => onPick(quizzes[next].key))}
                    />
                ))}
            </ChoiceGrid>
        </Ground>
    );
};

/** "10 Qs · ca. 3 min" on the card, "10 questions, about 3 minutes" to a screen reader. */
const QuizLength = ({ quiz }: { quiz: QuizCardInfo }) => {
    const { shown, spoken } = quizLength(quiz);
    return (
        <>
            <span aria-hidden="true">{shown}</span>
            <span className="esc-choice-spoken">{spoken}</span>
        </>
    );
};
