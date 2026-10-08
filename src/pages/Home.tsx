import { useNavigate } from "react-router-dom";
import { CalmLink, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";

/**
 * The landing screen: the big disco ball (`calm-hero` floats it, with no
 * wire) and two ways in. Hosting is the night's next step, so it is the
 * black button; joining is the white one under it. Everything a host can
 * start is on the Host screen, and a quiet link keeps solo play one tap
 * away. It's the root, so it has no way back.
 */
const Home = () => {
  const navigate = useNavigate();

  return (
    <CalmPage
      className="calm-hero"
      title="Welcome to ESCParty"
      subtitle="Quizzes and a shared scoreboard for your Eurovision night."
      footer={<CalmLink onClick={() => navigate("/select-difficulty")}>Play a quiz solo</CalmLink>}
    >
      <Ground>
        <Pane role="group" aria-label="Where to start">
          <Control elevation="high" onClick={() => navigate("/host")}>Host a party</Control>
          <Control onClick={() => navigate("/join")}>Join a party</Control>
        </Pane>
      </Ground>
    </CalmPage>
  );
};

export default Home;
