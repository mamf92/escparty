import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../test/test-utils";
import { VerdictBurst } from "./VerdictBurst";

const WRONG_LINES = ["Nope!", "So close!", "Better luck next time!"];

const base = { questionNumber: 1, picked: "Sweden", correctAnswer: "Sweden", points: 478, outcome: "answered" as const };

describe("VerdictBurst", () => {
  it("keeps an empty status region mounted while the question is open", () => {
    const { container, rerender } = renderWithProviders(<VerdictBurst {...base} outcome={null} />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(container.querySelector(".quiz-burst")).toBeNull();

    rerender(<VerdictBurst {...base} />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Douze points! That's right: +478 points.");
  });

  it("shows a right answer as a big +points under Douze points", () => {
    const { container } = renderWithProviders(<VerdictBurst {...base} />);
    const burst = container.querySelector(".quiz-burst");
    expect(burst).toHaveClass("is-right");
    expect(burst).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".quiz-burst-lead")).toHaveTextContent("Douze points!");
    expect(container.querySelector(".quiz-burst-big")).toHaveTextContent("+478");
  });

  it("keeps the room's refusal honest: right, but no points promised", () => {
    const { container } = renderWithProviders(<VerdictBurst {...base} counted={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("That's right, but the points didn't reach the room.");
    expect(container.querySelector(".quiz-burst-big")).toHaveTextContent("Right!");
    expect(container.textContent).not.toContain("+478");
  });

  it.each(WRONG_LINES.map((line, index) => [index + 1, line] as const))(
    "tells a wrong answer on question %i %s, deterministically, with the answer",
    (questionNumber, line) => {
      const { container } = renderWithProviders(<VerdictBurst {...base} questionNumber={questionNumber} picked="Norway" />);
      expect(screen.getByRole("status")).toHaveTextContent(`${line} The answer was Sweden.`);
      expect(container.querySelector(".quiz-burst")).toHaveClass("is-wrong");
      expect(container.querySelector(".quiz-burst-big")).toHaveTextContent("Nul points");
    },
  );

  it("cycles the wrong-answer lines", () => {
    const { rerender } = renderWithProviders(<VerdictBurst {...base} questionNumber={1} picked="Norway" />);
    const first = screen.getByRole("status").textContent;
    rerender(<VerdictBurst {...base} questionNumber={1 + WRONG_LINES.length} picked="Norway" />);
    expect(screen.getByRole("status").textContent).toBe(first);
  });

  it.each([
    [{ outcome: "timed-out", picked: null, points: 0 }, "Time's up. The answer was Sweden."],
    [{ outcome: "restored", picked: null, points: 0 }, "This question was already settled when you came back. The answer was Sweden."],
  ] as const)("keeps the words for %o, still and without a number", (props, said) => {
    const { container } = renderWithProviders(<VerdictBurst {...base} {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent(said);
    expect(container.querySelector(".quiz-burst")).toHaveClass("is-still");
    expect(container.querySelector(".quiz-burst-lead")).toBeNull();
  });
});
