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
  it("is a Calm page with one heading and the three difficulties as controls", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pick a difficulty");
    const group = screen.getByRole("group", { name: "Difficulty" });
    expect(group).toHaveClass("lycra-pane");
    const controls = [...group.querySelectorAll("button")];
    expect(controls.map(button => button.firstElementChild?.textContent)).toEqual(["Easy", "Medium", "Hard"]);
    for (const control of controls) {
      expect(control).toHaveClass("lycra", "is-block");
      expect(control.parentElement).toBe(group);
    }
  });

  it("names each difficulty by its title and describes it with the library's tagline", () => {
    renderPage();
    const easy = screen.getByRole("button", { name: "Easy" });
    expect(easy).toHaveAccessibleDescription("You know who Loreen is.");
    expect(screen.getByRole("button", { name: "Hard" })).toHaveAccessibleDescription("You know where Dana International won.");
  });

  it("starts a classic quiz single-player", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Medium" }));
    expect(screen.getByText('at /quiz/medium with {"multiplayer":false}')).toBeInTheDocument();
  });

  it("leads to the quiz library for premade and your own quizzes", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Browse the quiz library/ }));
    expect(screen.getByText("at /quizzes with null")).toBeInTheDocument();
  });

  it("has a way back home", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Back to ESCParty" }));
    expect(screen.getByText("at / with null")).toBeInTheDocument();
  });
});
