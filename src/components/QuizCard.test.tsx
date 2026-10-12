import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizCardGrid } from "./QuizCard";
import { quizCardsFor, quizLength } from "../utils/quizCatalog";

const cards = quizCardsFor([{ id: "AbCdEfGhIjKlMnOpQrSt", title: "Mine", questionCount: 1 }]);

const Harness = ({ disabled }: { disabled?: boolean }) => {
  const [picked, setPicked] = useState<string | null>(null);
  return <QuizCardGrid label="Quizzes" quizzes={cards} picked={picked} onPick={setPicked} disabled={disabled} />;
};

describe("QuizCardGrid", () => {
  it("shows level, length and a sentence on each card", () => {
    render(<Harness />);
    const easy = screen.getByRole("radio", { name: /Classic: Easy/ });
    expect(easy).toHaveTextContent(/^Easy/);
    expect(easy).toHaveTextContent("10 Qs · ca. 3 min");
    // The shortened length is spoken in full.
    expect(easy).toHaveAccessibleName(/10 questions, about 3 minutes/);
    expect(screen.getByRole("radio", { name: /Mine/ })).toHaveTextContent(/^Your quizMine1 Q · ca. 1 min/);
    expect(screen.getByRole("radiogroup", { name: "Quizzes" })).toBeInTheDocument();
  });

  it("picks on click and moves the pick with the arrow keys, with one tab stop", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    expect(radios.filter(radio => radio.tabIndex === 0)).toEqual([radios[0]]);
    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowRight}");
    expect(radios[2]).toHaveFocus();
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
    expect(radios.filter(radio => radio.tabIndex === 0)).toEqual([radios[2]]);
  });

  it("disables every card when asked", () => {
    render(<Harness disabled />);
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });
});

describe("quizLength", () => {
  it("says question or questions, minute or minutes", () => {
    expect(quizLength({ ...cards[0], questionCount: 1, minutes: 1 })).toEqual({ shown: "1 Q · ca. 1 min", spoken: "1 question, about 1 minute" });
    expect(quizLength({ ...cards[0], questionCount: 12, minutes: 4 })).toEqual({ shown: "12 Qs · ca. 4 min", spoken: "12 questions, about 4 minutes" });
  });
});
