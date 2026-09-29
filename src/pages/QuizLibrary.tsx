import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { QUIZ_CHOICES } from "../utils/quizCatalog";
import { customQuizId, customQuizKey, forgetMyQuiz, isCustomQuizKey, listMyQuizzes, type MyQuiz } from "../utils/customQuizzes";

/**
 * Every quiz this device can play (#72, #76): the quizzes you saved, then
 * the premade ones. Pick one, then play it solo, host a room with it, or
 * take it into the builder. A labelled choice list on the Calm surface:
 * the quizzes are the controls, and the moves for the picked one sit in
 * their own pane.
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
    const choice = choices.find(option => option.key === picked) ?? null;
    const mine = choice !== null && isCustomQuizKey(choice.key);

    const forget = (key: string) => {
        forgetMyQuiz(customQuizId(key));
        setMyQuizzes(listMyQuizzes());
        setPicked(null);
        // Drop the just-saved copy the router state still carries.
        if (location.state) navigate(location.pathname, { replace: true, state: null });
    };

    return (
        <CalmPage
            title="Quiz library"
            subtitle="Pick a quiz, then play it yourself or host it for the room."
            footer={<CalmLink type="button" onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
        >
            <div className="calm-ground">
                <div className="lycra-pane">
                    <button type="button" className="lycra" onClick={() => navigate("/quizzes/new")}>
                        Build your own quiz
                    </button>
                </div>
            </div>

            <div className="calm-ground">
                <div className="lycra-pane" role="radiogroup" aria-label="Quizzes">
                    {choices.map(option => (
                        <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={picked === option.key}
                            className={`lycra is-block${picked === option.key ? " is-chosen" : ""}`}
                            onClick={() => setPicked(option.key)}
                        >
                            <span className="calm-row">
                                <span>{option.title}</span>
                                {option.questionCount !== null && (
                                    <span className="calm-sub">{option.questionCount} questions</span>
                                )}
                            </span>
                            <span className="calm-sub">{option.detail}</span>
                        </button>
                    ))}
                </div>
            </div>

            {choice ? (
                <div className="calm-ground">
                    <div className="lycra-pane">
                        <button
                            type="button"
                            className="lycra"
                            onClick={() => navigate(`/quiz/${choice.key}`, { state: { multiplayer: false } })}
                        >
                            Play {choice.title} solo
                        </button>
                        <button
                            type="button"
                            className="lycra"
                            onClick={() => navigate("/multiplayer", { state: { quizKey: choice.key } })}
                        >
                            Host {choice.title} for a room
                        </button>
                        {mine ? (
                            <button type="button" className="lycra" onClick={() => navigate(`/quizzes/edit/${customQuizId(choice.key)}`)}>
                                Edit {choice.title}
                            </button>
                        ) : (
                            <button type="button" className="lycra" onClick={() => navigate("/quizzes/new", { state: { fromKey: choice.key } })}>
                                Make my own version
                            </button>
                        )}
                        {mine && (
                            <button type="button" className="lycra" onClick={() => forget(choice.key)}>
                                Remove from this device
                            </button>
                        )}
                    </div>
                </div>
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
