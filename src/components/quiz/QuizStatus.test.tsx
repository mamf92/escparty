import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/test-utils";
import { QuizStatus } from "./QuizStatus";

const base = { questionNumber: 3, questionCount: 10, score: 1240, timeLeft: 7, settled: false, picked: null, correctAnswer: "Sweden", points: 0, outcome: null };

describe("QuizStatus", () => {
  it("names the question, with the points so far", () => {
    renderWithProviders(<QuizStatus {...base} />);
    expect(screen.getByText("Question 3 of 10")).toBeInTheDocument();
    expect(screen.getByText(/^Points so far:/)).toHaveTextContent("Points so far: 1240");
  });

  it("shows the clock big in a timer named with the real seconds while the question is open", () => {
    renderWithProviders(<QuizStatus {...base} />);
    expect(screen.getByRole("timer")).toHaveAccessibleName("7 seconds left");
    expect(screen.getByRole("timer")).toHaveTextContent("7");
  });

  it.each([
    [10, "12"], [9, "10"], [8, "8"], [7, "7"], [3, "3"], [1, "1"],
  ])("counts %i seconds left as %s on the clock, and says %i", (timeLeft, label) => {
    renderWithProviders(<QuizStatus {...base} timeLeft={timeLeft} />);
    expect(screen.getByRole("timer")).toHaveTextContent(new RegExp(`^${label}$`));
    expect(screen.getByRole("timer")).toHaveAccessibleName(timeLeft === 1 ? "1 second left" : `${timeLeft} seconds left`);
  });

  it("says what follows and when, once settled, where the room sets the pace", () => {
    renderWithProviders(<QuizStatus {...base} settled picked="Sweden" points={820} outcome="answered" nextIn="Next question in 4s" />);
    expect(screen.getByText("Next question in 4s")).toBeInTheDocument();
  });

  it("keeps an empty status region mounted while open, so the verdict is announced when it arrives", () => {
    const { rerender } = renderWithProviders(<QuizStatus {...base} />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    rerender(<QuizStatus {...base} settled picked="Sweden" points={820} outcome="answered" />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Douze points!");
  });

  it("says one second in the singular", () => {
    renderWithProviders(<QuizStatus {...base} timeLeft={1} />);
    expect(screen.getByRole("timer")).toHaveAccessibleName("1 second left");
  });

  it.each([
    [{ picked: "Sweden", points: 820, outcome: "answered" }, "Douze points! That's right: +820 points."],
    [{ picked: "Norway", points: 0, outcome: "answered" }, "Nul points this time. The answer was Sweden."],
    [{ picked: null, points: 0, outcome: "timed-out" }, "Time's up. The answer was Sweden."],
    [{ picked: "Sweden", points: 820, outcome: "answered", counted: false }, "That's right, but the points didn't reach the room."],
    [{ picked: null, points: 0, outcome: "restored" }, "This question was already settled when you came back. The answer was Sweden."],
  ] as const)("says the verdict in words once settled (%o)", (props, text) => {
    renderWithProviders(<QuizStatus {...base} settled {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent(text);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});
