import { lazy, Suspense, type ReactNode } from "react";
import { HashRouter as Router, Outlet, Route, Routes } from "react-router-dom";
import styled from "styled-components";
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
import QuizLibrary from "./pages/QuizLibrary";
import QuizBuilder from "./pages/QuizBuilder";
import PartyHome from "./pages/PartyHome";
import PartySetup from "./pages/PartySetup";
import PartyRoom from "./pages/PartyRoom";
import PartyScreen from "./pages/PartyScreen";
import PartyAwards from "./pages/PartyAwards";
import MobileFrame from "./components/MobileFrame";
import { DesignThemeProvider, Stage, ThemeSwitch } from "./design";

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

// The party's big screen is for a TV across the room, so it fills the
// window instead of sitting in the phone frame (#84). It keeps the theme
// switch, so the host can put the TV in Sparkle too.
const TvLayout = ({ children }: { children: ReactNode }) => (
  <TvScreen className="esc-app">
    <Stage />
    <TvScroll>
      <TvBar><ThemeSwitch /></TvBar>
      {children}
    </TvScroll>
  </TvScreen>
);

// The stage stays put behind the content, which scrolls over it.
const TvScreen = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--esc-screen);
`;

const TvScroll = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow-y: auto;
  padding: 2rem 1.5rem;

  & > * {
    max-width: 960px;
    margin: 0 auto;
  }
`;

const TvBar = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const FabricLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--esc-backdrop);
  color: var(--esc-title);
  font-family: var(--esc-font-body);
`;

const App = () => {
  return (
    <DesignThemeProvider>
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
          <Route path="/party/:code/screen" element={<TvLayout><PartyScreen /></TvLayout>} />
          <Route element={<FramedLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/select-difficulty" element={<SelectDifficulty />} />
            <Route path="/quizzes" element={<QuizLibrary />} />
            <Route path="/quizzes/new" element={<QuizBuilder />} />
            <Route path="/quizzes/edit/:quizId" element={<QuizBuilder />} />
            <Route path="/quiz" element={<UnderDevelopment />} />
            <Route path="/quiz/:difficulty" element={<Quiz />} />
            <Route path="/results" element={<QuizResults />} />
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/multiplayer" element={<MultiplayerLobby />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/mid-quiz-scoreboard" element={<MidQuizScoreboard />} />
            <Route path="/host-observer" element={<HostObserverView />} />
            <Route path="/party" element={<PartyHome />} />
            <Route path="/party/new" element={<PartySetup />} />
            <Route path="/party/:code" element={<PartyRoom />} />
            <Route path="/party/:code/awards" element={<PartyAwards />} />
          </Route>
        </Routes>
      </Router>
    </DesignThemeProvider>
  );
};

export default App;
