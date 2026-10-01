import { useNavigate } from "react-router-dom";
import { CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane } from "../design";

/**
 * The landing screen (#169): the five ways into ESCParty, one pane of
 * controls on the ground. It's the root, so it has no way back.
 */
const DESTINATIONS = [
  { label: "Host or join a quiz room", path: "/multiplayer" },
  { label: "Browse the quiz library", path: "/quizzes" },
  { label: "Play a quiz solo", path: "/select-difficulty" },
  { label: "Build your own quiz", path: "/quizzes/new" },
  { label: "Throw a scoreboard party", path: "/party" },
] as const;

const Home = () => {
  const navigate = useNavigate();

  return (
    <CalmPage
      title="ESCParty"
      subtitle="Quizzes, douze points and a shared scoreboard for your Eurovision and Melodi Grand Prix night."
    >
      <Ground>
        <Pane role="group" aria-label="Where to start">
          {DESTINATIONS.map(({ label, path }) => (
            <Control key={path} onClick={() => navigate(path)}>
              {label}
            </Control>
          ))}
        </Pane>
      </Ground>
    </CalmPage>
  );
};

export default Home;
