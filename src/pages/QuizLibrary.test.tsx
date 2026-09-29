import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import QuizLibrary from "./QuizLibrary";

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} with {JSON.stringify(location.state)}</p>;
};

const renderLibrary = () =>
  renderWithProviders(
    <Routes>
      <Route path="/quizzes" element={<QuizLibrary />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: ["/quizzes"] },
  );

describe("QuizLibrary", () => {
  it("lists the classic sets and the premade quizzes, none picked", () => {
    renderLibrary();
    expect(screen.getByRole("radio", { name: /Classic: Easy/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Nordic Nights/ })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").every(radio => radio.getAttribute("aria-checked") === "false")).toBe(true);
    expect(screen.getByText("Pick a quiz above to play or host it.")).toBeInTheDocument();
  });

  it("plays the picked quiz solo", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole("radio", { name: /Nordic Nights/ }));
    expect(screen.getByRole("radio", { name: /Nordic Nights/ })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Play Nordic Nights solo" }));
    expect(screen.getByText('at /quiz/t-nordic-nights with {"multiplayer":false}')).toBeInTheDocument();
  });

  it("hosts the picked quiz through the multiplayer lobby", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole("radio", { name: /Classic: Hard/ }));
    await user.click(screen.getByRole("button", { name: "Host Classic: Hard for a room" }));
    expect(screen.getByText('at /multiplayer with {"quizKey":"hard"}')).toBeInTheDocument();
  });
});
