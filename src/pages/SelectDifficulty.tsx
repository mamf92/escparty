import { useNavigate } from "react-router-dom";
import { CalmLink, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";

const DIFFICULTIES = [
  { key: "easy", title: "Easy", detail: "You know who Loreen is" },
  { key: "medium", title: "Medium", detail: "You know the year Alexander Rybak won ESC" },
  { key: "hard", title: "Hard", detail: "You know where ESC was held when Dana International won" },
] as const;

/**
 * The classic single-player quiz's way in: pick a difficulty, or go to
 * the quiz library for the premade quizzes and your own. A Calm page
 * (docs/design/design-system.md): the difficulties share one pane, the
 * library has its own.
 */
const SelectDifficulty = () => {
  const navigate = useNavigate();

  const handleSelect = (difficulty: string) => {
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
            <Control key={key} block onClick={() => handleSelect(key)}>
              <span>{title}</span>
              <span className="calm-sub">{detail}</span>
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
