import { useNavigate } from "react-router-dom";
import { CalmLink, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";

/**
 * What a host can start (Home's "Host a party"): a multiplayer quiz,
 * straight to hosting it, or a scoreboard party, straight to setting it
 * up. The quiz library, where a host can pick or build a quiz first, is
 * the footer's other way.
 */
const HostParty = () => {
  const navigate = useNavigate();

  return (
    <CalmPage
      title="Host a party"
      subtitle="Pick tonight's game. Your guests join with the code you get."
      footer={(
        <>
          <CalmLink onClick={() => navigate("/quizzes")}>Pick or build a quiz</CalmLink>
          <CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>
        </>
      )}
    >
      <Ground>
        <Pane role="group" aria-label="What to host">
          <Control block onClick={() => navigate("/multiplayer", { state: { step: "host" } })}>
            <span>Host a quiz</span>
            <span className="calm-sub">Everyone answers on their phone, live</span>
          </Control>
          <Control block onClick={() => navigate("/party/new")}>
            <span>Host a scoreboard</span>
            <span className="calm-sub">Rate every act together and see who called the winner</span>
          </Control>
        </Pane>
      </Ground>
    </CalmPage>
  );
};

export default HostParty;
