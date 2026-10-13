import { useNavigate } from "react-router-dom";
import { CalmLink, CalmPage } from "../components/CalmPage";
import { ChoiceCard, ChoiceGrid, Ground } from "../design";

/**
 * What a host can start (Home's "Host a party"): a multiplayer quiz,
 * straight to hosting it, a scoreboard party, straight to setting it
 * up, or a party night (#233), one code for the whole evening. The quiz library, where a host can pick or build a quiz first, is
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
      actions={(
        <Ground>
          <ChoiceGrid role="group" aria-label="What to host">
            <ChoiceCard
              title="Host a quiz"
              sub="Everyone answers on their phone, live"
              onClick={() => navigate("/multiplayer", { state: { step: "host" } })}
            />
            <ChoiceCard
              title="Host a scoreboard"
              sub="Rate every act together, see who called the winner"
              onClick={() => navigate("/party/new")}
            />
            <ChoiceCard
              title="Host a party night"
              sub="One code all evening for quizzes and scoreboards"
              onClick={() => navigate("/n/new")}
            />
          </ChoiceGrid>
        </Ground>
      )}
    />
  );
};

export default HostParty;
