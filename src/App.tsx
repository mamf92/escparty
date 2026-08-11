import { lazy, Suspense } from "react";
import { HashRouter as Router, Outlet, Route, Routes } from "react-router-dom";
import styled, { ThemeProvider } from "styled-components";
import { theme } from "./styles/theme";
import Home from "./pages/Home";
import SelectDifficulty from "./pages/SelectDifficulty";
import Quiz from "./components/Quiz";
import QuizResults from "./pages/QuizResults";
import Scoreboard from "./pages/Scoreboard";
import MultiplayerLobby from "./pages/MultiplayerLobby";
import Lobby from "./pages/Lobby";
import MidQuizScoreboard from "./pages/MidQuizScoreboard";
import HostObserverView from "./pages/HostObserverView";
import UnderDevelopment from "./pages/UnderDevelopment";
import MobileFrame from "./components/MobileFrame";

// Lazy so that three, react-three-fiber and leva stay out of the app's main
// bundle. Only the demo route pays for them.
const FabricQuizDemo = lazy(() => import("./fabric-ui/FabricQuizDemo"));

// The app screens all live inside the phone frame. The Fabric UI demo is a
// full bleed design concept, so it sits outside it.
const FramedLayout = () => (
  <MobileFrame>
    <Outlet />
  </MobileFrame>
);

const FabricLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.nightblue};
  color: ${({ theme }) => theme.colors.pinkLavender};
  font-family: ${({ theme }) => theme.fonts.body};
`;

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          <Route
            path="/fabric-ui"
            element={
              <Suspense fallback={<FabricLoading>Loading Fabric UI...</FabricLoading>}>
                <FabricQuizDemo />
              </Suspense>
            }
          />
          <Route element={<FramedLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/select-difficulty" element={<SelectDifficulty />} />
            <Route path="/quiz" element={<UnderDevelopment />} />
            <Route path="/quiz/:difficulty" element={<Quiz />} />
            <Route path="/results" element={<QuizResults />} />
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/multiplayer" element={<MultiplayerLobby />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/mid-quiz-scoreboard" element={<MidQuizScoreboard />} />
            <Route path="/host-observer" element={<HostObserverView />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
