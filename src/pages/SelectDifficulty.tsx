import { useNavigate } from "react-router-dom";
import { CalmLink, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";
import type { QuizDifficulty } from "../utils/QuizDataProvider";
import { CLASSIC_KEYS, QUIZ_CHOICES } from "../utils/quizCatalog";

/** The classic sets, with the same tagline the quiz library shows. */
const DIFFICULTIES = CLASSIC_KEYS.map(key => ({
  key,
  title: key.charAt(0).toUpperCase() + key.slice(1),
  detail: QUIZ_CHOICES.find(choice => choice.key === key)?.tagline ?? "",
}));

/**
 * The classic single-player quiz's way in: pick a difficulty, or go to
 * the quiz library for the premade quizzes and your own. A Calm page
 * (docs/design/design-system.md): the difficulties share one pane, the
 * library has its own.
 */
const SelectDifficulty = () => {
  const navigate = useNavigate();

  const handleSelect = (difficulty: QuizDifficulty) => {
    // Explicitly single player, so the quiz doesn't pick up a multiplayer
    // game this tab played earlier from sessionStorage.
    navigate(`/quiz/${difficulty}`, { state: { multiplayer: false } });
  };

  return (
    <CalmPage
      title="Pick a difficulty"
      subtitle="The classic quiz, just you. How well do you know your Eurovision?"
      footer={<CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
    >
      <Ground>
        <Pane role="group" aria-label="Difficulty">
          {DIFFICULTIES.map(({ key, title, detail }) => (
            <Control
              key={key}
              block
              aria-labelledby={`difficulty-${key}`}
              aria-describedby={`difficulty-${key}-detail`}
              onClick={() => handleSelect(key)}
            >
              <span id={`difficulty-${key}`}>{title}</span>
              <span id={`difficulty-${key}-detail`} className="calm-sub">{detail}</span>
            </Control>
          ))}
        </Pane>
      </Ground>
      <Ground>
        <Pane>
          <Control block onClick={() => navigate("/quizzes")}>
            <span>Browse the quiz library</span>
            <span className="calm-sub">Premade quizzes, and the ones you build yourself</span>
          </Control>
        </Pane>
      </Ground>
    </CalmPage>
  );
};

export default SelectDifficulty;
