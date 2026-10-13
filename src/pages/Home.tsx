import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalmLink, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";
import { lastNightCode } from "../utils/nightSession";

/**
 * The landing screen: the big disco ball (`calm-hero` floats it, with no
 * wire) and two ways in at the bottom, where a thumb is. Hosting is the night's next step, so it is the
 * black button; joining is the white one under it. Everything a host can
 * start is on the Host screen, and a quiet link keeps solo play one tap
 * away. A device that was at a party night (#233) gets a third, white way
 * back to it under the two, as the scoreboard party's start offers its last
 * party. It's the root, so it has no way back.
 */
const Home = () => {
  const navigate = useNavigate();
  const [night] = useState(lastNightCode);

  return (
    <CalmPage
      className="calm-hero"
      title="Welcome to ESCParty"
      subtitle="Quizzes and a shared scoreboard for your Eurovision night."
      actions={(
        <Ground>
          <Pane role="group" aria-label="Where to start">
            <Control elevation="high" onClick={() => navigate("/host")}>Host a party</Control>
            <Control onClick={() => navigate("/join")}>Join a party</Control>
            {night && <Control onClick={() => navigate(`/n/${night}`)}>Back to your party night</Control>}
          </Pane>
        </Ground>
      )}
      footer={<CalmLink onClick={() => navigate("/select-difficulty")}>Play a quiz solo</CalmLink>}
    />
  );
};

export default Home;
