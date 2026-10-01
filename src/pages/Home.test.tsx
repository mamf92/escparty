import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, screen, userEvent, within } from "../test/test-utils";
import Home from "./Home";

const DESTINATIONS = [
  ["Host or join a quiz room", "/multiplayer"],
  ["Browse the quiz library", "/quizzes"],
  ["Play a quiz solo", "/select-difficulty"],
  ["Build your own quiz", "/quizzes/new"],
  ["Throw a scoreboard party", "/party"],
] as const;

// Also a smoke test for the harness: a real page renders under the
// providers and a router, and user-event can drive it.
describe("Home", () => {
  it("renders the brand title and the five ways in, on the design system", () => {
    renderWithProviders(<Home />);

    expect(screen.getByRole("heading", { level: 1, name: "ESCParty" })).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Where to start" });
    expect(group).toHaveClass("lycra-pane");
    expect(group.closest(".calm-ground")).not.toBeNull();

    const buttons = within(group).getAllByRole("button");
    expect(buttons.map(button => button.textContent)).toEqual(DESTINATIONS.map(([label]) => label));
    for (const button of buttons) {
      expect(button).toHaveClass("lycra");
      // Controls are direct children of their pane, with no wrappers.
      expect(button.parentElement).toBe(group);
    }
  });

  it.each(DESTINATIONS)("%s goes to %s", async (label, path) => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path={path} element={<p>Arrived at {path}</p>} />
      </Routes>,
    );

    await user.click(screen.getByRole("button", { name: label }));

    expect(screen.getByText(`Arrived at ${path}`)).toBeInTheDocument();
  });
});
