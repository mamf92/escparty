import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import { theme } from "./styles/theme";
import Home from "./pages/Home";
import Quiz from "./components/Quiz";
import QuizResults from "./components/QuizResults"; // ✅ Import QuizResults

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/results" element={<QuizResults />} />  {/* ✅ Add Results Page */}
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
