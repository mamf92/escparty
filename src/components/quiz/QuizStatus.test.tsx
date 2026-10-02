import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/test-utils";
import { QuizStatus } from "./QuizStatus";

const base = { timeLeft: 7, settled: false, picked: null, correctAnswer: "Sweden", points: 0, outcome: null };

describe("QuizStatus", () => {
  it("shows the time left as text in a timer while the question is open", () => {
    renderWithProviders(<QuizStatus {...base} />);
    expect(screen.getByRole("timer")).toHaveTextContent("7 seconds left");
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
    expect(screen.getByRole("timer")).toHaveTextContent("1 second left");
  });

  it.each([
    [{ picked: "Sweden", points: 820, outcome: "answered" }, "Douze points! That's right: +820 points."],
    [{ picked: "Norway", points: 0, outcome: "answered" }, "Nul points this time. The answer was Sweden."],
    [{ picked: "Sweden", points: 0, outcome: "timed-out" }, "Time ran out before you locked it in. The answer was Sweden."],
    [{ picked: "Norway", points: 0, outcome: "timed-out" }, "Time ran out before you locked it in. The answer was Sweden."],
    [{ picked: null, points: 0, outcome: "timed-out" }, "Time's up. The answer was Sweden."],
    [{ picked: "Sweden", points: 820, outcome: "answered", counted: false }, "That's right, but the points didn't reach the room."],
    [{ picked: null, points: 0, outcome: "restored" }, "This question closed for you before you came back. The answer was Sweden."],
  ] as const)("says the verdict in words once settled (%o)", (props, text) => {
    renderWithProviders(<QuizStatus {...base} settled {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent(text);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});
