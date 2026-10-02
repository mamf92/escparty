import { useNavigate } from "react-router-dom";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";

/**
 * What `/quiz` (with no quiz named) shows. Nothing in the app links here
 * any more, but old links might, so the route stays and points the way to
 * where the quizzes live now.
 */
const UnderDevelopment = () => {
  const navigate = useNavigate();

  return (
    <CalmPage
      title="This page moved"
      footer={<CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
    >
      <CalmNote>Every quiz, premade or your own, lives in the quiz library now.</CalmNote>
      <Ground>
        <Pane>
          <Control onClick={() => navigate("/quizzes")}>Open the quiz library</Control>
        </Pane>
      </Ground>
    </CalmPage>
  );
};

export default UnderDevelopment;
