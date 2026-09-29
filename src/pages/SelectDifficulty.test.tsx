import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import SelectDifficulty from "./SelectDifficulty";

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} with {JSON.stringify(location.state)}</p>;
};

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/select-difficulty" element={<SelectDifficulty />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: ["/select-difficulty"] },
  );

describe("SelectDifficulty", () => {
  it("starts a classic quiz single-player", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("Medium"));
    expect(screen.getByText('at /quiz/medium with {"multiplayer":false}')).toBeInTheDocument();
  });

  it("leads to the quiz library for premade and your own quizzes", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText("More quizzes"));
    expect(screen.getByText("at /quizzes with null")).toBeInTheDocument();
  });
});
