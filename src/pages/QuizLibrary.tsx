import { useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";
import { QuizCardGrid } from "../components/QuizCard";
import { quizCardsFor } from "../utils/quizCatalog";
import { customQuizId, forgetMyQuiz, isCustomQuizKey, listMyQuizzes, type MyQuiz } from "../utils/customQuizzes";
import { focusSoon } from "../utils/focusSoon";

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
    const confirmId = useId();
    const justSaved = returned?.saved && !myQuizzes.some(quiz => quiz.id === returned.saved?.id)
        ? [{ ...returned.saved, savedAt: 0 }]
        : [];

    const choices = quizCardsFor([...justSaved, ...myQuizzes]);
    const choice = choices.find(option => option.key === picked) ?? null;
    const mine = choice !== null && isCustomQuizKey(choice.key);

    const pick = (key: string) => {
        setPicked(key);
        setConfirming(false);
    };

    const askToForget = () => {
        setConfirming(true);
        // Land on the safe answer, which is where the move was.
        focusSoon(() => keepRef.current);
    };

    const keep = () => {
        setConfirming(false);
        focusSoon(() => removeRef.current);
    };

    const forget = (key: string) => {
        forgetMyQuiz(customQuizId(key));
        setMyQuizzes(listMyQuizzes());
        setPicked(null);
        setConfirming(false);
        // Drop the just-saved copy the router state still carries.
        if (location.state) navigate(location.pathname, { replace: true, state: null });
        // The moves pane is gone: back to the list's tab stop, which with
        // nothing picked is the first quiz.
        focusSoon(() => listRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]'));
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

            <QuizCardGrid ref={listRef} label="Quizzes" quizzes={choices} picked={picked} onPick={pick} />

            {choice ? (
                <Ground>
                    <Pane role="group" aria-label={`What to do with ${choice.title}`}>
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
                                <p className="calm-sub" id={confirmId}>
                                    Take {choice.title} off this device's list? The quiz itself isn't deleted, but you won't find it here again.
                                </p>
                                <Control aria-describedby={confirmId} onClick={() => forget(choice.key)}>Yes, remove it</Control>
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
