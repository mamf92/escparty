import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";
import { QUIZ_CHOICES } from "../utils/quizCatalog";
import { customQuizId, customQuizKey, forgetMyQuiz, isCustomQuizKey, listMyQuizzes, type MyQuiz } from "../utils/customQuizzes";
import { radioGroupKeys, radioTabIndex } from "../utils/radioGroupKeys";

/**
 * Every quiz this device can play (#72, #76): the quizzes you saved, then
 * the premade ones. Pick one, then play it solo, host a room with it, or
 * take it into the builder. A labelled choice list on the design system's
 * surface (#177): the quizzes are a radio group (arrow keys move the pick),
 * and the moves for the picked one sit in their own pane.
 */
const QuizLibrary = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [myQuizzes, setMyQuizzes] = useState(listMyQuizzes);
    // A quiz just saved in the builder comes back picked. It also comes
    // with the router state, so it's listed even if this browser couldn't
    // store the list (private mode, full storage).
    const returned = location.state as { picked?: string; saved?: MyQuiz } | null;
    const [picked, setPicked] = useState<string | null>(() => returned?.picked ?? null);
    // Removing a quiz from the device asks first.
    const [confirming, setConfirming] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const removeRef = useRef<HTMLButtonElement>(null);
    const keepRef = useRef<HTMLButtonElement>(null);
    const justSaved = returned?.saved && !myQuizzes.some(quiz => quiz.id === returned.saved?.id)
        ? [{ ...returned.saved, savedAt: 0 }]
        : [];

    const choices = [
        ...[...justSaved, ...myQuizzes].map(quiz => ({
            key: customQuizKey(quiz.id),
            title: quiz.title,
            detail: "Your quiz",
            questionCount: quiz.questionCount as number | null,
        })),
        ...QUIZ_CHOICES.map(choice => ({ key: choice.key, title: choice.title, detail: choice.tagline, questionCount: choice.questionCount })),
    ];
    const pickedIndex = choices.findIndex(option => option.key === picked);
    const choice = pickedIndex >= 0 ? choices[pickedIndex] : null;
    const mine = choice !== null && isCustomQuizKey(choice.key);

    const pick = (key: string) => {
        setPicked(key);
        setConfirming(false);
    };

    const askToForget = () => {
        setConfirming(true);
        // Land on the safe answer, which is where the move was.
        requestAnimationFrame(() => keepRef.current?.focus());
    };

    const keep = () => {
        setConfirming(false);
        requestAnimationFrame(() => removeRef.current?.focus());
    };

    const forget = (key: string) => {
        forgetMyQuiz(customQuizId(key));
        setMyQuizzes(listMyQuizzes());
        setPicked(null);
        setConfirming(false);
        // Drop the just-saved copy the router state still carries.
        if (location.state) navigate(location.pathname, { replace: true, state: null });
        // The moves pane is gone: back to the list, where the quiz was.
        requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus());
    };

    return (
        <CalmPage
            title="Quiz library"
            subtitle="Pick a quiz, then play it yourself or host it for the room."
            footer={<CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
        >
            <Ground>
                <Pane>
                    <Control onClick={() => navigate("/quizzes/new")}>Build your own quiz</Control>
                </Pane>
            </Ground>

            <Ground>
                <Pane ref={listRef} role="radiogroup" aria-label="Quizzes">
                    {choices.map((option, index) => (
                        <Control
                            key={option.key}
                            block
                            role="radio"
                            aria-checked={picked === option.key}
                            tabIndex={radioTabIndex(index, pickedIndex >= 0 ? pickedIndex : null)}
                            chosen={picked === option.key}
                            onClick={() => pick(option.key)}
                            onKeyDown={event => radioGroupKeys(event, index, choices.length, next => pick(choices[next].key))}
                        >
                            <span className="calm-row">
                                <span>{option.title}</span>
                                {option.questionCount !== null && (
                                    <span className="calm-sub">{option.questionCount} questions</span>
                                )}
                            </span>
                            <span className="calm-sub">{option.detail}</span>
                        </Control>
                    ))}
                </Pane>
            </Ground>

            {choice ? (
                <Ground>
                    <Pane aria-label={`What to do with ${choice.title}`}>
                        <Control onClick={() => navigate(`/quiz/${choice.key}`, { state: { multiplayer: false } })}>
                            Play {choice.title} solo
                        </Control>
                        <Control onClick={() => navigate("/multiplayer", { state: { quizKey: choice.key } })}>
                            Host {choice.title} for a room
                        </Control>
                        {mine ? (
                            <Control onClick={() => navigate(`/quizzes/edit/${customQuizId(choice.key)}`)}>
                                Edit {choice.title}
                            </Control>
                        ) : (
                            <Control onClick={() => navigate("/quizzes/new", { state: { fromKey: choice.key } })}>
                                Make my own version
                            </Control>
                        )}
                        {mine && !confirming && (
                            <Control ref={removeRef} onClick={askToForget}>Remove from this device</Control>
                        )}
                        {mine && confirming && (
                            <>
                                <p className="calm-sub" id="forget-quiz-confirm">
                                    Take {choice.title} off this device's list? The quiz itself isn't deleted, but you won't find it here again.
                                </p>
                                <Control aria-describedby="forget-quiz-confirm" onClick={() => forget(choice.key)}>Yes, remove it</Control>
                                <Control ref={keepRef} onClick={keep}>Keep it</Control>
                            </>
                        )}
                    </Pane>
                </Ground>
            ) : (
                <CalmNote>Pick a quiz above to play or host it.</CalmNote>
            )}
            {myQuizzes.length > 0 && (
                <CalmNote>Your quizzes are listed on this device only. Anyone with a room code can play them.</CalmNote>
            )}
        </CalmPage>
    );
};

export default QuizLibrary;
