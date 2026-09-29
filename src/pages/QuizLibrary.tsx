import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { QUIZ_CHOICES } from "../utils/quizCatalog";

const breakLabel = (breakEvery: number) =>
    breakEvery === 0 ? "no breaks" : `scoreboard every ${breakEvery}`;

/**
 * Every premade quiz (#72): pick one, then play it solo or host a room
 * with it. A labelled choice list on the Calm surface: the quizzes are the
 * controls, and the two moves for the picked one sit in their own pane.
 */
const QuizLibrary = () => {
    const navigate = useNavigate();
    const [picked, setPicked] = useState<string | null>(null);
    const choice = QUIZ_CHOICES.find(option => option.key === picked) ?? null;

    return (
        <CalmPage
            title="Quiz library"
            subtitle="Pick a quiz, then play it yourself or host it for the room."
            footer={<CalmLink type="button" onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
        >
            <div className="calm-ground">
                <div className="lycra-pane" role="radiogroup" aria-label="Quizzes">
                    {QUIZ_CHOICES.map(option => (
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
                                <span className="calm-sub">
                                    {option.questionCount === null ? "10 questions" : `${option.questionCount} questions`}
                                </span>
                            </span>
                            <span className="calm-sub">{option.tagline} · {breakLabel(option.breakEvery)}</span>
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
                    </div>
                </div>
            ) : (
                <CalmNote>Pick a quiz above to play or host it.</CalmNote>
            )}
        </CalmPage>
    );
};

export default QuizLibrary;
