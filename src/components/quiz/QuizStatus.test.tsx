import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/test-utils";
import { QuizStatus } from "./QuizStatus";

const base = { timeLeft: 7, settled: false, picked: null, correctAnswer: "Sweden", points: 0, timerVisible: true };

describe("QuizStatus", () => {
  it("shows the time left as text in a timer while the question is open", () => {
    renderWithProviders(<QuizStatus {...base} />);
    expect(screen.getByRole("timer")).toHaveTextContent("7 seconds left");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says one second in the singular", () => {
    renderWithProviders(<QuizStatus {...base} timeLeft={1} />);
    expect(screen.getByRole("timer")).toHaveTextContent("1 second left");
  });

  it.each([
    [{ picked: "Sweden", points: 820, timerVisible: false }, "Douze points! That's right: +820 points."],
    [{ picked: "Sweden", points: 0, timerVisible: false }, "Time ran out before you locked it in. The answer was Sweden."],
    [{ picked: "Norway", points: 0, timerVisible: false }, "Nul points this time. The answer was Sweden."],
    [{ picked: null, points: 0, timerVisible: false }, "Time's up. The answer was Sweden."],
    [{ picked: null, points: 0, timerVisible: true }, "You answered this one before you came back. The answer was Sweden."],
  ])("says the verdict in words once settled (%o)", (props, text) => {
    renderWithProviders(<QuizStatus {...base} settled {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent(text);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});
