import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import { theme } from "./styles/theme";
import Home from "./pages/Home";
import SelectDifficulty from "./pages/SelectDifficulty";
import Quiz from "./components/Quiz";
import QuizResults from "./components/QuizResults";

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/select-difficulty" element={<SelectDifficulty />} />
          <Route path="/quiz/:difficulty" element={<Quiz />} />
          <Route path="/results" element={<QuizResults />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
