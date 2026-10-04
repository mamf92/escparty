import { useNavigate } from "react-router-dom";
import { CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";

const DESTINATIONS = [
  { label: "Host or join a quiz room", path: "/multiplayer" },
  { label: "Browse the quiz library", path: "/quizzes" },
  { label: "Play a quiz solo", path: "/select-difficulty" },
  { label: "Build your own quiz", path: "/quizzes/new" },
  { label: "Throw a scoreboard party", path: "/party" },
] as const;

/**
 * The landing screen: the five ways into ESCParty, under the disco ball.
 * Playing together is the night's main event, so it is the black button;
 * the other four are white ones under it. It's the root, so it has no way
 * back.
 */
const Home = () => {
  const navigate = useNavigate();

  return (
    <CalmPage
      title="Welcome to ESCParty"
      subtitle="Quizzes, douze points and a shared scoreboard for your Eurovision and Melodi Grand Prix night."
    >
      <Ground>
        <Pane role="group" aria-label="Where to start">
          {DESTINATIONS.map(({ label, path }, index) => (
            <Control key={path} elevation={index === 0 ? "high" : "rest"} onClick={() => navigate(path)}>
              {label}
            </Control>
          ))}
        </Pane>
      </Ground>
    </CalmPage>
  );
};

export default Home;
